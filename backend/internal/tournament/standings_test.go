package tournament

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// fakeFixture builds an in-memory finished fixture for the ranking tests.
func fakeFixture(home, away string, hs, as int) *core.Record {
	c := core.NewBaseCollection("fixtures")
	c.Fields.Add(
		&core.TextField{Name: "home_entry"},
		&core.TextField{Name: "away_entry"},
		&core.NumberField{Name: "home_score", OnlyInt: true},
		&core.NumberField{Name: "away_score", OnlyInt: true},
	)
	r := core.NewRecord(c)
	r.Set("home_entry", home)
	r.Set("away_entry", away)
	r.Set("home_score", hs)
	r.Set("away_score", as)
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
