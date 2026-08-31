package tournament

import "testing"

func row(entry string, points, diff int) *standingRow {
	return &standingRow{
		Entry: entry, Points: points, Played: 3,
		ScoreFor: diff, ScoreAgainst: 0,
	}
}

// The stage table runs tier by tier: every pool's winner, then every
// runner-up. A runner-up with a better record than a winner from another pool
// still ranks below every winner — that is the whole point of the ordering,
// and the reason positions 5..8 of a four-pool stage ARE the third places.
func TestStageTableRanksTierByTier(t *testing.T) {
	tables := []poolTable{
		{Ranked: []*standingRow{row("A1", 3, 1), row("A2", 0, -1)}},
		{Ranked: []*standingRow{row("B1", 9, 9), row("B2", 6, 6)}},
	}

	tiers := stageTiers(tables, 2, DefaultTiebreakers, nil)
	assertOrder(t, tiers, "B1", "A1", "B2", "A2")
}

func TestStageTableDepthIsTheSmallestPool(t *testing.T) {
	tables := []poolTable{
		{Ranked: []*standingRow{row("A1", 9, 0), row("A2", 6, 0), row("A3", 3, 0)}},
		{Ranked: []*standingRow{row("B1", 9, 0), row("B2", 6, 0)}},
	}
	if depth := stageTableDepth(tables); depth != 2 {
		t.Fatalf("depth = %d, want 2", depth)
	}

	// A3 has no counterpart in pool B, so there is no tier for it to be
	// compared in and it is left out rather than ranked against nobody.
	tiers := stageTiers(tables, 2, DefaultTiebreakers, nil)
	assertOrder(t, tiers, "A1", "B1", "A2", "B2")
}

func TestBelowDepthNamesTheTeamsToDisregard(t *testing.T) {
	tables := []poolTable{
		{Ranked: []*standingRow{row("A1", 9, 0), row("A2", 6, 0), row("A3", 3, 0)}},
		{Ranked: []*standingRow{row("B1", 9, 0), row("B2", 6, 0)}},
	}
	ignore := belowDepth(tables, 2)
	if len(ignore) != 1 || !ignore["A3"] {
		t.Fatalf("ignore = %v, want just A3", ignore)
	}
}

func TestBelowDepthIsEmptyForEqualPools(t *testing.T) {
	tables := []poolTable{
		{Ranked: []*standingRow{row("A1", 9, 0), row("A2", 6, 0)}},
		{Ranked: []*standingRow{row("B1", 9, 0), row("B2", 6, 0)}},
	}
	if ignore := belowDepth(tables, 2); len(ignore) != 0 {
		t.Fatalf("ignore = %v, want empty", ignore)
	}
}

// Tier ranking uses the ordinary tiebreak chain, so two teams level on points
// separate on score difference exactly as they would inside a pool.
func TestStageTableTierUsesTiebreakers(t *testing.T) {
	tables := []poolTable{
		{Ranked: []*standingRow{{Entry: "A1", Points: 6, ScoreFor: 4, ScoreAgainst: 3}}},
		{Ranked: []*standingRow{{Entry: "B1", Points: 6, ScoreFor: 9, ScoreAgainst: 1}}},
	}
	tiers := stageTiers(tables, 1, DefaultTiebreakers, nil)
	assertOrder(t, tiers, "B1", "A1")
}

// The rows written for the stage table must not be the rows already written
// for the pool tables: ranking records which criteria it applied onto the row,
// and a shared pointer would leave a pool table claiming the stage table's
// reasoning.
func TestStageTableDoesNotShareRowsWithPoolTables(t *testing.T) {
	poolRow := row("A1", 3, 1)
	tables := []poolTable{{Ranked: []*standingRow{poolRow}}}

	tiers := stageTiers(tables, 1, DefaultTiebreakers, nil)
	if tiers[0] == poolRow {
		t.Fatal("stage table reused the pool table's row")
	}
	if len(poolRow.Applied) != 0 {
		t.Fatalf("pool row picked up stage criteria: %v", poolRow.Applied)
	}
}

func TestOrdinal(t *testing.T) {
	cases := map[int]string{1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 11: "11th", 21: "21st"}
	for n, want := range cases {
		if got := ordinal(n); got != want {
			t.Fatalf("ordinal(%d) = %q, want %q", n, got, want)
		}
	}
}
