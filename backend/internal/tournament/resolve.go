// Package tournament holds the server-authoritative tournament logic: deriving
// a fixture's outcome from its score, and propagating that outcome into the
// slots that depend on it.
//
// This lives in Go rather than pb_hooks because it must be transactional and
// because goja (PocketBase's JS runtime) is a poor place for real logic.
package tournament

import (
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
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
		if err := guardResult(e.App, e.Record); err != nil {
			return err
		}
		deriveOutcome(e.Record)
		return e.Next()
	})
	app.OnRecordUpdate("fixtures").BindFunc(func(e *core.RecordEvent) error {
		if err := guardResult(e.App, e.Record); err != nil {
			return err
		}
		deriveOutcome(e.Record)
		return e.Next()
	})

	// A set the format does not have. Create only — see guardSetNumber.
	app.OnRecordCreate("games").BindFunc(func(e *core.RecordEvent) error {
		if err := guardSetNumber(e.App, e.Record); err != nil {
			return err
		}
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
	// A Swiss stage draws its next round here: it is a function of the table,
	// so this is the first moment the table it depends on exists.
	if _, err := PairNextRound(app, stageID); err != nil {
		return err
	}
	if _, err := ResolvePoolRanks(app, stageID); err != nil {
		return err
	}
	_, err := ResolveStageRanks(app, stageID)
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

// guardResult is every rule about what a stored result may say, in the order
// an organiser meets them: a match that cannot end level, and a match that
// cannot end at that many sets.
func guardResult(app core.App, f *core.Record) error {
	if err := guardLevelScore(app, f); err != nil {
		return err
	}
	return guardBestOf(app, f)
}

// guardLevelScore refuses to store a finished fixture whose sides are level,
// in the two cases where a draw is not a result anybody can mean.
//
// Without it a level score is accepted and quietly does nothing: deriveOutcome
// leaves winner and loser empty, and the table credits a draw that the sport
// does not have while a bracket simply stops — the slot waiting on the winner
// of that match never fills, and the first anyone knows is a projector showing
// "Winner SF1" an hour after SF1 was played.
//
// It reads nothing until the score is actually level and the fixture actually
// finished, so the ordinary write pays for neither lookup.
func guardLevelScore(app core.App, f *core.Record) error {
	if f.GetString("status") != "finished" {
		return nil
	}
	if f.GetInt("home_score") != f.GetInt("away_score") {
		return nil
	}

	// A knockout has to produce somebody to put in the next round, whatever
	// the rulebook says about draws in the group stage.
	stage, err := app.FindRecordById("stages", f.GetString("stage"))
	if err != nil {
		return err
	}
	switch stage.GetString("format") {
	case "single_elim", "double_elim":
		return apis.NewApiError(http.StatusBadRequest,
			"A knockout match cannot end level — somebody has to go through.", nil)
	}

	tournament, err := app.FindRecordById("tournaments", f.GetString("tournament"))
	if err != nil {
		return err
	}
	if scoringConfig(tournament).DrawsAllowedOr() {
		return nil
	}
	return apis.NewApiError(http.StatusBadRequest,
		"This tournament is scored without draws, so a match cannot end level.", nil)
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
// When the fixture is no longer settled (a result was cleared), every slot that
// sourced its entry from this fixture is cleared instead — the old winner is
// no longer valid.
//
// It is idempotent: re-running it on an already-propagated fixture writes
// nothing, so a corrected score can safely be replayed.
func PropagateFixture(app core.App, fixture *core.Record) error {
	// A fixture facing somebody who has gone home is decided the moment the
	// other side is known — a bracket match drawn on Friday can learn on
	// Saturday afternoon that its opponent withdrew in the morning.
	if closed, err := settleWithdrawn(app, fixture); err != nil {
		return err
	} else if closed {
		return nil
	}

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
		return unpropagateFixture(app, fixture)
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

			// A match nobody had to play has a winner and no loser. In a single
			// elimination nothing is waiting on that loser; a losers bracket
			// is, and it would wait for ever. Turning the slot into a declared
			// bye lets settleBye decide the match it feeds, which is what
			// happens on paper: the other side walks through.
			if entry == "" && slot.GetString("source_type") == "fixture_loser" &&
				fixture.GetString("status") == "bye" {
				if slot.GetString("source_type") == "bye" {
					continue
				}
				slot.Set("source_type", "bye")
				slot.Set("label", "Bye")
				if err := tx.Save(slot); err != nil {
					return err
				}
				touched = append(touched, slot)
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

// unpropagateFixture clears every slot that sourced its entry from this
// fixture, and re-refreshes the fixtures that depend on those slots. Called
// when a settled fixture has been unsettled (e.g. a result was cleared), so
// downstream brackets do not keep pointing at an invalid winner.
func unpropagateFixture(app core.App, fixture *core.Record) error {
	// The filter asks one thing — which slots this fixture feeds — and the rest
	// is decided in Go. A slot left holding a stale winner is precisely the bug
	// this function exists to prevent, so it is not worth resting on how a
	// relation field compares against '' inside a filter string.
	slots, err := app.FindRecordsByFilter(
		"slots",
		"source_fixture = {:fixture}",
		"",
		0, 0,
		dbx.Params{"fixture": fixture.Id},
	)
	if err != nil {
		return err
	}
	if len(slots) == 0 {
		return nil
	}

	return app.RunInTransaction(func(tx core.App) error {
		touched := make([]*core.Record, 0, len(slots))
		for _, slot := range slots {
			if slot.GetString("entry") == "" {
				continue
			}
			if slot.GetString("source_type") != "fixture_winner" &&
				slot.GetString("source_type") != "fixture_loser" {
				continue
			}
			slot.Set("entry", "")
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

		// A fixture becomes playable the moment both sides are known — and
		// stops being playable the moment one of them is taken away again,
		// which is what happens when a result upstream is cleared.
		known := f.GetString("home_entry") != "" && f.GetString("away_entry") != ""
		switch {
		case f.GetString("status") == "pending" && known:
			f.Set("status", "ready")
			changed = true
		case f.GetString("status") == "ready" && !known:
			f.Set("status", "pending")
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
