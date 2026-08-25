package tournament

import (
	"fmt"
	"testing"
)

// table builds a field in table order. Points are handed out in blocks, so
// `table(3, 3, 3, 0, 0, 0)` is six entries, three of them on three points.
func table(points ...int) []swissEntry {
	field := make([]swissEntry, len(points))
	for i, p := range points {
		field[i] = swissEntry{Entry: fmt.Sprintf("e%d", i+1), Points: p}
	}
	return field
}

func level(n int) []swissEntry {
	points := make([]int, n)
	return table(points...)
}

// meetings records who has played whom, in the form pairSwiss reads.
func meetings(pairs ...[2]string) map[string]bool {
	met := map[string]bool{}
	for _, pair := range pairs {
		met[pairKey(pair[0], pair[1])] = true
	}
	return met
}

func formatPairs(drawn swissPairing) []string {
	out := make([]string, 0, len(drawn.Pairs)+1)
	for _, pair := range drawn.Pairs {
		out = append(out, pair[0]+"-"+pair[1])
	}
	if drawn.Bye != "" {
		out = append(out, drawn.Bye+"-bye")
	}
	return out
}

func assertPairs(t *testing.T, drawn swissPairing, want ...string) {
	t.Helper()
	got := formatPairs(drawn)
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
}

// noRematch is the one hard constraint: it is the whole reason the pairing
// backtracks instead of walking the table in twos.
func assertNoRematch(t *testing.T, drawn swissPairing, met map[string]bool) {
	t.Helper()
	for _, pair := range drawn.Pairs {
		if met[pairKey(pair[0], pair[1])] {
			t.Errorf("%s and %s have already played", pair[0], pair[1])
		}
	}
}

func assertEverybodyOnce(t *testing.T, drawn swissPairing, field []swissEntry) {
	t.Helper()
	seen := map[string]int{}
	for _, pair := range drawn.Pairs {
		seen[pair[0]]++
		seen[pair[1]]++
	}
	if drawn.Bye != "" {
		seen[drawn.Bye]++
	}
	for _, e := range field {
		if seen[e.Entry] != 1 {
			t.Errorf("%s appears %d times in the round, want 1", e.Entry, seen[e.Entry])
		}
	}
}

// ---------------------------------------------------------------------------

func TestRoundOneFoldsTheSeeding(t *testing.T) {
	// Nobody has played, so the whole field is one score group: the top half
	// meets the bottom half in order. 1-5, 2-6, 3-7, 4-8.
	drawn := pairSwiss(level(8), nil, nil)
	assertPairs(t, drawn, "e1-e5", "e2-e6", "e3-e7", "e4-e8")
}

func TestAnOddFieldSitsTheBottomTeamOut(t *testing.T) {
	drawn := pairSwiss(level(9), nil, nil)
	assertPairs(t, drawn, "e1-e5", "e2-e6", "e3-e7", "e4-e8", "e9-bye")
}

func TestTheByeNeverGoesToTheSameTeamTwice(t *testing.T) {
	// e9 sat out round one, so the next one goes to the lowest-ranked team
	// that has not had one.
	drawn := pairSwiss(level(9), nil, map[string]bool{"e9": true})
	if drawn.Bye != "e8" {
		t.Errorf("bye went to %q, want e8", drawn.Bye)
	}
}

func TestTheByeGoesBackDownTheTableOnceEverybodyHasHadOne(t *testing.T) {
	hadBye := map[string]bool{}
	for _, e := range level(3) {
		hadBye[e.Entry] = true
	}
	drawn := pairSwiss(level(3), nil, hadBye)
	if drawn.Bye != "e3" {
		t.Errorf("bye went to %q, want e3 — the bottom of the table", drawn.Bye)
	}
}

func TestScoreGroupsAreFoldedSeparately(t *testing.T) {
	// Four on three points and four on none: each block folds within itself,
	// so a leader never meets a team that has lost everything.
	field := table(3, 3, 3, 3, 0, 0, 0, 0)
	drawn := pairSwiss(field, nil, nil)
	assertPairs(t, drawn, "e1-e3", "e2-e4", "e5-e7", "e6-e8")
}

