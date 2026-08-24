package tournament

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// ---------------------------------------------------------------------------
// plan drafts — what a generator emits before anything has a record id
// ---------------------------------------------------------------------------

type PoolDraft struct {
	Key          string `json:"key"`
	Name         string `json:"name"`
	Position     int    `json:"position"`
	Kind         string `json:"kind"`
	AdvanceCount int    `json:"advance_count"`
}

type SlotDraft struct {
	Key              string `json:"key"`
	PoolKey          string `json:"pool_key"`
	Round            int    `json:"round"`
	Position         int    `json:"position"`
	Label            string `json:"label"`
	Entry            string `json:"entry"`
	SourceType       string `json:"source_type"`
	SourceFixtureKey string `json:"source_fixture_key"`
	SourcePool       string `json:"source_pool"`
	SourceStage      string `json:"source_stage"`
	SourcePosition   int    `json:"source_position"`
}

type FixtureDraft struct {
	Key         string `json:"key"`
	PoolKey     string `json:"pool_key"`
	Round       int    `json:"round"`
	Position    int    `json:"position"`
	Code        string `json:"code"`
	HomeSlotKey string `json:"home_slot_key"`
	AwaySlotKey string `json:"away_slot_key"`
	Status      string `json:"status"`
}

// StagePlan is everything one stage needs, ready to be written in a single
// transaction. It is also exactly what the dry-run endpoint returns, so the
// organiser previews the real thing rather than a reimplementation of it.
type StagePlan struct {
	Pools    []PoolDraft    `json:"pools"`
	Slots    []SlotDraft    `json:"slots"`
	Fixtures []FixtureDraft `json:"fixtures"`
}

// SeedSource describes a stage seeded from an earlier stage's tables rather
// than from raw entries — the "groups feed the playoff" wiring.
type SeedSource struct {
	Stage          string `json:"stage"`
	AdvancePerPool int    `json:"advancePerPool"`
}

type StageConfig struct {
	PoolCount      int         `json:"poolCount"`
	AdvancePerPool int         `json:"advancePerPool"`
	Legs           int         `json:"legs"`
	ThirdPlace     bool        `json:"thirdPlace"`
	SeedFrom       *SeedSource `json:"seedFrom"`
}

func stageConfig(stage *core.Record) (StageConfig, error) {
	cfg := StageConfig{}
	raw := stage.GetString("config")
	if raw == "" || raw == "null" {
		return cfg, nil
	}
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return cfg, fmt.Errorf("stage config is not valid JSON: %w", err)
	}
	return cfg, nil
}

// ---------------------------------------------------------------------------
// pure helpers
// ---------------------------------------------------------------------------

func nextPowerOfTwo(n int) int {
	size := 1
	for size < n {
		size *= 2
	}
	return size
}

// seedOrder returns the sequence of seeds reading down round 1, so that the top
// two seeds can only meet in the final.
//
//	size 4 -> [1 4 2 3]
//	size 8 -> [1 8 4 5 2 7 3 6]
func seedOrder(size int) []int {
	order := []int{1}
	for len(order) < size {
		mirror := len(order)*2 + 1
		next := make([]int, 0, len(order)*2)
		for _, seed := range order {
			next = append(next, seed, mirror-seed)
		}
		order = next
	}
	return order
}

// poolName counts A, B, ... Z, AA, AB, ...
func poolName(index int) string {
	name := ""
	n := index
	for {
		name = string(rune('A'+(n%26))) + name
		n = n/26 - 1
		if n < 0 {
			break
		}
	}
	return name
}

// snakeDistribute spreads seeds evenly across pools: with 3 pools, seeds 1..6
// land as A[1,6] B[2,5] C[3,4].
func snakeDistribute(entryIDs []string, poolCount int) [][]string {
	pools := make([][]string, poolCount)
	for i, id := range entryIDs {
		row := i / poolCount
		offset := i % poolCount
		col := offset
		if row%2 == 1 {
			col = poolCount - 1 - offset
		}
		pools[col] = append(pools[col], id)
	}
	return pools
}

