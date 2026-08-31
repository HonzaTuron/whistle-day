package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// displays.panels — which panels this screen is allowed to rotate through.
//
// `mode` could already lock a screen to one panel, which is the right answer
// for a screen by the door showing nothing but the next matches. It is the
// wrong answer for the main wall, where what an organiser actually wants is
// everything *except* the two panels that do not apply to their day — a
// one-court hall does not need a court schedule, and a straight knockout has
// no group tables to show. Between "one panel" and "all nine" there was
// nothing.
//
// A list of the panels to keep, and empty means all of them. Empty rather than
// a full list on every record because it is the default, and a default written
// out is a default that goes stale: a screen configured today would otherwise
// never show a panel added next month.
//
// The credit panel is not in here. It closes every rotation and is where the
// sponsors live, so it is not an organiser's to switch off — see
// `buildPanels` in the web app.
//
// `mode` gains the two panels it was already able to render but never listed:
// court_schedule and stage_progress were reachable from the rotation and not
// from the select, so a screen could show them but not be pinned to them.
var displayModes = []string{
	"auto",
	"now_playing",
	"standings",
	"bracket",
	"schedule",
	"results",
	"court_schedule",
	"stage_progress",
}

func init() {
	m.Register(func(app core.App) error {
		displays, err := app.FindCollectionByNameOrId("displays")
		if err != nil {
			return err
		}

		displays.Fields.Add(jsn("panels"))

		if mode, ok := displays.Fields.GetByName("mode").(*core.SelectField); ok {
			mode.Values = displayModes
		}

		return app.Save(displays)
	}, func(app core.App) error {
		displays, err := app.FindCollectionByNameOrId("displays")
		if err != nil {
			return nil // already gone
		}

		displays.Fields.RemoveByName("panels")

		// Screens pinned to a panel the old select did not know about would
		// fail validation on their next write, so they go back to rotating.
		if mode, ok := displays.Fields.GetByName("mode").(*core.SelectField); ok {
			mode.Values = []string{
				"auto", "bracket", "standings", "schedule", "now_playing", "results",
			}
			for _, name := range []string{"court_schedule", "stage_progress"} {
				records, err := app.FindRecordsByFilter(
					"displays", "mode = {:mode}", "", 0, 0,
					map[string]any{"mode": name},
				)
				if err != nil {
					continue
				}
				for _, record := range records {
					record.Set("mode", "auto")
					if err := app.Save(record); err != nil {
						return err
					}
				}
			}
		}

		return app.Save(displays)
	})
}
