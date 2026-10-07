package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// clubs — whoever runs a tournament every month, and the one address all of
// those days hang off.
//
// A tournament has always stood alone: its own owner, its own crew, its own
// screens, and nothing that says the March cup and the April cup were the same
// people in the same hall. A club is that missing row. It owns nothing below
// itself — a tournament still belongs to its `owner` and is still operated by
// its `staff` — and only says which tournaments are shown together at
// `/c/{slug}`.
//
// `tournaments.club` is optional and does not cascade. Putting a day on the
// club page is a decision made per tournament, because the page is public and
// carries a way in to each board it lists; and closing a club must not take
// the results of every day it ever ran with it.
//
// The collection rules are owner-only, reads included. The public page is
// `GET /api/clubs/{slug}` (backend/internal/tournament/club.go), which answers
// for one slug somebody already knows rather than letting the whole list be
// paged through. Who may point a tournament at a club is enforced there too:
// `tournaments.updateRule` lets the crew write, and a referee listing their
// own cup on somebody else's club page is not something a rule on this
// collection can refuse.
func init() {
	m.Register(func(app core.App) error {
		b := &builder{app: app}

		clubs := core.NewBaseCollection("clubs")
		ownerOnly := "@request.auth.id != '' && owner = @request.auth.id"
		clubs.ListRule = types.Pointer(ownerOnly)
		clubs.ViewRule = types.Pointer(ownerOnly)
		clubs.CreateRule = types.Pointer(ownerOnly)
		clubs.UpdateRule = types.Pointer(ownerOnly)
		clubs.DeleteRule = types.Pointer(ownerOnly)
		clubs.Fields.Add(
			txt("name", true, 120),
			// Chosen by the club rather than generated with a random tail the
			// way a tournament's is: this one is printed on a poster.
			&core.TextField{
				Name:     "slug",
				Required: true,
				Min:      3,
				Max:      40,
				Pattern:  `^[a-z0-9]+(-[a-z0-9]+)*$`,
			},
			b.rel("owner", "users", true, true),
			img("logo", 2097152),
			&core.TextField{Name: "accent", Max: 7, Pattern: `^#[0-9a-fA-F]{6}$`},
		)
		stamps(clubs)
		clubs.AddIndex("idx_clubs_slug", true, "slug", "")
		clubs.AddIndex("idx_clubs_owner", false, "owner", "")
		b.save(clubs)

		if b.err != nil {
			return b.err
		}

		tournaments, err := app.FindCollectionByNameOrId("tournaments")
		if err != nil {
			return err
		}
		tournaments.Fields.Add(b.rel("club", "clubs", false, false))
		tournaments.AddIndex("idx_tournaments_club", false, "club", "")
		b.save(tournaments)

		return b.err
	}, func(app core.App) error {
		if tournaments, err := app.FindCollectionByNameOrId("tournaments"); err == nil {
			tournaments.RemoveIndex("idx_tournaments_club")
			tournaments.Fields.RemoveByName("club")
			if err := app.Save(tournaments); err != nil {
				return err
			}
		}

		clubs, err := app.FindCollectionByNameOrId("clubs")
		if err != nil {
			return nil // already gone
		}
		return app.Delete(clubs)
	})
}
