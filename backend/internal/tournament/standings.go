package tournament

import (
	"encoding/json"
	"math"
	"sort"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// ScoringConfig comes from tournaments.scoring. Zero values fall back to the
// football-style default: 3 for a win, 1 for a draw.
type ScoringConfig struct {
	PointsWin  int `json:"pointsWin"`
	PointsDraw int `json:"pointsDraw"`
	PointsLoss int `json:"pointsLoss"`
	// Credited to whoever turned up when the other side did not. Zero unless a
	// rulebook says otherwise — most award a nominal 3-0 or 2-0, and leaving it
	// at 0 at least keeps an absence from flattering anyone's goal difference.
	WalkoverScore int `json:"walkoverScore"`
	// DrawsAllowed is a pointer because absent and false are different answers.
	// Every tournament written before this field existed means "football", and
	// a plain bool would read those as "volleyball" and start refusing the
	// level scores they were happily recording yesterday. Read it through
	// DrawsAllowedOr rather than dereferencing it.
	DrawsAllowed *bool    `json:"drawsAllowed"`
	Tiebreakers  []string `json:"tiebreakers"`
}

// DrawsAllowedOr reports whether a level score is a legal result, treating an
// unset field as yes — which is what every record written before the field
// existed meant.
func (c ScoringConfig) DrawsAllowedOr() bool {
	return c.DrawsAllowed == nil || *c.DrawsAllowed
}

// DefaultTiebreakers is what most rulebooks say, in the order they say it.
var DefaultTiebreakers = []string{
	"points", "head_to_head", "score_diff", "score_for", "sub_diff", "seed",
}

func scoringConfig(tournament *core.Record) ScoringConfig {
	cfg := ScoringConfig{}
	if raw := tournament.GetString("scoring"); raw != "" && raw != "null" {
		_ = json.Unmarshal([]byte(raw), &cfg)
	}
	if cfg.PointsWin == 0 && cfg.PointsDraw == 0 && cfg.PointsLoss == 0 {
		cfg.PointsWin, cfg.PointsDraw = 3, 1
	}
	if len(cfg.Tiebreakers) == 0 {
		cfg.Tiebreakers = DefaultTiebreakers
	}
	return cfg
}

// standingRow accumulates one entry's record inside one pool.
type standingRow struct {
	Entry        string
	Seed         int
	Played       int
	Won          int
	Drawn        int
	Lost         int
	ScoreFor     int
	ScoreAgainst int
	SubFor       int
	SubAgainst   int
	Points       int
	Applied      []string
}

func (r *standingRow) scoreDiff() int { return r.ScoreFor - r.ScoreAgainst }
func (r *standingRow) subDiff() int   { return r.SubFor - r.SubAgainst }

// ComputeStandings rebuilds every pool table in a stage from its played
// fixtures and writes them to the standings collection.
//
// It recomputes from scratch rather than incrementally: a corrected score two
// hours later has to produce the same table as if it had been right initially,
// and incremental accumulation is exactly where that goes wrong.
func ComputeStandings(app core.App, stageID string) error {
	stage, err := app.FindRecordById("stages", stageID)
	if err != nil {
		return err
	}
	tournament, err := app.FindRecordById("tournaments", stage.GetString("tournament"))
	if err != nil {
		return err
	}
	cfg := scoringConfig(tournament)

	pools, err := app.FindRecordsByFilter(
		"pools", "stage = {:stage}", "position", 0, 0,
		dbx.Params{"stage": stageID},
	)
	if err != nil {
		return err
	}

	// Whoever's results have been struck. A voided team is not merely absent
	// from the table — every match they were in comes out of it, for their
	// opponents too, which is the whole difference between voiding and
	// forfeiting.
	voided, err := voidedForStage(app, stage)
	if err != nil {
		return err
	}

	return app.RunInTransaction(func(tx core.App) error {
		tables := []poolTable{}
		for _, pool := range pools {
			if pool.GetString("kind") != "group" {
				continue // brackets do not have tables
			}
			rows, err := computePoolTable(tx, stage, pool, cfg, voided)
			if err != nil {
				return err
			}
			tables = append(tables, poolTable{Pool: pool, Ranked: rows})
		}
		return computeStageTable(tx, stage, cfg, tables, voided)
	})
}

// poolTable is one pool's finished table, kept so the stage-wide table can be
// built from the same ranking rather than a second one.
type poolTable struct {
	Pool   *core.Record
	Ranked []*standingRow
}

// allRounds asks tallyPool for the table as it finally stands, as opposed to
// as it stood at the end of some round.
const allRounds = math.MaxInt

func computePoolTable(
	app core.App, stage, pool *core.Record, cfg ScoringConfig, voided map[string]bool,
) ([]*standingRow, error) {
	rows, played, err := tallyPool(app, stage, pool, cfg, allRounds, voided)
	if err != nil {
		return nil, err
	}
	rankGroup(rows, cfg.Tiebreakers, 0, played)

	advance := pool.GetInt("advance_count")
	if err := writeTable(app, stage.Id, pool.Id, rows, advance); err != nil {
		return nil, err
	}
	return rows, nil
}

// tallyPool builds one pool's rows from the fixtures that have been played in
// it, in slot order and unranked. It also returns those fixtures, which is what
// the head-to-head tiebreak reads.
//
// throughRound stops the tally at a round: `allRounds` counts everything, 1
// gives the table as it stood at the end of round 2, and anything negative
// gives everybody nothing. The Swiss pairing needs those, because a round has
// to be drawn from the rounds behind it and never from a table that already
// includes the round being drawn — which, once the bye in it has settled
// itself, would redraw the round it is standing in, for ever.
//
// ignore drops every fixture involving one of those entries, and the entries
// themselves. Two callers want that for unrelated reasons: the stage-wide
// table, comparing records of equal length across uneven pools, and a pool
// table with a voided team in it, whose matches never counted for anybody.
func tallyPool(
	app core.App, stage, pool *core.Record, cfg ScoringConfig, throughRound int,
	ignore map[string]bool,
) ([]*standingRow, []*core.Record, error) {
	// The participant set comes from the slots, not the fixtures, so an entry
	// that has not played yet still appears in the table on zero.
	slots, err := app.FindRecordsByFilter(
		"slots", "pool = {:pool} && round = 0", "position", 0, 0,
		dbx.Params{"pool": pool.Id},
	)
	if err != nil {
		return nil, nil, err
	}

	rows := map[string]*standingRow{}
	order := []string{}
	for _, slot := range slots {
		entryID := slot.GetString("entry")
		if entryID == "" || ignore[entryID] {
			continue
		}
		if _, seen := rows[entryID]; seen {
			continue
		}
		seed := 0
		if entry, err := app.FindRecordById("entries", entryID); err == nil {
			seed = entry.GetInt("seed")
		}
		rows[entryID] = &standingRow{Entry: entryID, Seed: seed}
		order = append(order, entryID)
	}

	fixtures, err := app.FindRecordsByFilter(
		"fixtures", "pool = {:pool}", "round, position", 0, 0,
		dbx.Params{"pool": pool.Id},
	)
	if err != nil {
		return nil, nil, err
	}

	// A bye counts for nothing in a bracket and for a win in a Swiss. The two
	// byes look identical in the database and mean opposite things: one is a
	// free pass to the next round, the other IS the round, and scoring it zero
	// would drop whoever sat out to the bottom of the table for having been
	// odd one out.
	swissBye := stage.GetString("format") == "swiss"

	played := make([]*core.Record, 0, len(fixtures))
	for _, f := range fixtures {
		if f.GetInt("round") > throughRound {
			continue
		}
		if ignore[f.GetString("home_entry")] || ignore[f.GetString("away_entry")] {
			continue
		}
		status := f.GetString("status")

		if status == "bye" {
			if !swissBye {
				continue
			}
			// Not appended to `played`: there is no opponent in it, so
			// head-to-head has nothing to read from it either way.
			if row := rows[f.GetString("winner")]; row != nil {
				accumulateBye(row, cfg)
			}
			continue
		}
		if status != "finished" && status != "walkover" {
			continue
		}
		home, away := rows[f.GetString("home_entry")], rows[f.GetString("away_entry")]
		if home == nil || away == nil {
			continue
		}
		played = append(played, f)

		if status == "walkover" {
			accumulateWalkover(home, away, f.GetString("winner"), cfg)
			continue // no score, and no sets to total
		}

		hs, as := f.GetInt("home_score"), f.GetInt("away_score")
		accumulate(home, away, hs, as, cfg)

		subHome, subAway, err := gameTotals(app, f.Id)
		if err != nil {
			return nil, nil, err
		}
		home.SubFor += subHome
		home.SubAgainst += subAway
		away.SubFor += subAway
		away.SubAgainst += subHome
	}

	ranked := make([]*standingRow, 0, len(order))
	for _, id := range order {
		ranked = append(ranked, rows[id])
	}
	return ranked, played, nil
}

// accumulateBye credits the entry that sat a Swiss round out.
//
// It is a win on the sheet and nothing else: the points for a win, the round
// counted as played, and cfg.WalkoverScore as a nominal score, which is 0
// unless a rulebook says an unplayed win is 2-0. Nobody is charged the goals
// against, because nobody was there to concede them.
func accumulateBye(row *standingRow, cfg ScoringConfig) {
	row.Played++
	row.Won++
	row.Points += cfg.PointsWin
	row.ScoreFor += cfg.WalkoverScore
}

// accumulateWalkover awards a match nobody played.
//
// It cannot go through accumulate: with the default WalkoverScore of 0 the two
// sides would come out level and be counted as a draw, which is the opposite of
// what a walkover is. The winner is named by the organiser rather than derived,
// because there is no score to derive it from.
func accumulateWalkover(home, away *standingRow, winner string, cfg ScoringConfig) {
	var won, lost *standingRow
	switch winner {
	case home.Entry:
		won, lost = home, away
	case away.Entry:
		won, lost = away, home
	default:
		return // nobody named; awarding it to a guess would be worse
	}

	won.Played++
	lost.Played++
	won.Won++
	lost.Lost++
	won.Points += cfg.PointsWin
	lost.Points += cfg.PointsLoss
	won.ScoreFor += cfg.WalkoverScore
	lost.ScoreAgainst += cfg.WalkoverScore
}

func accumulate(home, away *standingRow, hs, as int, cfg ScoringConfig) {
	home.Played++
	away.Played++
	home.ScoreFor += hs
	home.ScoreAgainst += as
	away.ScoreFor += as
	away.ScoreAgainst += hs

	switch {
	case hs > as:
		home.Won++
		away.Lost++
		home.Points += cfg.PointsWin
		away.Points += cfg.PointsLoss
	case as > hs:
		away.Won++
		home.Lost++
		away.Points += cfg.PointsWin
		home.Points += cfg.PointsLoss
	default:
		home.Drawn++
		away.Drawn++
		home.Points += cfg.PointsDraw
		away.Points += cfg.PointsDraw
	}
}

// gameTotals sums the per-set scores of a fixture, which feed the sub_for /
// sub_against tiebreak.
func gameTotals(app core.App, fixtureID string) (int, int, error) {
	games, err := app.FindRecordsByFilter(
		"games", "fixture = {:fixture}", "number", 0, 0,
		dbx.Params{"fixture": fixtureID},
	)
	if err != nil {
		return 0, 0, err
	}
	home, away := 0, 0
	for _, g := range games {
		home += g.GetInt("home_score")
		away += g.GetInt("away_score")
	}
	return home, away, nil
}

// ---------------------------------------------------------------------------
// ranking
// ---------------------------------------------------------------------------

// rankGroup sorts rows in place by the criteria, in order, recursing into
// still-tied sub-groups.
//
// head_to_head is the reason this is recursive rather than one comparator
// chain: it is computed only among the rows that are actually tied, from the
// fixtures they played against each other. A global comparator cannot see that
// context.
func rankGroup(rows []*standingRow, criteria []string, depth int, fixtures []*core.Record) {
	if len(rows) < 2 || depth >= len(criteria) {
		return
	}

	criterion := criteria[depth]

	// "draw" means drawing lots; there is nothing deterministic left to do, so
	// the current (stable) order stands.
	if criterion == "draw" {
		return
	}

	value := valueFunc(criterion, rows, fixtures)
	if value == nil {
		// Unknown criterion — skip it rather than reordering arbitrarily.
		rankGroup(rows, criteria, depth+1, fixtures)
		return
	}

	for _, r := range rows {
		r.Applied = append(r.Applied, criterion)
	}

	sort.SliceStable(rows, func(i, j int) bool {
		return value(rows[i]) > value(rows[j])
	})

	start := 0
	for i := 1; i <= len(rows); i++ {
		if i == len(rows) || value(rows[i]) != value(rows[start]) {
			if i-start > 1 {
				rankGroup(rows[start:i], criteria, depth+1, fixtures)
			}
			start = i
		}
	}
}

func valueFunc(criterion string, rows []*standingRow, fixtures []*core.Record) func(*standingRow) int {
	switch criterion {
	case "points":
		return func(r *standingRow) int { return r.Points }
	case "wins":
		return func(r *standingRow) int { return r.Won }
	case "score_diff":
		return func(r *standingRow) int { return r.scoreDiff() }
	case "score_for":
		return func(r *standingRow) int { return r.ScoreFor }
	case "sub_diff":
		return func(r *standingRow) int { return r.subDiff() }
	case "seed":
		// A lower seed number is better; unseeded entries sort last.
		return func(r *standingRow) int {
			if r.Seed <= 0 {
				return math.MinInt32
			}
			return -r.Seed
		}
	case "head_to_head":
		mini := headToHead(rows, fixtures)
		return func(r *standingRow) int { return mini[r.Entry] }
	default:
		return nil
	}
}

// headToHead builds a mini-table from only those fixtures where both sides are
// in the tied group, and returns each entry's points in it.
func headToHead(rows []*standingRow, fixtures []*core.Record) map[string]int {
	inGroup := make(map[string]bool, len(rows))
	for _, r := range rows {
		inGroup[r.Entry] = true
	}

	// Read the winner rather than the scores: a walkover has an outcome and no
	// score, and comparing 0 with 0 would file it as a draw between the team
	// that turned up and the team that did not.
	points := make(map[string]int, len(rows))
	for _, f := range fixtures {
		home, away := f.GetString("home_entry"), f.GetString("away_entry")
		if !inGroup[home] || !inGroup[away] {
			continue
		}
		switch f.GetString("winner") {
		case home:
			points[home] += 3
		case away:
			points[away] += 3
		default:
			points[home]++
			points[away]++
		}
	}
	return points
}

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------

// tableRows reads the stored table for one pool, or — for the empty pool id —
// the stage-wide table.
//
// The stage-wide rows are picked out in Go rather than with `pool = ”`,
// because what an unset relation compares equal to inside a filter string is
// not worth resting a table on.
func tableRows(app core.App, stageID, poolID string) ([]*core.Record, error) {
	if poolID != "" {
		return app.FindRecordsByFilter(
			"standings", "stage = {:stage} && pool = {:pool}", "", 0, 0,
			dbx.Params{"stage": stageID, "pool": poolID},
		)
	}

	all, err := app.FindRecordsByFilter(
		"standings", "stage = {:stage}", "position", 0, 0,
		dbx.Params{"stage": stageID},
	)
	if err != nil {
		return nil, err
	}
	rows := make([]*core.Record, 0, len(all))
	for _, r := range all {
		if r.GetString("pool") == "" {
			rows = append(rows, r)
		}
	}
	return rows, nil
}

func writeTable(app core.App, stageID, poolID string, ranked []*standingRow, advance int) error {
	existing, err := tableRows(app, stageID, poolID)
	if err != nil {
		return err
	}
	byEntry := map[string]*core.Record{}
	for _, r := range existing {
		byEntry[r.GetString("entry")] = r
	}

	collection, err := app.FindCollectionByNameOrId("standings")
	if err != nil {
		return err
	}

	seen := map[string]bool{}
	for i, row := range ranked {
		record, ok := byEntry[row.Entry]
		if !ok {
			record = core.NewRecord(collection)
			record.Set("stage", stageID)
			record.Set("pool", poolID)
			record.Set("entry", row.Entry)
		}
		seen[row.Entry] = true

		record.Set("position", i+1)
		record.Set("played", row.Played)
		record.Set("won", row.Won)
		record.Set("drawn", row.Drawn)
		record.Set("lost", row.Lost)
		record.Set("score_for", row.ScoreFor)
		record.Set("score_against", row.ScoreAgainst)
		record.Set("sub_for", row.SubFor)
		record.Set("sub_against", row.SubAgainst)
		record.Set("points", row.Points)
		record.Set("qualified", advance > 0 && i < advance)

		applied := row.Applied
		if applied == nil {
			applied = []string{}
		}
		record.Set("tiebreak", map[string]any{"applied": applied})

		if err := app.Save(record); err != nil {
			return err
		}
	}

	// Drop rows for entries that are no longer in the pool.
	for entryID, record := range byEntry {
		if !seen[entryID] {
			if err := app.Delete(record); err != nil {
				return err
			}
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// pool_rank slot resolution
// ---------------------------------------------------------------------------

// PoolComplete reports whether every fixture in a pool has been settled.
//
// Tables are provisional until then, and putting a provisionally-first team
// into the playoff is the single worst bug this system could have.
func PoolComplete(app core.App, poolID string) (bool, error) {
	fixtures, err := app.FindRecordsByFilter(
		"fixtures", "pool = {:pool}", "", 0, 0,
		dbx.Params{"pool": poolID},
	)
	if err != nil {
		return false, err
	}
	if len(fixtures) == 0 {
		return false, nil
	}
	for _, f := range fixtures {
		if !isSettled(f.GetString("status")) {
			return false, nil
		}
	}

	// A Swiss pool holds only the rounds drawn so far, so "every fixture is
	// settled" is true after round one and means nothing. Its table is final
	// once the rounds it owes have all been drawn AND played.
	pool, err := app.FindRecordById("pools", poolID)
	if err != nil {
		return false, err
	}
	outstanding, err := SwissRoundsOutstanding(app, pool)
	if err != nil {
		return false, err
	}
	return !outstanding, nil
}

// ResolvePoolRanks fills in every slot that waits on a table position in one of
// this stage's pools — the "1st of Pool A goes to the playoff" wiring.
//
// Slots are only filled once their source pool is complete. Idempotent.
func ResolvePoolRanks(app core.App, stageID string) (int, error) {
	pools, err := app.FindRecordsByFilter(
		"pools", "stage = {:stage}", "position", 0, 0,
		dbx.Params{"stage": stageID},
	)
	if err != nil {
		return 0, err
	}

	resolved := 0
	for _, pool := range pools {
		complete, err := PoolComplete(app, pool.Id)
		if err != nil {
			return resolved, err
		}
		if !complete {
			continue
		}

		waiting, err := app.FindRecordsByFilter(
			"slots", "source_type = 'pool_rank' && source_pool = {:pool}", "", 0, 0,
			dbx.Params{"pool": pool.Id},
		)
		if err != nil {
			return resolved, err
		}
		if len(waiting) == 0 {
			continue
		}

		table, err := app.FindRecordsByFilter(
			"standings", "pool = {:pool}", "position", 0, 0,
			dbx.Params{"pool": pool.Id},
		)
		if err != nil {
			return resolved, err
		}
		byPosition := map[int]string{}
		for _, row := range table {
			byPosition[row.GetInt("position")] = row.GetString("entry")
		}

		for _, slot := range waiting {
			entry := byPosition[slot.GetInt("source_position")]
			if entry == "" || slot.GetString("entry") == entry {
				continue
			}
			slot.Set("entry", entry)
			if err := app.Save(slot); err != nil {
				return resolved, err
			}
			if err := refreshDependentFixtures(app, slot); err != nil {
				return resolved, err
			}
			resolved++
		}
	}
	return resolved, nil
}
