package tournament

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Swiss: the only format whose next round cannot be drawn in advance.
//
// A bracket and a round robin are written once and played to the end. A Swiss
// round is a function of the table, and the table is a function of the rounds
// already played — so this generator writes round 1 and nothing else, and the
// rounds after it are drawn as the results come in.
//
// Everything downstream of that follows:
//
//   - The pairing of round r is computed from the fixtures of rounds 0..r-1
//     ONLY, never from the table as it currently stands. That makes it a pure
//     function of finished rounds, so re-running it writes the same pairing
//     twice — which matters because the hook that draws a round re-enters
//     itself the moment a bye settles.
//   - A round is re-drawn if a result behind it is corrected, but only while
//     neither it nor anything after it has been played. A score fixed two
//     hours later has to produce the table it would have produced at the time;
//     matches already played cannot be unplayed to match it.
//   - A Swiss pool is not complete when its fixtures are. It still owes the
//     rounds nobody has drawn yet, and a playoff seeded from a table that is
//     two rounds short would take the wrong four teams.

// swissRoundCount is how many rounds a Swiss stage plays.
//
// Configured wins. Otherwise ceil(log2(n)): the fewest rounds that can leave
// one team unbeaten out of n, which is what a Swiss is for. Below three rounds
// the table has not separated anybody, and above n-1 somebody has to play
// somebody twice, so both ends are clamped.
func swissRoundCount(configured, entries int) int {
	rounds := configured
	if rounds <= 0 {
		rounds = int(math.Ceil(math.Log2(float64(max(entries, 2)))))
		rounds = max(rounds, 3)
	}
	return max(min(rounds, max(entries-1, 1)), 1)
}

// ---------------------------------------------------------------------------
// pairing — pure
// ---------------------------------------------------------------------------

// swissEntry is one row of the table going into a pairing: who, and on how
// many points. The slice is always in table order, best first.
type swissEntry struct {
	Entry  string
	Points int
}

// pairKey identifies a meeting between two entries regardless of which of them
// was at home.
func pairKey(a, b string) string {
	if a > b {
		a, b = b, a
	}
	return a + "|" + b
}

// swissPairing is one drawn round.
type swissPairing struct {
	Pairs [][2]string
	// Bye is the entry sitting the round out, or "" when the field is even.
	Bye string
	// Rematch is true when the field had run out of fresh opponents and a
	// repeat had to be allowed. The organiser deserves to be told.
	Rematch bool
}

// pairSwiss draws one round.
//
// order is the table, best first. met records who has already played whom, and
// hadBye who has already sat a round out.
//
// The rule is the standard one: split each score group in half and pair the
// top half against the bottom half, so the leaders play each other and the
// pairing stays meaningful all the way down the table. Where that would repeat
// a meeting the pair is transposed, and where a whole group cannot be paired
// without a repeat the search backtracks into the groups above it. Avoiding
// rematches is the hard constraint; the fold is the preference that gives way.
func pairSwiss(order []swissEntry, met map[string]bool, hadBye map[string]bool) swissPairing {
	field := append([]swissEntry{}, order...)
	result := swissPairing{Pairs: [][2]string{}}

	// An odd field sits somebody out: the lowest-ranked entry that has not had
	// a bye yet. Handing a second one to the same team while somebody else has
	// had none is the complaint this rule exists to prevent.
	if len(field)%2 == 1 {
		pick := -1
		for i := len(field) - 1; i >= 0; i-- {
			if !hadBye[field[i].Entry] {
				pick = i
				break
			}
		}
		if pick < 0 {
			pick = len(field) - 1 // everybody has had one; the table decides
		}
		result.Bye = field[pick].Entry
		field = append(field[:pick:pick], field[pick+1:]...)
	}

	pairs := matchSwiss(field, met)
	if pairs == nil {
		// Every remaining pairing would be a repeat. Playing the round twice
		// over is better than not playing it, so the constraint is dropped and
		// the fold decides on its own.
		pairs = matchSwiss(field, map[string]bool{})
		result.Rematch = true
	}
	if pairs != nil {
		result.Pairs = pairs
	}
	return result
}