// circleRounds pairs every entry with every other exactly once across n-1
// rounds, with nobody playing twice in a round. An empty string is a bye.
func circleRounds(items []string) [][][2]string {
	list := append([]string{}, items...)
	if len(list)%2 == 1 {
		list = append(list, "")
	}
	n := len(list)
	if n < 2 {
		return nil
	}

	rounds := make([][][2]string, 0, n-1)
	current := append([]string{}, list...)

	for r := 0; r < n-1; r++ {
		pairs := make([][2]string, 0, n/2)
		for i := 0; i < n/2; i++ {
			pairs = append(pairs, [2]string{current[i], current[n-1-i]})
		}
		rounds = append(rounds, pairs)

		// pin the first entry, rotate the rest
		rest := append([]string{}, current[1:]...)
		last := rest[len(rest)-1]
		rest = append([]string{last}, rest[:len(rest)-1]...)
		current = append([]string{current[0]}, rest...)
	}
	return rounds
}

// fixtureCode is the handle shouted across the hall: "QF2", "SF1", "F".
func fixtureCode(fixturesInRound, index int) string {
	var prefix string
	switch fixturesInRound {
	case 1:
		return "F"
	case 2:
		prefix = "SF"
	case 4:
		prefix = "QF"
	default:
		prefix = fmt.Sprintf("R%d", fixturesInRound*2)
	}
	return fmt.Sprintf("%s%d", prefix, index+1)
}

// ---------------------------------------------------------------------------
// single elimination
// ---------------------------------------------------------------------------

// bracketSeed is one round-1 position: either a known entry, or a placeholder
// pointing at a table in an earlier stage.
type bracketSeed struct {
	Entry      string
	Label      string
	SourceType string
	SourcePool string
	SourceRank int
}

// PlanSingleElimination builds a full bracket.
//
// seeds must already be in seed order (best first). Missing positions become
// byes, which the top seeds receive first. A completely empty seed list is
// legal and yields the same bracket shape with every slot unresolved — which
// is exactly what the projector needs while an earlier stage is still running.
func PlanSingleElimination(seeds []bracketSeed, cfg StageConfig) *StagePlan {
	size := nextPowerOfTwo(max(len(seeds), 2))
	const poolKey = "pool:main"

	plan := &StagePlan{
		Pools: []PoolDraft{{
			Key: poolKey, Name: "Main", Position: 0, Kind: "winners", AdvanceCount: 1,
		}},
	}

	// --- round 0: seeded entry slots ---
	for position, seed := range seedOrder(size) {
		draft := SlotDraft{
			Key:            fmt.Sprintf("slot:0:%d", position),
			PoolKey:        poolKey,
			Round:          0,
			Position:       position,
			SourceType:     "bye",
			Label:          "Bye",
			SourcePosition: seed,
		}

		if seed-1 < len(seeds) {
			s := seeds[seed-1]
			draft.Entry = s.Entry
			draft.SourceType = s.SourceType
			draft.Label = s.Label
			if s.SourcePool != "" {
				draft.SourcePool = s.SourcePool
				draft.SourcePosition = s.SourceRank
			}
		}
		plan.Slots = append(plan.Slots, draft)
	}

	// --- rounds 1..n: fixtures, and the winner slots they feed ---
	round := 0
	slotsInRound := size

	for slotsInRound > 1 {
		fixturesInRound := slotsInRound / 2

		for i := 0; i < fixturesInRound; i++ {
			code := fixtureCode(fixturesInRound, i)
			fixtureKey := fmt.Sprintf("fixture:%d:%d", round, i)

			plan.Fixtures = append(plan.Fixtures, FixtureDraft{
				Key:         fixtureKey,
				PoolKey:     poolKey,
				Round:       round,
				Position:    i,
				Code:        code,
				HomeSlotKey: fmt.Sprintf("slot:%d:%d", round, i*2),
				AwaySlotKey: fmt.Sprintf("slot:%d:%d", round, i*2+1),
				Status:      "pending",
			})

			// The winner's onward slot exists immediately, unresolved.
			plan.Slots = append(plan.Slots, SlotDraft{
				Key:              fmt.Sprintf("slot:%d:%d", round+1, i),
				PoolKey:          poolKey,
				Round:            round + 1,
				Position:         i,
				Label:            "Winner " + code,
				SourceType:       "fixture_winner",
				SourceFixtureKey: fixtureKey,
			})
		}

		round++
		slotsInRound = fixturesInRound
	}

	// --- optional third place fixture ---
	if cfg.ThirdPlace && size >= 4 {
		semiRound := round - 2
		bronzeRound := round - 1
		loserKeys := make([]string, 0, 2)

		for i := 0; i < 2; i++ {
			key := fmt.Sprintf("slot:bronze:%d", i)
			plan.Slots = append(plan.Slots, SlotDraft{
				Key:     key,
				PoolKey: poolKey,
				Round:   bronzeRound,
				// The two finalist slots already hold positions 0 and 1 of this
				// round, so the bronze pair starts at 2. Getting this wrong is
				// invisible in the plan and only fails against the unique index.
				Position:         2 + i,
				Label:            "Loser " + fixtureCode(2, i),
				SourceType:       "fixture_loser",
				SourceFixtureKey: fmt.Sprintf("fixture:%d:%d", semiRound, i),
			})
			loserKeys = append(loserKeys, key)
		}

		plan.Fixtures = append(plan.Fixtures, FixtureDraft{
			Key: "fixture:bronze", PoolKey: poolKey,
			Round: bronzeRound, Position: 1, Code: "3P",
			HomeSlotKey: loserKeys[0], AwaySlotKey: loserKeys[1],
			Status: "pending",
		})
	}

	return plan
}

