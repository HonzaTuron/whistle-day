package tournament

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// ---------------------------------------------------------------------------
// the stage-wide table
// ---------------------------------------------------------------------------
//
// A pool table ranks the teams in one group. A stage table ranks every group
// of a stage against each other, and exists for one format: "the best four
// third-placed teams also go through". That comparison cannot be expressed as
// a pool position, because it is between teams who were never in the same
// pool and never played each other.
//
// Two rules make it a fair comparison rather than a merged list.
//
// **Group position comes first.** The table runs tier by tier: every group
// winner, then every runner-up, then every third place. A runner-up never
// outranks a winner however good its record, which is what every rulebook
// says and what makes a position in this table mean something — with four
// pools, positions 9..12 ARE the third-placed teams, in order. That is what a
// `stage_rank` slot points at.
//
// **Records are compared over the same number of matches.** Snaked pools are
// not always equal — ten teams in three pools is 4/3/3 — and a team from the
// pool of four has played a match the others have not. So the table keeps the
// top `m` of every pool, where `m` is the smallest pool, and disregards every
// result against the teams below that. It is the rule the rulebooks use, and
// it is why this is a re-tally rather than a re-sort: you cannot subtract a
// match from a total after the fact and still get the tiebreaks right.
//
// The group tables themselves are untouched. Truncation decides the order
// *within* a tier; which tier a team is in comes from its own group's real
// table.

// computeStageTable builds and stores the stage-wide table from the stage's
// finished pool tables. Stages without group pools have no table and are
// skipped.
func computeStageTable(
	app core.App, stage *core.Record, cfg ScoringConfig, tables []poolTable,
) error {
	if len(tables) == 0 {
		return nil
	}

	depth := stageTableDepth(tables)
	if depth == 0 {
		return writeTable(app, stage.Id, "", nil, 0)
	}

	// With equal pools nothing is disregarded, and the tallies already in hand
	// are the truncated ones. Re-reading them would be a slower way to the same
	// numbers.
	truncated := tables
	fixtures := []*core.Record{}

	if ignore := belowDepth(tables, depth); len(ignore) > 0 {
		truncated = make([]poolTable, 0, len(tables))
		for _, table := range tables {
			rows, played, err := tallyPool(app, stage, table.Pool, cfg, allRounds, ignore)
			if err != nil {
				return err
			}
			fixtures = append(fixtures, played...)
			// A re-tally comes back in slot order. Which tier a row belongs to
			// is decided by its own group's real table, not by the truncated
			// record, so the pool order is carried over rather than recomputed.
			truncated = append(truncated, poolTable{
				Pool:   table.Pool,
				Ranked: inTableOrder(rows, table.Ranked),
			})
		}
	}

	ranked := stageTiers(truncated, depth, cfg.Tiebreakers, fixtures)

	// How many rows advance from the stage table: the sum of every downstream
	// stage's advancePerPool × number-of-pools + bestOfNext. Zero means none of
	// the rows are marked as qualified.
	advance := stageTableAdvance(app, stage.Id)
	return writeTable(app, stage.Id, "", ranked, advance)
}

// stageTableAdvance sums every consuming stage's total qualifiers from this
// stage. With three pools, advancePerPool=2, and bestOfNext=2, the total is
// 3×2+2 = 8 — the top eight rows of the stage table are qualified.
func stageTableAdvance(app core.App, stageID string) int {
	stage, err := app.FindRecordById("stages", stageID)
	if err != nil {
		return 0
	}
	tournamentID := stage.GetString("tournament")

	all, err := app.FindRecordsByFilter(
		"stages", "tournament = {:t}", "", 0, 0,
		dbx.Params{"t": tournamentID},
	)
	if err != nil {
		return 0
	}
	total := 0
	for _, s := range all {
		cfg, err := stageConfig(s)
		if err != nil || cfg.SeedFrom == nil || cfg.SeedFrom.Stage != stageID {
			continue
		}
		// Count the group pools in the source stage.
		pools, _ := app.FindRecordsByFilter(
			"pools", "stage = {:stage} && kind = 'group'", "", 0, 0,
			dbx.Params{"stage": stageID},
		)
		total += len(pools) * cfg.SeedFrom.AdvancePerPool
		total += cfg.SeedFrom.BestOfNext
	}
	return total
}