func TestAnOddScoreGroupFloatsItsBottomTeamDown(t *testing.T) {
	// Three on three points: the top two play, and the third drops into the
	// group below and meets the best team there.
	field := table(3, 3, 3, 0, 0, 0)
	drawn := pairSwiss(field, nil, nil)
	assertPairs(t, drawn, "e1-e2", "e3-e4", "e5-e6")
}

func TestAFoldThatWouldRepeatAMeetingIsTransposed(t *testing.T) {
	// e1 and e3 have already met, so the fold gives way and e1 takes the next
	// team down instead. Nobody else is disturbed.
	field := table(3, 3, 3, 3)
	met := meetings([2]string{"e1", "e3"})

	drawn := pairSwiss(field, met, nil)
	assertNoRematch(t, drawn, met)
	assertPairs(t, drawn, "e1-e4", "e2-e3")
}

func TestPairingBacktracksOutOfADeadEnd(t *testing.T) {
	// The greedy fold would pair e1-e3, leaving e2 and e4 — who have already
	// played. The only round that works is e1-e4 and e2-e3, and finding it
	// means undoing the first pair.
	field := table(3, 3, 3, 3)
	met := meetings([2]string{"e2", "e4"})

	drawn := pairSwiss(field, met, nil)
	assertNoRematch(t, drawn, met)
	assertEverybodyOnce(t, drawn, field)
}

func TestARematchIsAllowedOnlyWhenNothingElseIsLeft(t *testing.T) {
	// Two teams that have played each other and nobody else to play.
	field := table(3, 0)
	met := meetings([2]string{"e1", "e2"})

	drawn := pairSwiss(field, met, nil)
	if !drawn.Rematch {
		t.Error("a repeat was forced but the pairing did not say so")
	}
	assertPairs(t, drawn, "e1-e2")
}

func TestAFullFieldIsStillPairableAfterSeveralRounds(t *testing.T) {
	// Ten teams, five rounds: the classic case where naive pairing paints
	// itself into a corner somewhere around round four.
	field := level(10)
	met := map[string]bool{}
	hadBye := map[string]bool{}

	for round := 0; round < 5; round++ {
		drawn := pairSwiss(field, met, hadBye)
		if drawn.Rematch {
			t.Fatalf("round %d had to repeat a meeting", round+1)
		}
		assertNoRematch(t, drawn, met)
		assertEverybodyOnce(t, drawn, field)

		// Whoever is higher in the table wins, which keeps the score groups
		// splitting the way a real Swiss does.
		rank := map[string]int{}
		for i, e := range field {
			rank[e.Entry] = i
		}
		points := map[string]int{}
		for _, e := range field {
			points[e.Entry] = e.Points
		}
		for _, pair := range drawn.Pairs {
			met[pairKey(pair[0], pair[1])] = true
			if rank[pair[0]] < rank[pair[1]] {
				points[pair[0]] += 3
			} else {
				points[pair[1]] += 3
			}
		}
		if drawn.Bye != "" {
			hadBye[drawn.Bye] = true
			points[drawn.Bye] += 3
		}

		for i := range field {
			field[i].Points = points[field[i].Entry]
		}
		// Re-sort into table order, best first, stable on ties.
		for i := 1; i < len(field); i++ {
			for j := i; j > 0 && field[j].Points > field[j-1].Points; j-- {
				field[j], field[j-1] = field[j-1], field[j]
			}
		}
	}
}

// ---------------------------------------------------------------------------

func TestSwissRoundCount(t *testing.T) {
	cases := []struct {
		configured, entries, want int
	}{
		{0, 8, 3},   // ceil(log2(8))
		{0, 16, 4},  // ceil(log2(16))
		{0, 20, 5},  // ceil(log2(20))
		{0, 5, 3},   // ceil(log2(5)) is 3 anyway
		{0, 4, 3},   // the floor: two rounds decide nothing
		{0, 3, 2},   // except when there are not enough opponents for three
		{7, 16, 7},  // configured wins
		{9, 6, 5},   // clamped: six teams cannot play nine fresh opponents
		{-1, 12, 4}, // nonsense falls back to the default
	}
	for _, c := range cases {
		if got := swissRoundCount(c.configured, c.entries); got != c.want {
			t.Errorf("swissRoundCount(%d, %d) = %d, want %d",
				c.configured, c.entries, got, c.want)
		}
	}
}