// ---------------------------------------------------------------------------
// round robin
// ---------------------------------------------------------------------------

// PlanRoundRobin builds round-robin pools. entryIDs must be in seed order;
// entries are snaked across pools so the strong ones do not collide.
func PlanRoundRobin(entryIDs []string, cfg StageConfig) *StagePlan {
	poolCount := max(cfg.PoolCount, 1)
	legs := max(cfg.Legs, 1)

	plan := &StagePlan{}

	for poolIndex, poolEntries := range snakeDistribute(entryIDs, poolCount) {
		poolKey := fmt.Sprintf("pool:%d", poolIndex)
		name := poolName(poolIndex)

		plan.Pools = append(plan.Pools, PoolDraft{
			Key: poolKey, Name: name, Position: poolIndex,
			Kind: "group", AdvanceCount: cfg.AdvancePerPool,
		})

		// One slot per place in the pool, so the table is printable before the
		// draw is final.
		slotKeyByEntry := map[string]string{}
		for position, entryID := range poolEntries {
			key := fmt.Sprintf("slot:%d:%d", poolIndex, position)
			slotKeyByEntry[entryID] = key
			plan.Slots = append(plan.Slots, SlotDraft{
				Key: key, PoolKey: poolKey, Round: 0, Position: position,
				Label: fmt.Sprintf("%s%d", name, position+1),
				Entry: entryID, SourceType: "direct", SourcePosition: position + 1,
			})
		}

		schedule := circleRounds(poolEntries)
		for leg := 0; leg < legs; leg++ {
			for roundIndex, pairs := range schedule {
				round := leg*len(schedule) + roundIndex
				position := 0

				for _, pair := range pairs {
					a, b := pair[0], pair[1]
					if a == "" || b == "" {
						continue // a bye is not played
					}
					home, away := a, b
					if leg%2 == 1 {
						home, away = b, a // swap sides on the return leg
					}

					plan.Fixtures = append(plan.Fixtures, FixtureDraft{
						Key:         fmt.Sprintf("fixture:%d:%d:%d", poolIndex, round, position),
						PoolKey:     poolKey,
						Round:       round,
						Position:    position,
						Code:        fmt.Sprintf("%s%d.%d", name, round+1, position+1),
						HomeSlotKey: slotKeyByEntry[home],
						AwaySlotKey: slotKeyByEntry[away],
						Status:      "ready",
					})
					position++
				}
			}
		}
	}

	return plan
}

// ---------------------------------------------------------------------------
// planning against the database
// ---------------------------------------------------------------------------

// seededEntries returns a stage's tournament entries in seed order. Entries
// without a seed sort last, alphabetically, so the order is always stable.
func seededEntries(app core.App, tournamentID string) ([]*core.Record, error) {
	entries, err := app.FindRecordsByFilter(
		"entries",
		"tournament = {:t} && (status = 'active' || status = 'checked_in' || status = 'registered')",
		"", 0, 0,
		dbx.Params{"t": tournamentID},
	)
	if err != nil {
		return nil, err
	}

	sort.SliceStable(entries, func(i, j int) bool {
		si, sj := entries[i].GetInt("seed"), entries[j].GetInt("seed")
		switch {
		case si > 0 && sj > 0:
			return si < sj
		case si > 0:
			return true
		case sj > 0:
			return false
		default:
			return entries[i].GetString("name") < entries[j].GetString("name")
		}
	})
	return entries, nil
}

