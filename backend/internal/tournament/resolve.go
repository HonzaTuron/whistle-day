// Package tournament holds the server-authoritative tournament logic: deriving
// a fixture's outcome from its score, and propagating that outcome into the
// slots that depend on it.
//
// This lives in Go rather than pb_hooks because it must be transactional and
// because goja (PocketBase's JS runtime) is a poor place for real logic.
package tournament

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// isSettled reports whether a fixture's result is final and may be propagated.
func isSettled(status string) bool {
	switch status {
	case "finished", "walkover", "bye":
		return true
	default:
		return false
	}
}

// RegisterHooks wires fixture outcome derivation and slot propagation into app.
func RegisterHooks(app core.App) {
	// Derive winner/loser from the score BEFORE the write, so the stored
	// outcome can never disagree with the stored score.
	app.OnRecordCreate("fixtures").BindFunc(func(e *core.RecordEvent) error {
		deriveOutcome(e.Record)
		return e.Next()
	})
	app.OnRecordUpdate("fixtures").BindFunc(func(e *core.RecordEvent) error {
		deriveOutcome(e.Record)
		return e.Next()
	})

	// Propagate only once the write has actually committed. Propagation writes
	// more fixtures, which re-enters these hooks; that recursion terminates
	// because a freshly-readied fixture is not settled, and PropagateFixture
	// returns immediately for unsettled fixtures.
	app.OnRecordAfterCreateSuccess("fixtures").BindFunc(func(e *core.RecordEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		return afterFixtureWrite(e.App, e.Record, "")
	})
	app.OnRecordAfterUpdateSuccess("fixtures").BindFunc(func(e *core.RecordEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		previous := ""
		if original := e.Record.Original(); original != nil {
			previous = original.GetString("status")
		}
		return afterFixtureWrite(e.App, e.Record, previous)
	})

	// Per-set scores feed the sub_for / sub_against tiebreak, so editing them
	// can reorder a table even though no fixture changed.
	app.OnRecordAfterCreateSuccess("games").BindFunc(func(e *core.RecordEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		return recomputeForGame(e.App, e.Record)
	})
	app.OnRecordAfterUpdateSuccess("games").BindFunc(func(e *core.RecordEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		return recomputeForGame(e.App, e.Record)
	})
	app.OnRecordAfterDeleteSuccess("games").BindFunc(func(e *core.RecordEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		return recomputeForGame(e.App, e.Record)
	})
}

// afterFixtureWrite runs the full downstream chain for one fixture: bracket
// propagation, then the pool tables, then any slot waiting on a table position.
//
// The table work is skipped unless this write settled or un-settled the
// fixture. That is not just an optimisation: propagation writes other fixtures
// (flipping them to "ready"), which re-enters this hook, and without the guard
// the recursion would not terminate.
func afterFixtureWrite(app core.App, fixture *core.Record, previousStatus string) error {
	if err := PropagateFixture(app, fixture); err != nil {
		return err
	}

	if !isSettled(fixture.GetString("status")) && !isSettled(previousStatus) {
		return nil
	}

	stageID := fixture.GetString("stage")
	if stageID == "" {
		return nil
	}
	if err := ComputeStandings(app, stageID); err != nil {
		return err
	}
	_, err := ResolvePoolRanks(app, stageID)
	return err
}

func recomputeForGame(app core.App, game *core.Record) error {
	fixture, err := app.FindRecordById("fixtures", game.GetString("fixture"))
	if err != nil {
		return nil // the parent fixture is gone; nothing to recompute
	}
	if !isSettled(fixture.GetString("status")) {
		return nil
	}
	return ComputeStandings(app, fixture.GetString("stage"))
}

// deriveOutcome fills winner/loser from the fixture's status and score.
//
// For a finished fixture the score is the single source of truth. For a
// walkover or a bye there is no meaningful score, so the organiser names the
// winner and only the loser is inferred.
func deriveOutcome(f *core.Record) {
	status := f.GetString("status")
	home := f.GetString("home_entry")
	away := f.GetString("away_entry")

	if !isSettled(status) {
		f.Set("winner", "")
		f.Set("loser", "")
		return
	}

	if status == "walkover" || status == "bye" {
		switch f.GetString("winner") {
		case home:
			f.Set("loser", away)
		case away:
			f.Set("loser", home)
		}
		return
	}

	hs := f.GetInt("home_score")
	as := f.GetInt("away_score")
	switch {
	case hs > as:
		f.Set("winner", home)
		f.Set("loser", away)
	case as > hs:
		f.Set("winner", away)
		f.Set("loser", home)
	default:
		// A draw. Legal in a round-robin pool, meaningless in a bracket —
		// it simply resolves nothing downstream.
		f.Set("winner", "")
		f.Set("loser", "")
	}
}