func TestPlanSwissWritesOneRoundAndNoMore(t *testing.T) {
	// The point of the format: rounds two onwards are not knowable yet, so
	// they are absent rather than guessed at.
	plan := PlanSwiss(entryIDs(8), StageConfig{Rounds: 4, AdvancePerPool: 4})
	assertPlanIsConsistent(t, plan)

	if len(plan.Pools) != 1 || plan.Pools[0].Kind != "group" {
		t.Fatalf("want one group pool, got %+v", plan.Pools)
	}
	if plan.Pools[0].AdvanceCount != 4 {
		t.Errorf("advance_count = %d, want 4", plan.Pools[0].AdvanceCount)
	}
	if len(plan.Slots) != 8 {
		t.Errorf("got %d slots, want one per entry", len(plan.Slots))
	}
	if len(plan.Fixtures) != 4 {
		t.Errorf("got %d fixtures, want round one only", len(plan.Fixtures))
	}
	for _, f := range plan.Fixtures {
		if f.Round != 0 {
			t.Errorf("fixture %q is in round %d; only round one is drawn up front",
				f.Code, f.Round)
		}
		if f.Status != "ready" {
			t.Errorf("fixture %q is %q; both sides are known from the start",
				f.Code, f.Status)
		}
	}
}

func TestPlanSwissGivesAnOddFieldAByeSlotToPlayAgainst(t *testing.T) {
	plan := PlanSwiss(entryIDs(7), StageConfig{})
	assertPlanIsConsistent(t, plan)

	byes := 0
	for _, s := range plan.Slots {
		if s.SourceType == "bye" {
			byes++
		}
	}
	if byes != 1 {
		t.Errorf("got %d bye slots, want exactly one for the whole stage", byes)
	}
	if len(plan.Fixtures) != 4 {
		t.Errorf("got %d fixtures, want three matches and a bye", len(plan.Fixtures))
	}
	if last := plan.Fixtures[len(plan.Fixtures)-1]; last.Code != "R1.bye" {
		t.Errorf("the bye is %q; it should come last so the played matches "+
			"number 1..n down the sheet", last.Code)
	}
}

func TestPlanSwissForAnEvenFieldHasNoByeSlot(t *testing.T) {
	plan := PlanSwiss(entryIDs(8), StageConfig{})
	for _, s := range plan.Slots {
		if s.SourceType == "bye" {
			t.Fatal("an even field never sits anybody out")
		}
	}
}

func TestSwissSignatureIgnoresSidesAndOrder(t *testing.T) {
	// The redraw check compares a proposed round against the one on the wall.
	// Swapping home and away, or the order of the matches, is the same round.
	a := swissPairing{Pairs: [][2]string{{"e1", "e2"}, {"e3", "e4"}}, Bye: "e5"}
	b := swissPairing{Pairs: [][2]string{{"e4", "e3"}, {"e2", "e1"}}, Bye: "e5"}
	if swissSignature(a) != swissSignature(b) {
		t.Errorf("%q and %q are the same round", swissSignature(a), swissSignature(b))
	}

	c := swissPairing{Pairs: [][2]string{{"e1", "e3"}, {"e2", "e4"}}, Bye: "e5"}
	if swissSignature(a) == swissSignature(c) {
		t.Error("different pairings produced the same signature")
	}
}

func TestByeCountsAsAWinInASwissTable(t *testing.T) {
	// The bracket rule — a bye is settled but nobody played it, so it scores
	// nothing — would send whoever sat out to the bottom of the table for
	// being the odd one out.
	row := &standingRow{Entry: "e1"}
	accumulateBye(row, ScoringConfig{PointsWin: 3, PointsDraw: 1})

	if row.Points != 3 || row.Won != 1 || row.Played != 1 {
		t.Errorf("got %d points from %d played (%d won), want 3 from 1 (1)",
			row.Points, row.Played, row.Won)
	}
	if row.ScoreAgainst != 0 {
		t.Errorf("conceded %d; nobody was there to score", row.ScoreAgainst)
	}
}

func TestByeTakesTheNominalScoreWhenTheRulebookSetsOne(t *testing.T) {
	row := &standingRow{Entry: "e1"}
	accumulateBye(row, ScoringConfig{PointsWin: 2, WalkoverScore: 2})

	if row.ScoreFor != 2 || row.Points != 2 {
		t.Errorf("got %d points and %d scored, want 2 and 2", row.Points, row.ScoreFor)
	}
}
