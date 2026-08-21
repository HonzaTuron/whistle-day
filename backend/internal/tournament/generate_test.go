package tournament

import (
	"fmt"
	"testing"
)

func entryIDs(n int) []string {
	ids := make([]string, n)
	for i := range ids {
		ids[i] = fmt.Sprintf("e%d", i+1)
	}
	return ids
}

func directSeeds(n int) []bracketSeed {
	seeds := make([]bracketSeed, n)
	for i, id := range entryIDs(n) {
		seeds[i] = bracketSeed{Entry: id, SourceType: "direct"}
	}
	return seeds
}

// assertPlanIsConsistent checks that a plan is internally wired up: every
// fixture points at slots that exist, and every slot source points at a
// fixture that exists.
func assertPlanIsConsistent(t *testing.T, plan *StagePlan) {
	t.Helper()

	slotKeys := map[string]bool{}
	for _, s := range plan.Slots {
		if slotKeys[s.Key] {
			t.Errorf("duplicate slot key %q", s.Key)
		}
		slotKeys[s.Key] = true
	}
	poolKeys := map[string]bool{}
	for _, p := range plan.Pools {
		poolKeys[p.Key] = true
	}
	fixtureKeys := map[string]bool{}
	for _, f := range plan.Fixtures {
		if fixtureKeys[f.Key] {
			t.Errorf("duplicate fixture key %q", f.Key)
		}
		fixtureKeys[f.Key] = true
	}

	// Slot and fixture identity in the database is (pool, round, position), not
	// the generator's key. A key collision is impossible; a position collision
	// is not, and only shows up when the unique index rejects the write.
	slotPositions := map[string]bool{}
	for _, s := range plan.Slots {
		at := fmt.Sprintf("%s/%d/%d", s.PoolKey, s.Round, s.Position)
		if slotPositions[at] {
			t.Errorf("two slots occupy %s (%q and an earlier one)", at, s.Key)
		}
		slotPositions[at] = true
	}
	fixturePositions := map[string]bool{}
	for _, f := range plan.Fixtures {
		at := fmt.Sprintf("%s/%d/%d", f.PoolKey, f.Round, f.Position)
		if fixturePositions[at] {
			t.Errorf("two fixtures occupy %s (%q and an earlier one)", at, f.Code)
		}
		fixturePositions[at] = true
	}

	for _, f := range plan.Fixtures {
		if !slotKeys[f.HomeSlotKey] {
			t.Errorf("fixture %q home slot %q does not exist", f.Code, f.HomeSlotKey)
		}
		if !slotKeys[f.AwaySlotKey] {
			t.Errorf("fixture %q away slot %q does not exist", f.Code, f.AwaySlotKey)
		}
		if f.HomeSlotKey == f.AwaySlotKey {
			t.Errorf("fixture %q plays a slot against itself", f.Code)
		}
		if f.PoolKey != "" && !poolKeys[f.PoolKey] {
			t.Errorf("fixture %q references unknown pool %q", f.Code, f.PoolKey)
		}
	}
	for _, s := range plan.Slots {
		if s.SourceFixtureKey != "" && !fixtureKeys[s.SourceFixtureKey] {
			t.Errorf("slot %q sources missing fixture %q", s.Key, s.SourceFixtureKey)
		}
	}
}

func TestSeedOrder(t *testing.T) {
	cases := map[int][]int{
		2: {1, 2},
		4: {1, 4, 2, 3},
		8: {1, 8, 4, 5, 2, 7, 3, 6},
	}
	for size, want := range cases {
		got := seedOrder(size)
		if len(got) != len(want) {
			t.Fatalf("seedOrder(%d) length = %d, want %d", size, len(got), len(want))
		}
		for i := range want {
			if got[i] != want[i] {
				t.Errorf("seedOrder(%d)[%d] = %d, want %d", size, i, got[i], want[i])
			}
		}
	}

	// The top two seeds must land in opposite halves.
	order := seedOrder(16)
	var posOne, posTwo int
	for i, s := range order {
		if s == 1 {
			posOne = i
		}
		if s == 2 {
			posTwo = i
		}
	}
	if (posOne < 8) == (posTwo < 8) {
		t.Errorf("seeds 1 and 2 share a half: positions %d and %d", posOne, posTwo)
	}
}

