package tournament

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// fixtureCollection mirrors the fields the ranking code reads.
func fixtureCollection() *core.Collection {
	c := core.NewBaseCollection("fixtures")
	c.Fields.Add(
		&core.TextField{Name: "status"},
		&core.TextField{Name: "home_entry"},
		&core.TextField{Name: "away_entry"},
		&core.NumberField{Name: "home_score", OnlyInt: true},
		&core.NumberField{Name: "away_score", OnlyInt: true},
		&core.TextField{Name: "winner"},
		&core.TextField{Name: "loser"},
	)
	return c
}

// fakeFixture builds an in-memory finished fixture for the ranking tests.
//
// The outcome is derived rather than set, because that is what the server does
// on every write — head-to-head reads `winner`, and a fixture built by hand
// without one would quietly test nothing.
func fakeFixture(home, away string, hs, as int) *core.Record {
	r := core.NewRecord(fixtureCollection())
	r.Set("status", "finished")
	r.Set("home_entry", home)
	r.Set("away_entry", away)
	r.Set("home_score", hs)
	r.Set("away_score", as)
	deriveOutcome(r)
	return r
}

// fakeWalkover builds a match nobody played, won by the side that turned up.
func fakeWalkover(home, away, winner string) *core.Record {
	r := core.NewRecord(fixtureCollection())
	r.Set("status", "walkover")
	r.Set("home_entry", home)
	r.Set("away_entry", away)
	r.Set("winner", winner)
	deriveOutcome(r)
	return r
}

func names(rows []*standingRow) []string {
	out := make([]string, len(rows))
	for i, r := range rows {
		out[i] = r.Entry
	}
	return out
}

func assertOrder(t *testing.T, got []*standingRow, want ...string) {
	t.Helper()
	actual := names(got)
	if len(actual) != len(want) {
		t.Fatalf("order = %v, want %v", actual, want)
	}
	for i := range want {
		if actual[i] != want[i] {
			t.Fatalf("order = %v, want %v", actual, want)
		}
	}
}

func TestRankByPoints(t *testing.T) {
	rows := []*standingRow{
		{Entry: "A", Points: 3},
		{Entry: "B", Points: 9},
		{Entry: "C", Points: 6},
	}
	rankGroup(rows, DefaultTiebreakers, 0, nil)
	assertOrder(t, rows, "B", "C", "A")
}

func TestHeadToHeadBreaksATie(t *testing.T) {
	// A, B and C all finish on 6 points. Among themselves: B beat C, C beat A,
	// A beat B — a perfect cycle, so head-to-head cannot separate them and the
	// next criterion (score difference) has to.
	rows := []*standingRow{
		{Entry: "A", Points: 6, ScoreFor: 5, ScoreAgainst: 4},
		{Entry: "B", Points: 6, ScoreFor: 7, ScoreAgainst: 4},
		{Entry: "C", Points: 6, ScoreFor: 4, ScoreAgainst: 5},
	}
	fixtures := []*core.Record{
		fakeFixture("A", "B", 2, 1),
		fakeFixture("B", "C", 2, 0),
		fakeFixture("C", "A", 2, 1),
	}
	rankGroup(rows, DefaultTiebreakers, 0, fixtures)
	assertOrder(t, rows, "B", "A", "C")
}

func TestHeadToHeadWinsOverScoreDifference(t *testing.T) {
	// B has the better goal difference, but A beat B head to head — and
	// head_to_head comes first in the default order.
	rows := []*standingRow{
		{Entry: "A", Points: 6, ScoreFor: 4, ScoreAgainst: 3},
		{Entry: "B", Points: 6, ScoreFor: 9, ScoreAgainst: 2},
	}
	fixtures := []*core.Record{fakeFixture("A", "B", 1, 0)}

	rankGroup(rows, DefaultTiebreakers, 0, fixtures)
	assertOrder(t, rows, "A", "B")

	// With head_to_head removed from the rulebook, the order flips.
	rows = []*standingRow{
		{Entry: "A", Points: 6, ScoreFor: 4, ScoreAgainst: 3},
		{Entry: "B", Points: 6, ScoreFor: 9, ScoreAgainst: 2},
	}
	rankGroup(rows, []string{"points", "score_diff"}, 0, fixtures)
	assertOrder(t, rows, "B", "A")
}