// stageTiers lays the pool tables out tier by tier — every pool's first place,
// then every second — and ranks each tier internally.
//
// fixtures is what the head_to_head criterion reads. It is in the default
// tiebreak chain and across pools there are no such fixtures, so it scores
// every row zero and the ranking falls through to the next criterion on its
// own. No special case is needed, and one would be wrong: the tiers of a
// single-pool stage are one row each, where head-to-head is equally moot.
func stageTiers(
	tables []poolTable, depth int, criteria []string, fixtures []*core.Record,
) []*standingRow {
	tiers := make([][]*standingRow, depth)
	for _, table := range tables {
		for position, row := range table.Ranked {
			if position >= depth {
				break
			}
			tiers[position] = append(tiers[position], copyRow(row))
		}
	}

	ranked := make([]*standingRow, 0, depth*len(tables))
	for _, tier := range tiers {
		rankGroup(tier, criteria, 0, fixtures)
		ranked = append(ranked, tier...)
	}
	return ranked
}

// stageTableDepth is how many places of each pool the stage table holds: the
// size of the smallest pool, so that every tier is drawn from every pool.
func stageTableDepth(tables []poolTable) int {
	depth := 0
	for i, table := range tables {
		if i == 0 || len(table.Ranked) < depth {
			depth = len(table.Ranked)
		}
	}
	return depth
}

// belowDepth is the set of entries finishing below the shared depth — the
// bottom of an oversized pool, whose results the others do not have to answer
// for.
func belowDepth(tables []poolTable, depth int) map[string]bool {
	ignore := map[string]bool{}
	for _, table := range tables {
		for position, row := range table.Ranked {
			if position >= depth {
				ignore[row.Entry] = true
			}
		}
	}
	return ignore
}

// inTableOrder puts freshly tallied rows back into the order of the pool table
// they belong to, dropping any entry that table does not list.
func inTableOrder(rows, order []*standingRow) []*standingRow {
	byEntry := make(map[string]*standingRow, len(rows))
	for _, r := range rows {
		byEntry[r.Entry] = r
	}
	sorted := make([]*standingRow, 0, len(order))
	for _, r := range order {
		if row, ok := byEntry[r.Entry]; ok {
			sorted = append(sorted, row)
		}
	}
	return sorted
}

// copyRow detaches a row from the pool table it came from. The stage table
// ranks it again, and ranking records which criteria it applied — onto the row.
func copyRow(row *standingRow) *standingRow {
	copied := *row
	copied.Applied = nil
	return &copied
}

// ---------------------------------------------------------------------------
// stage_rank slot resolution
// ---------------------------------------------------------------------------

// StageTable reads a stage's stored stage-wide table, best first.
func StageTable(app core.App, stageID string) ([]*core.Record, error) {
	return tableRows(app, stageID, "")
}

// StageComplete reports whether every group pool in a stage has finished.
//
// The stage table is provisional until the last of them is in — a third-placed
// team is only the best third-placed team once every group has a third place.
func StageComplete(app core.App, stageID string) (bool, error) {
	pools, err := app.FindRecordsByFilter(
		"pools", "stage = {:stage}", "position", 0, 0,
		dbx.Params{"stage": stageID},
	)
	if err != nil {
		return false, err
	}

	groups := 0
	for _, pool := range pools {
		if pool.GetString("kind") != "group" {
			continue
		}
		groups++
		complete, err := PoolComplete(app, pool.Id)
		if err != nil {
			return false, err
		}
		if !complete {
			return false, nil
		}
	}
	return groups > 0, nil
}

// ResolveStageRanks fills in every slot waiting on a position in this stage's
// stage-wide table — the "best third-placed teams" wiring.
//
// Idempotent, and refuses to fill anything until the whole stage is complete.
func ResolveStageRanks(app core.App, stageID string) (int, error) {
	waiting, err := app.FindRecordsByFilter(
		"slots", "source_type = 'stage_rank' && source_stage = {:stage}", "", 0, 0,
		dbx.Params{"stage": stageID},
	)
	if err != nil {
		return 0, err
	}
	if len(waiting) == 0 {
		return 0, nil
	}

	complete, err := StageComplete(app, stageID)
	if err != nil {
		return 0, err
	}
	if !complete {
		return 0, nil
	}

	table, err := tableRows(app, stageID, "")
	if err != nil {
		return 0, err
	}
	byPosition := map[int]string{}
	for _, row := range table {
		byPosition[row.GetInt("position")] = row.GetString("entry")
	}

	resolved := 0
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
	return resolved, nil
}