// qualifierSeeds builds the round-1 seeds of a bracket fed by an earlier
// stage's pool tables.
//
// Qualifiers are ordered by rank first, then by pool: A1 B1 C1 D1 A2 B2 C2 D2.
// Combined with the standard bracket order that guarantees no two entries from
// the same pool meet in round 1 (A1 draws D2, D1 draws A2, and so on).
func qualifierSeeds(app core.App, source SeedSource) ([]bracketSeed, error) {
	pools, err := app.FindRecordsByFilter(
		"pools", "stage = {:stage}", "position", 0, 0,
		dbx.Params{"stage": source.Stage},
	)
	if err != nil {
		return nil, err
	}
	if len(pools) == 0 {
		return nil, fmt.Errorf("source stage has no pools to qualify from")
	}

	perPool := source.AdvancePerPool
	if perPool <= 0 {
		perPool = pools[0].GetInt("advance_count")
	}
	if perPool <= 0 {
		perPool = 2
	}

	seeds := make([]bracketSeed, 0, len(pools)*perPool)
	for rank := 1; rank <= perPool; rank++ {
		for _, pool := range pools {
			seeds = append(seeds, bracketSeed{
				SourceType: "pool_rank",
				SourcePool: pool.Id,
				SourceRank: rank,
				Label:      fmt.Sprintf("%d. %s", rank, pool.GetString("name")),
			})
		}
	}
	return seeds, nil
}

// PlanStage produces the plan for a stage without writing anything.
func PlanStage(app core.App, stage *core.Record) (*StagePlan, error) {
	cfg, err := stageConfig(stage)
	if err != nil {
		return nil, err
	}

	format := stage.GetString("format")

	// A stage fed by an earlier stage never touches the entry list.
	if cfg.SeedFrom != nil {
		if format != "single_elim" && format != "double_elim" {
			return nil, fmt.Errorf(
				"seedFrom is only supported for knockout stages, got %q", format)
		}
		seeds, err := qualifierSeeds(app, *cfg.SeedFrom)
		if err != nil {
			return nil, err
		}
		if format == "double_elim" {
			return PlanDoubleElimination(seeds, cfg), nil
		}
		return PlanSingleElimination(seeds, cfg), nil
	}

	entries, err := seededEntries(app, stage.GetString("tournament"))
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.Id
	}

	switch format {
	case "round_robin":
		return PlanRoundRobin(ids, cfg), nil
	case "single_elim", "double_elim":
		seeds := make([]bracketSeed, len(ids))
		for i, id := range ids {
			seeds[i] = bracketSeed{
				Entry:      id,
				SourceType: "direct",
				Label:      entries[i].GetString("name"),
			}
		}
		if format == "double_elim" {
			return PlanDoubleElimination(seeds, cfg), nil
		}
		return PlanSingleElimination(seeds, cfg), nil
	default:
		return nil, fmt.Errorf("no generator for format %q yet", format)
	}
}