func TestPlanSingleElimination(t *testing.T) {
	plan := PlanSingleElimination(directSeeds(8), StageConfig{})

	if len(plan.Fixtures) != 7 {
		t.Errorf("fixtures = %d, want 7", len(plan.Fixtures))
	}
	if len(plan.Slots) != 15 {
		t.Errorf("slots = %d, want 15", len(plan.Slots))
	}

	want := []string{"QF1", "QF2", "QF3", "QF4", "SF1", "SF2", "F"}
	for i, code := range want {
		if plan.Fixtures[i].Code != code {
			t.Errorf("fixture %d code = %q, want %q", i, plan.Fixtures[i].Code, code)
		}
	}
	assertPlanIsConsistent(t, plan)
}

func TestPlanSingleEliminationByes(t *testing.T) {
	plan := PlanSingleElimination(directSeeds(5), StageConfig{})

	byes := 0
	for _, s := range plan.Slots {
		if s.SourceType == "bye" {
			byes++
		}
	}
	if byes != 3 {
		t.Errorf("byes = %d, want 3", byes)
	}
	if len(plan.Fixtures) != 7 {
		t.Errorf("fixtures = %d, want 7", len(plan.Fixtures))
	}
	assertPlanIsConsistent(t, plan)
}

func TestPlanSingleEliminationEmptyIsStillProjectable(t *testing.T) {
	// The whole point of slots: draw the playoff tree before the stage that
	// feeds it has finished.
	plan := PlanSingleElimination(nil, StageConfig{ThirdPlace: true})

	if len(plan.Fixtures) == 0 {
		t.Fatal("empty seed list produced no fixtures")
	}
	for _, s := range plan.Slots {
		if s.Entry != "" {
			t.Errorf("slot %q has an entry but nothing was seeded", s.Key)
		}
	}
	assertPlanIsConsistent(t, plan)
}

func TestPlanSingleEliminationThirdPlace(t *testing.T) {
	plan := PlanSingleElimination(directSeeds(8), StageConfig{ThirdPlace: true})

	if len(plan.Fixtures) != 8 {
		t.Errorf("fixtures = %d, want 8", len(plan.Fixtures))
	}

	losers := 0
	for _, s := range plan.Slots {
		if s.SourceType == "fixture_loser" {
			losers++
		}
	}
	if losers != 2 {
		t.Errorf("loser slots = %d, want 2", losers)
	}

	found := false
	for _, f := range plan.Fixtures {
		if f.Code == "3P" {
			found = true
		}
	}
	if !found {
		t.Error("no third-place fixture generated")
	}
	assertPlanIsConsistent(t, plan)
}

func TestQualifierSeedingAvoidsSamePoolMeetings(t *testing.T) {
	// Two pools, top two advance: A1 B1 A2 B2 in that order. The bracket must
	// pair A1 with B2 and B1 with A2 — never two teams from the same pool.
	seeds := []bracketSeed{
		{SourceType: "pool_rank", SourcePool: "A", SourceRank: 1, Label: "1. A"},
		{SourceType: "pool_rank", SourcePool: "B", SourceRank: 1, Label: "1. B"},
		{SourceType: "pool_rank", SourcePool: "A", SourceRank: 2, Label: "2. A"},
		{SourceType: "pool_rank", SourcePool: "B", SourceRank: 2, Label: "2. B"},
	}
	plan := PlanSingleElimination(seeds, StageConfig{})

	slotByKey := map[string]SlotDraft{}
	for _, s := range plan.Slots {
		slotByKey[s.Key] = s
	}

	for _, f := range plan.Fixtures {
		if f.Round != 0 {
			continue
		}
		home := slotByKey[f.HomeSlotKey]
		away := slotByKey[f.AwaySlotKey]
		if home.SourcePool == away.SourcePool {
			t.Errorf("%s pairs two teams from pool %s (%s vs %s)",
				f.Code, home.SourcePool, home.Label, away.Label)
		}
	}
	assertPlanIsConsistent(t, plan)
}

