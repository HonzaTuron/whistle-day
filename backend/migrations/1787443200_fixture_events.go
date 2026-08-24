package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// fixture_events — an append-only record of who changed a result, and to what.
//
// A fixture holds one score, and overwriting it destroys the previous one. The
// tables are rebuilt from scratch every time precisely so that a correction
// leaves no trace in them; this is where the trace lives instead. When someone
// argues about a qualification the day after, `standings.tiebreak` says which
// criteria separated the teams and this says whether the numbers underneath
// were ever anything else.
//
// Only hooks write here: create, update and delete rules are all nil, so not
// even the tournament's owner can edit the log of their own edits. Reads follow
// the tournament — a public tournament's history is public, because a result
// that was changed in public should be changeable to see.
func init() {
	m.Register(func(app core.App) error {
		b := &builder{app: app}

		events := core.NewBaseCollection("fixture_events")
		events.ListRule = types.Pointer(publicOrStaff("fixture.tournament"))
		events.ViewRule = types.Pointer(publicOrStaff("fixture.tournament"))
		events.Fields.Add(
			b.rel("fixture", "fixtures", true, true),
			// Who did it. Optional and non-cascading: the log outlives the
			// account, and a row with nobody on it is better than no row.
			b.rel("actor", "users", false, false),
			sel("kind", true, "recorded", "corrected", "cleared"),
			txt("status", false, 20),
			num("home_score", false),
			num("away_score", false),
			b.rel("winner", "entries", false, false),
			// What it was before, so a row reads as a change rather than a
			// state: { status, home_score, away_score, winner }.
			jsn("previous"),
		)
		events.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
		events.AddIndex("idx_fixture_events_fixture", false, "fixture, created", "")
		b.save(events)

		return b.err
	}, func(app core.App) error {
		events, err := app.FindCollectionByNameOrId("fixture_events")
		if err != nil {
			return nil // already gone
		}
		return app.Delete(events)
	})
}
