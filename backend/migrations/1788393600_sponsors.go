package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// sponsors — the closing panel's logos, one row per business rather than a
// blob of JSON somebody had to hand-edit through the admin UI.
//
// Modelled on entries: a name, a picture, and a position, scoped to the
// tournament that sold the slot. `tier` is free text ("Main partner",
// "Official ball") rather than a select — a two-day club tournament and a
// touring pro event are not choosing from the same list of names.
//
// It replaces `displays.theme.sponsors`, which asked an organiser to paste a
// URL to an image hosted somewhere else into raw JSON. This shows what
// somebody can upload instead of what somebody could already host, and it is
// read once per tournament rather than once per screen — see `sponsorSlots`
// in backend/internal/tournament/display.go, which still gates every row on
// the tournament owner's subscription before a screen ever sees one.
func init() {
	m.Register(func(app core.App) error {
		b := &builder{app: app}

		sponsors := core.NewBaseCollection("sponsors")
		sponsors.ListRule = types.Pointer(publicOrStaff("tournament"))
		sponsors.ViewRule = types.Pointer(publicOrStaff("tournament"))
		sponsors.CreateRule = types.Pointer(staffOnly("tournament"))
		sponsors.UpdateRule = types.Pointer(staffOnly("tournament"))
		sponsors.DeleteRule = types.Pointer(staffOnly("tournament"))
		sponsors.Fields.Add(
			b.rel("tournament", "tournaments", true, true),
			txt("name", true, 120),
			img("logo", 2097152),
			txt("tier", false, 60),
			num("position", false),
		)
		stamps(sponsors)
		sponsors.AddIndex("idx_sponsors_tournament", false, "tournament, position", "")
		b.save(sponsors)

		return b.err
	}, func(app core.App) error {
		sponsors, err := app.FindCollectionByNameOrId("sponsors")
		if err != nil {
			return nil // already gone
		}
		return app.Delete(sponsors)
	})
}