// CommitPlan writes a plan into the database, replacing whatever the stage
// currently holds.
//
// It refuses to run if any fixture in the stage has already been played —
// regenerating would silently destroy results. Clear them deliberately first.
func CommitPlan(app core.App, stage *core.Record, plan *StagePlan) error {
	existing, err := app.FindRecordsByFilter(
		"fixtures", "stage = {:stage}", "", 0, 0,
		dbx.Params{"stage": stage.Id},
	)
	if err != nil {
		return err
	}
	for _, f := range existing {
		if isSettled(f.GetString("status")) {
			return fmt.Errorf(
				"stage already has played fixtures (%s); refusing to regenerate",
				f.GetString("code"),
			)
		}
	}

	return app.RunInTransaction(func(tx core.App) error {
		if err := clearStage(tx, stage.Id, existing); err != nil {
			return err
		}

		poolIDs := map[string]string{}
		slotIDs := map[string]string{}
		fixtureIDs := map[string]string{}

		poolsCollection, err := tx.FindCollectionByNameOrId("pools")
		if err != nil {
			return err
		}
		for _, draft := range plan.Pools {
			r := core.NewRecord(poolsCollection)
			r.Set("stage", stage.Id)
			r.Set("name", draft.Name)
			r.Set("position", draft.Position)
			r.Set("kind", draft.Kind)
			r.Set("advance_count", draft.AdvanceCount)
			if err := tx.Save(r); err != nil {
				return err
			}
			poolIDs[draft.Key] = r.Id
		}

		// Slots first, without source_fixture: fixtures do not exist yet.
		slotsCollection, err := tx.FindCollectionByNameOrId("slots")
		if err != nil {
			return err
		}
		for _, draft := range plan.Slots {
			r := core.NewRecord(slotsCollection)
			r.Set("stage", stage.Id)
			r.Set("pool", poolIDs[draft.PoolKey])
			r.Set("round", draft.Round)
			r.Set("position", draft.Position)
			r.Set("label", draft.Label)
			r.Set("entry", draft.Entry)
			r.Set("source_type", draft.SourceType)
			r.Set("source_pool", draft.SourcePool)
			r.Set("source_stage", draft.SourceStage)
			r.Set("source_position", draft.SourcePosition)
			if err := tx.Save(r); err != nil {
				return err
			}
			slotIDs[draft.Key] = r.Id
		}

		fixturesCollection, err := tx.FindCollectionByNameOrId("fixtures")
		if err != nil {
			return err
		}
		for _, draft := range plan.Fixtures {
			r := core.NewRecord(fixturesCollection)
			r.Set("tournament", stage.GetString("tournament"))
			r.Set("stage", stage.Id)
			r.Set("pool", poolIDs[draft.PoolKey])
			r.Set("round", draft.Round)
			r.Set("position", draft.Position)
			r.Set("code", draft.Code)
			r.Set("home_slot", slotIDs[draft.HomeSlotKey])
			r.Set("away_slot", slotIDs[draft.AwaySlotKey])
			// Denormalise the entries the slots already know about.
			home := entryOfSlot(tx, slotIDs[draft.HomeSlotKey])
			away := entryOfSlot(tx, slotIDs[draft.AwaySlotKey])
			r.Set("home_entry", home)
			r.Set("away_entry", away)

			// A match with both sides already known is playable, and has to say
			// so: "ready" is what the projector's Next up panel reads and what
			// tells the organiser which matches can start. A bracket drawn
			// straight from the entry list knows every first-round pairing at
			// the moment it is written — nothing later comes along to promote
			// it, because nothing later resolves.
			status := draft.Status
			if status == "pending" && home != "" && away != "" {
				status = "ready"
			}
			r.Set("status", status)

			if err := tx.Save(r); err != nil {
				return err
			}
			fixtureIDs[draft.Key] = r.Id
		}

		// Second pass: now that fixtures have ids, close the cycle.
		for _, draft := range plan.Slots {
			if draft.SourceFixtureKey == "" {
				continue
			}
			r, err := tx.FindRecordById("slots", slotIDs[draft.Key])
			if err != nil {
				return err
			}
			r.Set("source_fixture", fixtureIDs[draft.SourceFixtureKey])
			if err := tx.Save(r); err != nil {
				return err
			}
		}

		return nil
	})
}

// entryOfSlot reads a slot's resolved entry, or "" if it has none yet.
func entryOfSlot(app core.App, slotID string) string {
	if slotID == "" {
		return ""
	}
	slot, err := app.FindRecordById("slots", slotID)
	if err != nil {
		return ""
	}
	return slot.GetString("entry")
}