func TestHeadToHeadIgnoresFixturesOutsideTheTiedGroup(t *testing.T) {
	// A and B are tied. A thrashed C, but C is not in the tied group, so that
	// result must not count towards the head-to-head mini table.
	rows := []*standingRow{
		{Entry: "A", Points: 6, ScoreFor: 9, ScoreAgainst: 1},
		{Entry: "B", Points: 6, ScoreFor: 3, ScoreAgainst: 1},
	}
	fixtures := []*core.Record{
		fakeFixture("A", "C", 9, 0),
		fakeFixture("B", "A", 1, 0),
	}
	rankGroup(rows, DefaultTiebreakers, 0, fixtures)
	assertOrder(t, rows, "B", "A")
}

func TestSeedBreaksAnOtherwisePerfectTie(t *testing.T) {
	rows := []*standingRow{
		{Entry: "A", Points: 3, Seed: 7},
		{Entry: "B", Points: 3, Seed: 2},
	}
	rankGroup(rows, DefaultTiebreakers, 0, nil)
	assertOrder(t, rows, "B", "A")
}

func TestUnseededEntriesSortLast(t *testing.T) {
	rows := []*standingRow{
		{Entry: "A", Points: 3, Seed: 0},
		{Entry: "B", Points: 3, Seed: 9},
	}
	rankGroup(rows, DefaultTiebreakers, 0, nil)
	assertOrder(t, rows, "B", "A")
}

func TestAppliedRecordsWhichCriteriaWereNeeded(t *testing.T) {
	rows := []*standingRow{
		{Entry: "A", Points: 9},
		{Entry: "B", Points: 6, ScoreFor: 3, ScoreAgainst: 1},
		{Entry: "C", Points: 6, ScoreFor: 1, ScoreAgainst: 3},
	}
	fixtures := []*core.Record{fakeFixture("B", "C", 1, 1)}
	rankGroup(rows, DefaultTiebreakers, 0, fixtures)

	// The runaway leader was separated by points alone.
	if len(rows[0].Applied) != 1 || rows[0].Applied[0] != "points" {
		t.Errorf("leader applied = %v, want [points]", rows[0].Applied)
	}
	// The tied pair needed more, and the audit trail says so.
	if len(rows[1].Applied) < 2 {
		t.Errorf("tied row applied = %v, want at least [points head_to_head]", rows[1].Applied)
	}
}

func TestDrawLeavesOrderStable(t *testing.T) {
	rows := []*standingRow{{Entry: "A", Points: 3}, {Entry: "B", Points: 3}}
	rankGroup(rows, []string{"points", "draw"}, 0, nil)
	assertOrder(t, rows, "A", "B")
}

func TestUnknownCriterionIsSkipped(t *testing.T) {
	rows := []*standingRow{
		{Entry: "A", Points: 3, ScoreFor: 1},
		{Entry: "B", Points: 3, ScoreFor: 5},
	}
	rankGroup(rows, []string{"points", "nonsense", "score_for"}, 0, nil)
	assertOrder(t, rows, "B", "A")
}

func TestAccumulate(t *testing.T) {
	cfg := ScoringConfig{PointsWin: 3, PointsDraw: 1}
	home := &standingRow{Entry: "A"}
	away := &standingRow{Entry: "B"}

	accumulate(home, away, 2, 0, cfg)
	accumulate(home, away, 1, 1, cfg)

	if home.Played != 2 || home.Won != 1 || home.Drawn != 1 || home.Lost != 0 {
		t.Errorf("home record = %d played %d/%d/%d, want 2 played 1/1/0",
			home.Played, home.Won, home.Drawn, home.Lost)
	}
	if home.Points != 4 {
		t.Errorf("home points = %d, want 4", home.Points)
	}
	if away.Points != 1 {
		t.Errorf("away points = %d, want 1", away.Points)
	}
	if home.ScoreFor != 3 || home.ScoreAgainst != 1 {
		t.Errorf("home score = %d:%d, want 3:1", home.ScoreFor, home.ScoreAgainst)
	}
}

// ---------------------------------------------------------------------------
// walkovers
// ---------------------------------------------------------------------------

func TestWalkoverAwardsTheWinToWhoeverTurnedUp(t *testing.T) {
	cfg := ScoringConfig{PointsWin: 3, PointsDraw: 1}
	home := &standingRow{Entry: "a"}
	away := &standingRow{Entry: "b"}

	accumulateWalkover(home, away, "b", cfg)

	if away.Won != 1 || away.Points != 3 || away.Played != 1 {
		t.Fatalf("winner = %+v, want one win worth three points", away)
	}
	if home.Lost != 1 || home.Points != 0 || home.Played != 1 {
		t.Fatalf("loser = %+v, want one loss", home)
	}
	if home.Drawn != 0 || away.Drawn != 0 {
		t.Fatalf("a walkover is not a draw: %+v %+v", home, away)
	}
}