// PropagateFixture pushes a settled fixture's outcome into every slot that
// names it as a source, then refreshes the fixtures those slots feed.
//
// It is idempotent: re-running it on an already-propagated fixture writes
// nothing, so a corrected score can safely be replayed.
func PropagateFixture(app core.App, fixture *core.Record) error {
	// A fixture facing a declared bye is decided the moment it exists.
	settled, err := settleBye(app, fixture)
	if err != nil {
		return err
	}
	if settled {
		// The save above re-enters this hook with status=bye; that pass
		// performs the actual propagation.
		return nil
	}

	if !isSettled(fixture.GetString("status")) {
		return nil
	}

	winner := fixture.GetString("winner")
	loser := fixture.GetString("loser")
	if winner == "" && loser == "" {
		return nil
	}

	return app.RunInTransaction(func(tx core.App) error {
		slots, err := tx.FindRecordsByFilter(
			"slots",
			"source_fixture = {:fixture}",
			"",
			0, 0,
			dbx.Params{"fixture": fixture.Id},
		)
		if err != nil {
			return err
		}

		touched := make([]*core.Record, 0, len(slots))
		for _, slot := range slots {
			var entry string
			switch slot.GetString("source_type") {
			case "fixture_winner":
				entry = winner
			case "fixture_loser":
				entry = loser
			default:
				continue
			}

			if entry == "" || slot.GetString("entry") == entry {
				continue
			}
			slot.Set("entry", entry)
			if err := tx.Save(slot); err != nil {
				return err
			}
			touched = append(touched, slot)
		}

		for _, slot := range touched {
			if err := refreshDependentFixtures(tx, slot); err != nil {
				return err
			}
		}
		return nil
	})
}

// refreshDependentFixtures copies a resolved slot's entry into the denormalised
// home_entry/away_entry of every fixture that uses it, and promotes a fixture
// to "ready" once both of its sides are known.
func refreshDependentFixtures(app core.App, slot *core.Record) error {
	dependents, err := app.FindRecordsByFilter(
		"fixtures",
		"home_slot = {:slot} || away_slot = {:slot}",
		"",
		0, 0,
		dbx.Params{"slot": slot.Id},
	)
	if err != nil {
		return err
	}

	entry := slot.GetString("entry")

	for _, f := range dependents {
		changed := false

		if f.GetString("home_slot") == slot.Id && f.GetString("home_entry") != entry {
			f.Set("home_entry", entry)
			changed = true
		}
		if f.GetString("away_slot") == slot.Id && f.GetString("away_entry") != entry {
			f.Set("away_entry", entry)
			changed = true
		}

		// A fixture becomes playable the moment both sides are known.
		if f.GetString("status") == "pending" &&
			f.GetString("home_entry") != "" && f.GetString("away_entry") != "" {
			f.Set("status", "ready")
			changed = true
		}

		if !changed {
			continue
		}
		if err := app.Save(f); err != nil {
			return err
		}
	}
	return nil
}

// settleBye decides a fixture whose opponent slot is an explicit bye.
//
// The empty side must be a *declared* bye — a slot that is merely waiting on an
// earlier result looks identical otherwise, and advancing against it would be
// wrong. Reports whether the fixture was changed and saved.
func settleBye(app core.App, f *core.Record) (bool, error) {
	status := f.GetString("status")
	if status != "pending" && status != "ready" {
		return false, nil
	}

	home := f.GetString("home_entry")
	away := f.GetString("away_entry")
	if (home == "") == (away == "") {
		return false, nil // both sides known, or neither
	}

	emptySlotID := f.GetString("away_slot")
	present := home
	if home == "" {
		emptySlotID = f.GetString("home_slot")
		present = away
	}
	if emptySlotID == "" || present == "" {
		return false, nil
	}

	slot, err := app.FindRecordById("slots", emptySlotID)
	if err != nil {
		return false, err
	}
	if slot.GetString("source_type") != "bye" {
		return false, nil
	}

	f.Set("status", "bye")
	f.Set("winner", present)
	f.Set("loser", "")
	return true, app.Save(f)
}

// ResolveStage re-runs propagation for every settled fixture in a stage.
//
// Propagation is event-driven, which misses two real cases: slots created
// after the fixture they source from (bracket generation writes both, and
// order is not guaranteed), and a score corrected hours later. This is the
// repair path for both — it is idempotent, so it is always safe to call.
func ResolveStage(app core.App, stageID string) (int, error) {
	fixtures, err := app.FindRecordsByFilter(
		"fixtures",
		"stage = {:stage}",
		"round, position",
		0, 0,
		dbx.Params{"stage": stageID},
	)
	if err != nil {
		return 0, err
	}

	resolved := 0
	for _, f := range fixtures {
		if !isSettled(f.GetString("status")) {
			continue
		}
		if err := PropagateFixture(app, f); err != nil {
			return resolved, err
		}
		resolved++
	}
	return resolved, nil
}