// clearStage removes a stage's generated structure. Order matters: fixtures
// reference slots, and slots reference fixtures.
func clearStage(app core.App, stageID string, fixtures []*core.Record) error {
	for _, f := range fixtures {
		if err := app.Delete(f); err != nil {
			return err
		}
	}
	for _, collection := range []string{"slots", "standings", "pools"} {
		records, err := app.FindRecordsByFilter(
			collection, "stage = {:stage}", "", 0, 0,
			dbx.Params{"stage": stageID},
		)
		if err != nil {
			return err
		}
		for _, r := range records {
			if err := app.Delete(r); err != nil {
				return err
			}
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// double elimination
// ---------------------------------------------------------------------------

// PlanDoubleElimination builds a winners bracket, the losers bracket that
// catches everyone it knocks out, and the grand final between the two.
//
// The shape is the standard one. The winners bracket is an ordinary knockout.
// The losers bracket alternates:
//
//	minor round — the survivors of the losers bracket play each other
//	major round — each survivor meets somebody just dropped by the winners
//
// so a team eliminated from the winners bracket always lands in the next major
// round, and the losers bracket halves itself in between. With a bracket of
// size S that is 2·log2(S) − 2 losers rounds, and 2S − 2 matches in total.
//
// Losers are fed into major rounds in reverse order. That is a heuristic, not
// a guarantee: it makes an immediate rematch between two teams that just
// played in the winners bracket unlikely rather than impossible. Doing it
// properly means tracking who has met whom, which is the pairing problem the
// Swiss generator has to solve anyway — not this one.
func PlanDoubleElimination(seeds []bracketSeed, cfg StageConfig) *StagePlan {
	size := nextPowerOfTwo(max(len(seeds), 2))

	rounds := 0
	for 1<<rounds < size {
		rounds++
	}

	const winners = "pool:winners"
	const losers = "pool:losers"
	const final = "pool:final"

	plan := &StagePlan{Pools: []PoolDraft{
		{Key: winners, Name: "Winners", Position: 0, Kind: "winners", AdvanceCount: 1},
		{Key: losers, Name: "Losers", Position: 1, Kind: "losers", AdvanceCount: 1},
		{Key: final, Name: "Final", Position: 2, Kind: "final", AdvanceCount: 1},
	}}

	wbSlot := func(round, position int) string {
		return fmt.Sprintf("slot:w:%d:%d", round, position)
	}
	lbSlot := func(round, position int) string {
		return fmt.Sprintf("slot:l:%d:%d", round, position)
	}

	// --- the winners bracket, seeded exactly like a single elimination ---
	for position, seed := range seedOrder(size) {
		draft := SlotDraft{
			Key:            wbSlot(0, position),
			PoolKey:        winners,
			Round:          0,
			Position:       position,
			SourceType:     "bye",
			Label:          "Bye",
			SourcePosition: seed,
		}
		if seed-1 < len(seeds) {
			s := seeds[seed-1]
			draft.Entry = s.Entry
			draft.SourceType = s.SourceType
			draft.Label = s.Label
			if s.SourcePool != "" {
				draft.SourcePool = s.SourcePool
				draft.SourcePosition = s.SourceRank
			}
		}
		plan.Slots = append(plan.Slots, draft)
	}

	// wbFixtures[r] holds the keys of round r, so the losers bracket can name
	// the matches it collects its entrants from.
	wbFixtures := make([][]string, rounds)

	for round := 0; round < rounds; round++ {
		count := size >> (round + 1)
		wbFixtures[round] = make([]string, count)

		for i := 0; i < count; i++ {
			key := fmt.Sprintf("fixture:w:%d:%d", round, i)
			wbFixtures[round][i] = key
			code := fmt.Sprintf("W%d.%d", round+1, i+1)
			if count == 1 {
				code = "WF" // the winners final; its loser drops to the LB final
			}

			plan.Fixtures = append(plan.Fixtures, FixtureDraft{
				Key:         key,
				PoolKey:     winners,
				Round:       round,
				Position:    i,
				Code:        code,
				HomeSlotKey: wbSlot(round, i*2),
				AwaySlotKey: wbSlot(round, i*2+1),
				Status:      "pending",
			})

			plan.Slots = append(plan.Slots, SlotDraft{
				Key:              wbSlot(round+1, i),
				PoolKey:          winners,
				Round:            round + 1,
				Position:         i,
				Label:            "Winner " + code,
				SourceType:       "fixture_winner",
				SourceFixtureKey: key,
			})
		}
	}

	// --- the losers bracket ---
	//
	// Round 0 is a minor round fed entirely by the first winners round; every
	// odd round after it is a major round, and every even one a minor.
	lbRounds := 2*rounds - 2
	lbFixtures := make([][]string, max(lbRounds, 0))

	for round := 0; round < lbRounds; round++ {
		major := round%2 == 1
		var count int

		switch {
		case round == 0:
			count = size / 4
		case major:
			count = len(lbFixtures[round-1])
		default:
			count = len(lbFixtures[round-1]) / 2
		}
		if count == 0 {
			break
		}
		lbFixtures[round] = make([]string, count)

		for i := 0; i < count; i++ {
			// Where this match's two sides come from.
			switch {
			case round == 0:
				// Two fresh losers out of the first winners round.
				for side := 0; side < 2; side++ {
					source := wbFixtures[0][i*2+side]
					plan.Slots = append(plan.Slots, SlotDraft{
						Key:              lbSlot(0, i*2+side),
						PoolKey:          losers,
						Round:            0,
						Position:         i*2 + side,
						Label:            "Loser W1." + fmt.Sprint(i*2+side+1),
						SourceType:       "fixture_loser",
						SourceFixtureKey: source,
					})
				}
			case major:
				// A survivor, and somebody just dropped by the winners bracket.
				wbRound := (round + 1) / 2
				dropped := wbFixtures[wbRound][count-1-i] // reversed: see above
				droppedCode := fmt.Sprintf("W%d.%d", wbRound+1, count-i)
				if len(wbFixtures[wbRound]) == 1 {
					droppedCode = "WF"
				}

				plan.Slots = append(plan.Slots,
					SlotDraft{
						Key:              lbSlot(round, i*2),
						PoolKey:          losers,
						Round:            round,
						Position:         i * 2,
						Label:            "Winner " + lbCode(round-1, i, len(lbFixtures[round-1]), lbRounds),
						SourceType:       "fixture_winner",
						SourceFixtureKey: lbFixtures[round-1][i],
					},
					SlotDraft{
						Key:              lbSlot(round, i*2+1),
						PoolKey:          losers,
						Round:            round,
						Position:         i*2 + 1,
						Label:            "Loser " + droppedCode,
						SourceType:       "fixture_loser",
						SourceFixtureKey: dropped,
					},
				)
			default:
				// Two survivors of the round before.
				for side := 0; side < 2; side++ {
					previous := i*2 + side
					plan.Slots = append(plan.Slots, SlotDraft{
						Key:      lbSlot(round, previous),
						PoolKey:  losers,
						Round:    round,
						Position: previous,
						Label: "Winner " + lbCode(
							round-1, previous, len(lbFixtures[round-1]), lbRounds),
						SourceType:       "fixture_winner",
						SourceFixtureKey: lbFixtures[round-1][previous],
					})
				}
			}

			key := fmt.Sprintf("fixture:l:%d:%d", round, i)
			lbFixtures[round][i] = key
			plan.Fixtures = append(plan.Fixtures, FixtureDraft{
				Key:         key,
				PoolKey:     losers,
				Round:       round,
				Position:    i,
				Code:        lbCode(round, i, count, lbRounds),
				HomeSlotKey: lbSlot(round, i*2),
				AwaySlotKey: lbSlot(round, i*2+1),
				Status:      "pending",
			})
		}
	}

	// --- the grand final ---
	if rounds > 0 && lbRounds > 0 && len(lbFixtures[lbRounds-1]) > 0 {
		winnersFinal := wbFixtures[rounds-1][0]
		losersFinal := lbFixtures[lbRounds-1][0]

		plan.Slots = append(plan.Slots,
			SlotDraft{
				Key: "slot:gf:0", PoolKey: final, Round: 0, Position: 0,
				Label: "Winner WF", SourceType: "fixture_winner",
				SourceFixtureKey: winnersFinal,
			},
			SlotDraft{
				Key: "slot:gf:1", PoolKey: final, Round: 0, Position: 1,
				Label: "Winner LF", SourceType: "fixture_winner",
				SourceFixtureKey: losersFinal,
			},
		)
		plan.Fixtures = append(plan.Fixtures, FixtureDraft{
			Key: "fixture:gf", PoolKey: final, Round: 0, Position: 0,
			Code: "GF", HomeSlotKey: "slot:gf:0", AwaySlotKey: "slot:gf:1",
			Status: "pending",
		})
	}

	return plan
}

// lbCode is the handle for a losers-bracket match: "L2.3", or "LF" for the one
// that decides who meets the winners bracket in the grand final.
func lbCode(round, index, inRound, lbRounds int) string {
	if round == lbRounds-1 && inRound == 1 {
		return "LF"
	}
	return fmt.Sprintf("L%d.%d", round+1, index+1)
}