// matchSwiss finds a perfect matching of the field that repeats no meeting,
// preferring the fold. Returns nil when no such matching exists.
//
// It always pairs the highest-ranked unpaired entry first, which is what makes
// the fold fall out of a greedy rule: within a score group of size g+1 the
// ideal opponent sits at index (g-1)/2 of the rest, and removing that opponent
// leaves the remainder of the group split evenly for the next step. An odd
// group pairs its top and drops its last entry into the group below, exactly
// as a float should.
func matchSwiss(field []swissEntry, met map[string]bool) [][2]string {
	if len(field) == 0 {
		return [][2]string{}
	}

	a, rest := field[0], field[1:]
	for _, j := range foldOrder(a, rest) {
		b := rest[j]
		if met[pairKey(a.Entry, b.Entry)] {
			continue
		}
		remaining := make([]swissEntry, 0, len(rest)-1)
		remaining = append(remaining, rest[:j]...)
		remaining = append(remaining, rest[j+1:]...)

		tail := matchSwiss(remaining, met)
		if tail == nil {
			continue
		}
		return append([][2]string{{a.Entry, b.Entry}}, tail...)
	}
	return nil
}

// foldOrder ranks a's possible opponents: the fold partner first, then outward
// through its own score group, then down into the groups below.
func foldOrder(a swissEntry, rest []swissEntry) []int {
	// rest is in table order, so everyone on a's points is a prefix of it.
	group := 0
	for group < len(rest) && rest[group].Points == a.Points {
		group++
	}

	inGroup := make([]int, 0, group)
	for i := 0; i < group; i++ {
		inGroup = append(inGroup, i)
	}
	if group > 0 {
		ideal := (group - 1) / 2
		sort.SliceStable(inGroup, func(x, y int) bool {
			// Distance from the fold partner, and on a tie the entry further
			// down the group — the classic transposition tries the next one
			// down before the one above.
			dx, dy := abs(inGroup[x]-ideal)*2, abs(inGroup[y]-ideal)*2
			if inGroup[x] < ideal {
				dx++
			}
			if inGroup[y] < ideal {
				dy++
			}
			return dx < dy
		})
	}

	// Below the group, nearest in the table first: a float meets the top of
	// the group it drops into.
	for i := group; i < len(rest); i++ {
		inGroup = append(inGroup, i)
	}
	return inGroup
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

// ---------------------------------------------------------------------------
// generation
// ---------------------------------------------------------------------------

const (
	swissPoolKey = "pool:swiss"
	// The single slot every bye in the stage is played against. One is enough:
	// a different entry sits out each round, but it is always the same empty
	// chair, and fixture identity is (round, position) rather than the slots.
	swissByeSlotKey = "slot:bye"
)

// PlanSwiss builds a Swiss stage: one table, everybody in it, and round one.
//
// The later rounds are deliberately absent. They are drawn by PairNextRound as
// the rounds before them finish, because a Swiss pairing that ignores the
// results so far is not a Swiss pairing.
func PlanSwiss(entryIDs []string, cfg StageConfig) *StagePlan {
	plan := &StagePlan{
		Pools: []PoolDraft{{
			Key: swissPoolKey, Name: "Swiss", Position: 0,
			Kind: "group", AdvanceCount: cfg.AdvancePerPool,
		}},
	}

	order := make([]swissEntry, 0, len(entryIDs))
	slotKeyByEntry := map[string]string{}

	for position, entryID := range entryIDs {
		key := fmt.Sprintf("slot:%d", position)
		slotKeyByEntry[entryID] = key
		plan.Slots = append(plan.Slots, SlotDraft{
			Key: key, PoolKey: swissPoolKey, Round: 0, Position: position,
			Label: fmt.Sprintf("S%d", position+1),
			Entry: entryID, SourceType: "direct", SourcePosition: position + 1,
		})
		order = append(order, swissEntry{Entry: entryID})
	}

	if len(entryIDs)%2 == 1 {
		plan.Slots = append(plan.Slots, SlotDraft{
			Key: swissByeSlotKey, PoolKey: swissPoolKey,
			Round: 0, Position: len(entryIDs),
			Label: "Bye", SourceType: "bye",
		})
	}

	if len(entryIDs) < 2 {
		return plan
	}

	// Round one has no table to read, so every entry is on nothing and the
	// fold runs on the seeding alone: 1 plays the first of the bottom half.
	drawn := pairSwiss(order, map[string]bool{}, map[string]bool{})
	plan.Fixtures = swissRoundFixtures(drawn, 0, slotKeyByEntry)
	return plan
}

// swissRoundFixtures turns a drawn round into fixture drafts.
func swissRoundFixtures(drawn swissPairing, round int, slotKeyByEntry map[string]string) []FixtureDraft {
	fixtures := make([]FixtureDraft, 0, len(drawn.Pairs)+1)

	for position, pair := range drawn.Pairs {
		fixtures = append(fixtures, FixtureDraft{
			Key:         fmt.Sprintf("fixture:%d:%d", round, position),
			PoolKey:     swissPoolKey,
			Round:       round,
			Position:    position,
			Code:        fmt.Sprintf("R%d.%d", round+1, position+1),
			HomeSlotKey: slotKeyByEntry[pair[0]],
			AwaySlotKey: slotKeyByEntry[pair[1]],
			Status:      "ready",
		})
	}

	// The bye goes last, so the numbering of the matches actually played reads
	// 1..n down a printed sheet.
	if drawn.Bye != "" {
		position := len(drawn.Pairs)
		fixtures = append(fixtures, FixtureDraft{
			Key:         fmt.Sprintf("fixture:%d:%d", round, position),
			PoolKey:     swissPoolKey,
			Round:       round,
			Position:    position,
			Code:        fmt.Sprintf("R%d.bye", round+1),
			HomeSlotKey: slotKeyByEntry[drawn.Bye],
			AwaySlotKey: swissByeSlotKey,
			Status:      "ready",
		})
	}
	return fixtures
}

// ---------------------------------------------------------------------------
// drawing the next round, against the database
// ---------------------------------------------------------------------------

// swissState is everything one Swiss pool's next draw depends on.
type swissState struct {
	Pool *core.Record
	// SlotByEntry maps an entry to the slot it occupies in the table.
	SlotByEntry map[string]string
	ByeSlot     string
	Rounds      int
	// Fixtures, in round and position order.
	Fixtures []*core.Record
}

// loadSwissState gathers a Swiss stage's pool, its participants and everything
// already drawn. Returns nil when the stage is not a Swiss one.
func loadSwissState(app core.App, stage *core.Record) (*swissState, error) {
	if stage.GetString("format") != "swiss" {
		return nil, nil
	}
	cfg, err := stageConfig(stage)
	if err != nil {
		return nil, err
	}

	pools, err := app.FindRecordsByFilter(
		"pools", "stage = {:stage}", "position", 0, 0,
		dbx.Params{"stage": stage.Id},
	)
	if err != nil {
		return nil, err
	}
	if len(pools) == 0 {
		return nil, nil // nothing generated yet
	}
	pool := pools[0]

	slots, err := app.FindRecordsByFilter(
		"slots", "pool = {:pool} && round = 0", "position", 0, 0,
		dbx.Params{"pool": pool.Id},
	)
	if err != nil {
		return nil, err
	}

	state := &swissState{Pool: pool, SlotByEntry: map[string]string{}}
	for _, slot := range slots {
		if slot.GetString("source_type") == "bye" {
			state.ByeSlot = slot.Id
			continue
		}
		if entryID := slot.GetString("entry"); entryID != "" {
			state.SlotByEntry[entryID] = slot.Id
		}
	}
	state.Rounds = swissRoundCount(cfg.Rounds, len(state.SlotByEntry))

	state.Fixtures, err = app.FindRecordsByFilter(
		"fixtures", "pool = {:pool}", "round, position", 0, 0,
		dbx.Params{"pool": pool.Id},
	)
	if err != nil {
		return nil, err
	}
	return state, nil
}

// completeRounds returns the number of rounds that have been drawn and the
// index of the last one whose every fixture is settled (-1 when none is).
//
// It stops at the first gap: a round nobody has drawn cannot be behind a round
// that is finished.
func (s *swissState) completeRounds() (drawn, complete int) {
	byRound := map[int][]*core.Record{}
	for _, f := range s.Fixtures {
		byRound[f.GetInt("round")] = append(byRound[f.GetInt("round")], f)
	}

	complete = -1
	for r := 0; ; r++ {
		fixtures, ok := byRound[r]
		if !ok {
			return r, complete
		}
		drawn = r + 1
		settled := true
		for _, f := range fixtures {
			if !isSettled(f.GetString("status")) {
				settled = false
				break
			}
		}
		if !settled {
			return drawn, complete
		}
		complete = r
	}
}

// swissRoundIsPlayed reports whether anybody has touched a round: a result
// entered, a match started, a fixture cancelled — or a result entered and then
// taken back off again, which the log remembers and the fixture does not.
//
// That last case is the reason this consults the log at all. A redraw deletes
// the round it replaces, `fixture_events` cascades with the fixture, and a
// score that was cleared for re-entry is a match that was almost certainly
// played. Wiping it because the fixture happens to look untouched is exactly
// the mistake worth one extra query on a path that runs only when a round is
// about to be redrawn.
//
// A bye deliberately does not count. It settles itself the instant it is
// written, and treating that as "played" would freeze a round the moment it
// was drawn — including against the correction that should have redrawn it.
func swissRoundIsPlayed(app core.App, fixtures []*core.Record, round int) bool {
	ids := []string{}
	for _, f := range fixtures {
		if f.GetInt("round") != round {
			continue
		}
		switch f.GetString("status") {
		case "finished", "walkover", "live", "cancelled":
			return true
		}
		ids = append(ids, f.Id)
	}
	return hasHistory(app, ids)
}

// hasHistory reports whether any of these fixtures has ever carried a result.
func hasHistory(app core.App, fixtureIDs []string) bool {
	if len(fixtureIDs) == 0 {
		return false
	}
	clauses := make([]string, 0, len(fixtureIDs))
	params := dbx.Params{}
	for i, id := range fixtureIDs {
		key := fmt.Sprintf("f%d", i)
		clauses = append(clauses, "fixture = {:"+key+"}")
		params[key] = id
	}

	events, err := app.FindRecordsByFilter(
		"fixture_events", strings.Join(clauses, " || "), "", 1, 0, params,
	)
	if err != nil {
		// Unreadable log: assume the round was played. Refusing to redraw
		// leaves a stale pairing on the wall; redrawing anyway throws away a
		// result somebody typed in.
		return true
	}
	return len(events) > 0
}

// SwissDraw is the outcome of asking for a round.
type SwissDraw struct {
	// Round written, or -1 when there was nothing to write.
	Round int `json:"round"`
	// Rematch says the field had run out of fresh opponents and the round
	// repeats a meeting. Rare, and worth saying out loud when it happens.
	Rematch bool `json:"rematch"`
}

// nothingToDraw is what every "leave it alone" path returns.
var nothingToDraw = SwissDraw{Round: -1}

// PairNextRound draws a Swiss stage's next round when it is due, and redraws
// an already-drawn one when a corrected result behind it changed the table.
//
// It is idempotent: the pairing depends only on rounds that are complete, so
// calling it twice in a row writes nothing the second time. That is not a
// nicety — the hook that calls it is re-entered by its own writes the moment
// an odd field's bye settles itself.
func PairNextRound(app core.App, stageID string) (SwissDraw, error) {
	stage, err := app.FindRecordById("stages", stageID)
	if err != nil {
		return nothingToDraw, err
	}
	state, err := loadSwissState(app, stage)
	if err != nil || state == nil {
		return nothingToDraw, err
	}
	if len(state.SlotByEntry) < 2 {
		return nothingToDraw, nil
	}

	_, complete := state.completeRounds()
	next := complete + 1
	if next >= state.Rounds {
		return nothingToDraw, nil // the stage has played out
	}

	// A round is only ever redrawn while nothing from it onwards has been
	// played. Once somebody has a result on the sheet, the draw stands whether
	// or not a correction behind it would have produced a different one.
	for round := next; ; round++ {
		if !swissRoundIsDrawn(state.Fixtures, round) {
			break
		}
		if swissRoundIsPlayed(app, state.Fixtures, round) {
			return nothingToDraw, nil
		}
	}

	table, err := swissTable(app, stage, state.Pool, complete)
	if err != nil {
		return nothingToDraw, err
	}
	met, hadBye := swissHistory(state.Fixtures, complete)
	drawn := pairSwiss(table, met, hadBye)
	if len(drawn.Pairs) == 0 && drawn.Bye == "" {
		return nothingToDraw, nil
	}

	if swissSignature(drawn) == swissSignatureOf(state.Fixtures, next) {
		return nothingToDraw, nil // already drawn exactly like this
	}

	if err := writeSwissRound(app, stage, state, next, drawn); err != nil {
		return nothingToDraw, err
	}
	return SwissDraw{Round: next, Rematch: drawn.Rematch}, nil
}

// swissRoundIsDrawn reports whether a round exists yet.
func swissRoundIsDrawn(fixtures []*core.Record, round int) bool {
	for _, f := range fixtures {
		if f.GetInt("round") == round {
			return true
		}
	}
	return false
}

// swissTable ranks the pool as it stood at the end of `throughRound`, using the
// tournament's own tiebreakers. Passing -1 gives everybody nothing, which is
// the round-one draw.
func swissTable(app core.App, stage, pool *core.Record, throughRound int) ([]swissEntry, error) {
	tournament, err := app.FindRecordById("tournaments", stage.GetString("tournament"))
	if err != nil {
		return nil, err
	}
	cfg := scoringConfig(tournament)

	rows, played, err := tallyPool(app, stage, pool, cfg, throughRound, nil)
	if err != nil {
		return nil, err
	}
	rankGroup(rows, cfg.Tiebreakers, 0, played)

	table := make([]swissEntry, 0, len(rows))
	for _, row := range rows {
		table = append(table, swissEntry{Entry: row.Entry, Points: row.Points})
	}
	return table, nil
}

// swissHistory reads who has met whom and who has sat out, from the rounds up
// to and including throughRound.
func swissHistory(fixtures []*core.Record, throughRound int) (met, hadBye map[string]bool) {
	met, hadBye = map[string]bool{}, map[string]bool{}
	for _, f := range fixtures {
		if f.GetInt("round") > throughRound {
			continue
		}
		home, away := f.GetString("home_entry"), f.GetString("away_entry")
		switch {
		case home != "" && away != "":
			met[pairKey(home, away)] = true
		case home != "":
			hadBye[home] = true
		case away != "":
			hadBye[away] = true
		}
	}
	return met, hadBye
}

// swissSignature is a draw reduced to what makes it that draw: who plays whom,
// regardless of sides or order, plus whoever sits out.
func swissSignature(drawn swissPairing) string {
	keys := make([]string, 0, len(drawn.Pairs)+1)
	for _, pair := range drawn.Pairs {
		keys = append(keys, pairKey(pair[0], pair[1]))
	}
	if drawn.Bye != "" {
		keys = append(keys, "bye|"+drawn.Bye)
	}
	sort.Strings(keys)
	return strings.Join(keys, ",")
}

func swissSignatureOf(fixtures []*core.Record, round int) string {
	keys := []string{}
	for _, f := range fixtures {
		if f.GetInt("round") != round {
			continue
		}
		home, away := f.GetString("home_entry"), f.GetString("away_entry")
		switch {
		case home != "" && away != "":
			keys = append(keys, pairKey(home, away))
		case home != "":
			keys = append(keys, "bye|"+home)
		case away != "":
			keys = append(keys, "bye|"+away)
		}
	}
	sort.Strings(keys)
	return strings.Join(keys, ",")
}

// writeSwissRound replaces everything from `round` onwards with the new draw.
//
// Rounds after it can only exist here if they were drawn and then invalidated
// by a correction — the guard in PairNextRound has already established that
// none of them has been played.
func writeSwissRound(app core.App, stage *core.Record, state *swissState, round int, drawn swissPairing) error {
	return app.RunInTransaction(func(tx core.App) error {
		for _, f := range state.Fixtures {
			if f.GetInt("round") < round {
				continue
			}
			if err := tx.Delete(f); err != nil {
				return err
			}
		}

		collection, err := tx.FindCollectionByNameOrId("fixtures")
		if err != nil {
			return err
		}

		write := func(position int, code, home, away string) error {
			r := core.NewRecord(collection)
			r.Set("tournament", stage.GetString("tournament"))
			r.Set("stage", stage.Id)
			r.Set("pool", state.Pool.Id)
			r.Set("round", round)
			r.Set("position", position)
			r.Set("code", code)
			r.Set("home_slot", state.SlotByEntry[home])
			r.Set("home_entry", home)
			if away != "" {
				r.Set("away_slot", state.SlotByEntry[away])
				r.Set("away_entry", away)
			} else {
				// The empty chair. settleBye reads the slot's source_type and
				// decides the fixture the moment it is written.
				r.Set("away_slot", state.ByeSlot)
			}
			r.Set("status", "ready")
			return tx.Save(r)
		}

		for position, pair := range drawn.Pairs {
			code := fmt.Sprintf("R%d.%d", round+1, position+1)
			if err := write(position, code, pair[0], pair[1]); err != nil {
				return err
			}
		}
		if drawn.Bye != "" {
			if state.ByeSlot == "" {
				return fmt.Errorf("round %d needs a bye and the pool has no bye slot", round+1)
			}
			code := fmt.Sprintf("R%d.bye", round+1)
			if err := write(len(drawn.Pairs), code, drawn.Bye, ""); err != nil {
				return err
			}
		}
		return nil
	})
}

// SwissRoundsOutstanding reports whether a Swiss pool still owes rounds nobody
// has drawn. A pool whose fixtures are all settled is NOT finished while this
// is true — which is what keeps a playoff from being seeded off a table that
// is two rounds short.
func SwissRoundsOutstanding(app core.App, pool *core.Record) (bool, error) {
	stage, err := app.FindRecordById("stages", pool.GetString("stage"))
	if err != nil {
		return false, err
	}
	state, err := loadSwissState(app, stage)
	if err != nil || state == nil {
		return false, err
	}
	drawn, _ := state.completeRounds()
	return drawn < state.Rounds, nil
}
