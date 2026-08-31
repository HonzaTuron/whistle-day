package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Taking a team out of a tournament that has already been drawn.
//
// `entries.status` has accepted `withdrawn` and `disqualified` since the first
// migration, and exactly one place ever read it: the generator, filtering who
// goes into a draw. After generation nothing looked at it at all, so marking
// somebody withdrawn did nothing whatsoever — their fixtures stayed on the
// list, their row stayed in the table, and a Swiss round would cheerfully draw
// them again. The only real path was to open every remaining fixture and record
// a walkover by hand.
//
// Two fields make it mean something.
//
// **entries.withdrawal** is which of the two answers the rulebook gives, and
// they are genuinely different competitions:
//
//   - `forfeit` — everything they already played stands, and everything they
//     have left is a walkover to whoever was due to face them. Right for a team
//     that leaves late, when the results so far were honestly earned.
//   - `void` — every match they were ever in is struck, for both sides. Right
//     for a team that pulls out mid-group, because otherwise whoever happened
//     to have played them already is ranked against a different opponent set
//     from whoever did not.
//
// Neither is a default worth guessing at, so it is asked at the moment somebody
// is taken out and stored next to them.
//
// **fixtures.forfeited_by** records that this fixture was settled because that
// entry went out, rather than because anybody played it. It is what makes the
// decision reversible: putting a team back means clearing the fixtures their
// exit closed, and picking those out by shape — a walkover with no score —
// would also catch a walkover the organiser recorded deliberately an hour
// earlier. It also gives the sheet something truthful to say: not "walkover"
// but "walkover — Beta withdrew".
func init() {
	m.Register(func(app core.App) error {
		entries, err := app.FindCollectionByNameOrId("entries")
		if err != nil {
			return err
		}
		// Optional: an entry that is still in the tournament has no answer to
		// this question, and a required field would force one on every team.
		entries.Fields.Add(sel("withdrawal", false, "forfeit", "void"))
		if err := app.Save(entries); err != nil {
			return err
		}

		fixtures, err := app.FindCollectionByNameOrId("fixtures")
		if err != nil {
			return err
		}
		// Not cascading: deleting an entry should not take the record of what
		// their exit did to the draw with it.
		fixtures.Fields.Add(&core.RelationField{
			Name:         "forfeited_by",
			Required:     false,
			MaxSelect:    1,
			CollectionId: entries.Id,
		})
		return app.Save(fixtures)
	}, func(app core.App) error {
		if entries, err := app.FindCollectionByNameOrId("entries"); err == nil {
			entries.Fields.RemoveByName("withdrawal")
			if err := app.Save(entries); err != nil {
				return err
			}
		}
		if fixtures, err := app.FindCollectionByNameOrId("fixtures"); err == nil {
			fixtures.Fields.RemoveByName("forfeited_by")
			return app.Save(fixtures)
		}
		return nil
	})
}