func TestCircleRounds(t *testing.T) {
	rounds := circleRounds(entryIDs(4))
	if len(rounds) != 3 {
		t.Fatalf("rounds = %d, want 3", len(rounds))
	}

	// Nobody plays twice inside one round.
	for i, round := range circleRounds(entryIDs(6)) {
		seen := map[string]bool{}
		for _, pair := range round {
			for _, id := range pair {
				if id == "" {
					continue
				}
				if seen[id] {
					t.Errorf("round %d schedules %s twice", i, id)
				}
				seen[id] = true
			}
		}
	}

	// Every pair meets exactly once.
	entries := entryIDs(6)
	met := map[string]int{}
	for _, round := range circleRounds(entries) {
		for _, pair := range round {
			if pair[0] == "" || pair[1] == "" {
				continue
			}
			a, b := pair[0], pair[1]
			if a > b {
				a, b = b, a
			}
			met[a+"-"+b]++
		}
	}
	want := len(entries) * (len(entries) - 1) / 2
	if len(met) != want {
		t.Errorf("distinct pairings = %d, want %d", len(met), want)
	}
	for pair, count := range met {
		if count != 1 {
			t.Errorf("pair %s met %d times, want 1", pair, count)
		}
	}
}

func TestPlanRoundRobin(t *testing.T) {
	plan := PlanRoundRobin(entryIDs(4), StageConfig{})
	if len(plan.Fixtures) != 6 {
		t.Errorf("fixtures = %d, want 6", len(plan.Fixtures))
	}
	if len(plan.Pools) != 1 {
		t.Errorf("pools = %d, want 1", len(plan.Pools))
	}
	assertPlanIsConsistent(t, plan)

	// An odd pool produces no bye fixtures.
	odd := PlanRoundRobin(entryIDs(5), StageConfig{})
	if len(odd.Fixtures) != 10 {
		t.Errorf("odd pool fixtures = %d, want 10", len(odd.Fixtures))
	}
	assertPlanIsConsistent(t, odd)

	// Two legs double the fixture count.
	two := PlanRoundRobin(entryIDs(4), StageConfig{Legs: 2})
	if len(two.Fixtures) != 12 {
		t.Errorf("two-leg fixtures = %d, want 12", len(two.Fixtures))
	}
}

func TestSnakeDistribute(t *testing.T) {
	got := snakeDistribute(entryIDs(6), 3)
	want := [][]string{{"e1", "e6"}, {"e2", "e5"}, {"e3", "e4"}}

	for i := range want {
		for j := range want[i] {
			if got[i][j] != want[i][j] {
				t.Errorf("pool %d slot %d = %s, want %s", i, j, got[i][j], want[i][j])
			}
		}
	}
}

func TestPoolName(t *testing.T) {
	cases := map[int]string{0: "A", 25: "Z", 26: "AA"}
	for index, want := range cases {
		if got := poolName(index); got != want {
			t.Errorf("poolName(%d) = %q, want %q", index, got, want)
		}
	}
}

func TestPlanSingleEliminationThirdPlaceInASmallBracket(t *testing.T) {
	// A four-team bracket puts the bronze match in the same round as the
	// final, where the two finalist slots already sit. This is the case that
	// collided.
	plan := PlanSingleElimination(directSeeds(4), StageConfig{ThirdPlace: true})

	if len(plan.Fixtures) != 4 {
		t.Errorf("fixtures = %d, want 4 (2 semis, final, bronze)", len(plan.Fixtures))
	}
	assertPlanIsConsistent(t, plan)
}
