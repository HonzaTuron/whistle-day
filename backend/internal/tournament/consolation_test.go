package tournament

import (
	"testing"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// finish settles one fixture with the home side winning and lets the hooks
// propagate it, which is what fills the slots waiting on the result.
func finish(t *testing.T, app core.App, f *core.Record) {
	t.Helper()
	f.Set("status", "finished")
	f.Set("home_score", 2)
	f.Set("away_score", 0)
	if err := app.Save(f); err != nil {
		t.Fatalf("finish %s: %v", f.GetString("code"), err)
	}
}

func poolByKind(t *testing.T, app core.App, stageID, kind string) *core.Record {
	t.Helper()
	pool, err := app.FindFirstRecordByFilter(
		"pools", "stage = {:s} && kind = {:k}",
		dbx.Params{"s": stageID, "k": kind},
	)
	if err != nil {
		t.Fatalf("pool %q: %v", kind, err)
	}
	return pool
}

// A consolation bracket catches the first-round losers of a single elimination
// and plays them down to a plate winner in a pool of its own.
func TestConsolationBracketCatchesTheFirstRoundLosers(t *testing.T) {
	app := newScoringApp(t)
	_, stage, _ := lateCup(t, app, "single_elim", `{"consolation":true}`, 8)

	plate := poolByKind(t, app, stage.Id, "consolation")

	// Before any result, the plate's entry slots wait on the main draw.
	seats, err := poolSlots(app, plate)
	if err != nil {
		t.Fatalf("plate slots: %v", err)
	}
	if len(seats) != 4 {
		t.Fatalf("plate round-0 slots = %d, want 4", len(seats))
	}
	for _, seat := range seats {
		if seat.GetString("entry") != "" {
			t.Fatal("a plate seat was filled before the main draw was played")
		}
		if seat.GetString("source_type") != "fixture_loser" {
			t.Errorf("plate seat source = %q, want fixture_loser", seat.GetString("source_type"))
		}
	}

	// Play the main first round. Home wins every time, so the away side of each
	// first-round fixture drops to the plate.
	main := poolByKind(t, app, stage.Id, "winners")
	firstRound, err := app.FindRecordsByFilter(
		"fixtures", "pool = {:p} && round = 0", "position", 0, 0,
		dbx.Params{"p": main.Id},
	)
	if err != nil {
		t.Fatalf("first round: %v", err)
	}
	if len(firstRound) != 4 {
		t.Fatalf("main first round = %d fixtures, want 4", len(firstRound))
	}

	dropped := map[string]bool{}
	for _, f := range firstRound {
		dropped[f.GetString("away_entry")] = true
		finish(t, app, f)
	}

	// Every plate seat now holds one of those losers, and nobody else.
	seats, err = poolSlots(app, plate)
	if err != nil {
		t.Fatalf("plate slots after round one: %v", err)
	}
	landed := map[string]bool{}
	for _, seat := range seats {
		entry := seat.GetString("entry")
		if entry == "" {
			t.Fatal("a plate seat is still empty after the first round was played")
		}
		if !dropped[entry] {
			t.Errorf("plate seat holds %q, who did not lose in round one", entry)
		}
		landed[entry] = true
	}
	if len(landed) != 4 {
		t.Errorf("plate holds %d distinct teams, want 4", len(landed))
	}

	// The plate plays out to a single winner.
	plateFixtures, err := app.FindRecordsByFilter(
		"fixtures", "pool = {:p}", "round, position", 0, 0,
		dbx.Params{"p": plate.Id},
	)
	if err != nil {
		t.Fatalf("plate fixtures: %v", err)
	}
	if len(plateFixtures) != 3 {
		t.Fatalf("plate fixtures = %d, want 3 (two semis, a final)", len(plateFixtures))
	}
	for _, f := range plateFixtures {
		if f.GetString("code") == "" || f.GetString("code")[0] != 'P' {
			t.Errorf("plate fixture code %q is not prefixed", f.GetString("code"))
		}
	}

	// Semis first, then whatever the final turns out to be.
	for _, f := range plateFixtures {
		if f.GetInt("round") == 0 {
			finish(t, app, f)
		}
	}
	plateFinal, err := app.FindFirstRecordByFilter(
		"fixtures", "pool = {:p} && round = 1", dbx.Params{"p": plate.Id},
	)
	if err != nil {
		t.Fatalf("plate final: %v", err)
	}
	if plateFinal.GetString("home_entry") == "" || plateFinal.GetString("away_entry") == "" {
		t.Fatal("the plate final never learned who was in it")
	}
	finish(t, app, plateFinal)

	champ, err := app.FindFirstRecordByFilter(
		"slots", "pool = {:p} && round = 2", dbx.Params{"p": plate.Id},
	)
	if err != nil {
		t.Fatalf("plate champion slot: %v", err)
	}
	if champ.GetString("entry") != plateFinal.GetString("winner") {
		t.Errorf("plate champion = %q, want the final's winner %q",
			champ.GetString("entry"), plateFinal.GetString("winner"))
	}
}