// The default of 0 must not read as "level", which is what going through
// accumulate() would have made it.
func TestWalkoverWithNoNominalScoreIsStillAWin(t *testing.T) {
	cfg := ScoringConfig{PointsWin: 3, PointsDraw: 1}
	home := &standingRow{Entry: "a"}
	away := &standingRow{Entry: "b"}

	accumulateWalkover(home, away, "a", cfg)

	if home.Points != 3 || away.Points != 0 {
		t.Fatalf("points = %d/%d, want 3/0", home.Points, away.Points)
	}
	if home.ScoreFor != 0 || away.ScoreAgainst != 0 {
		t.Fatalf("score = %d/%d, want nothing credited", home.ScoreFor, away.ScoreAgainst)
	}
}

func TestWalkoverScoreIsCreditedWhenTheRulebookSaysSo(t *testing.T) {
	cfg := ScoringConfig{PointsWin: 3, WalkoverScore: 3}
	home := &standingRow{Entry: "a"}
	away := &standingRow{Entry: "b"}

	accumulateWalkover(home, away, "a", cfg)

	if home.ScoreFor != 3 || away.ScoreAgainst != 3 {
		t.Fatalf("score = %d:%d, want 3:3 credited one way", home.ScoreFor, away.ScoreAgainst)
	}
	if home.ScoreAgainst != 0 || away.ScoreFor != 0 {
		t.Fatalf("the absent side conceded but did not score: %+v %+v", home, away)
	}
}

func TestWalkoverWithNobodyNamedAwardsNothing(t *testing.T) {
	cfg := ScoringConfig{PointsWin: 3}
	home := &standingRow{Entry: "a"}
	away := &standingRow{Entry: "b"}

	accumulateWalkover(home, away, "", cfg)

	if home.Played != 0 || away.Played != 0 {
		t.Fatalf("nothing should be recorded without a winner: %+v %+v", home, away)
	}
}

// Head-to-head reads the outcome, not the score, or a walkover would rank as a
// draw between the team that turned up and the team that did not.
func TestHeadToHeadCountsAWalkover(t *testing.T) {
	rows := []*standingRow{{Entry: "a"}, {Entry: "b"}}
	points := headToHead(rows, []*core.Record{fakeWalkover("a", "b", "b")})

	if points["b"] != 3 || points["a"] != 0 {
		t.Fatalf("head-to-head = %v, want b ahead on three", points)
	}
}

// ---------------------------------------------------------------------------
// the result log
// ---------------------------------------------------------------------------

func TestEventKindClassifiesWhatAPersonDid(t *testing.T) {
	cases := []struct {
		name   string
		before outcome
		after  outcome
		kind   string
		logged bool
	}{
		{
			name:   "a result goes in",
			before: outcome{Status: "ready"},
			after:  outcome{Status: "finished", Home: 3, Away: 1, Winner: "a"},
			kind:   "recorded", logged: true,
		},
		{
			name:   "a result is corrected",
			before: outcome{Status: "finished", Home: 3, Away: 1, Winner: "a"},
			after:  outcome{Status: "finished", Home: 2, Away: 3, Winner: "b"},
			kind:   "corrected", logged: true,
		},
		{
			name:   "a result is taken back off",
			before: outcome{Status: "finished", Home: 3, Away: 1, Winner: "a"},
			after:  outcome{Status: "ready"},
			kind:   "cleared", logged: true,
		},
		{
			name:   "a walkover is a result like any other",
			before: outcome{Status: "ready"},
			after:  outcome{Status: "walkover", Winner: "b"},
			kind:   "recorded", logged: true,
		},
		{
			name:   "putting a match on court is not history",
			before: outcome{Status: "ready"},
			after:  outcome{Status: "live"},
		},
		{
			name:   "and neither is saving the same result twice",
			before: outcome{Status: "finished", Home: 3, Away: 1, Winner: "a"},
			after:  outcome{Status: "finished", Home: 3, Away: 1, Winner: "a"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			kind, logged := eventKind(tc.before, tc.after)
			if logged != tc.logged {
				t.Fatalf("logged = %v, want %v", logged, tc.logged)
			}
			if kind != tc.kind {
				t.Fatalf("kind = %q, want %q", kind, tc.kind)
			}
		})
	}
}
