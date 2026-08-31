package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// invites — a join link for a second person on a second phone.
//
// `staff` has been enforced by every write rule in the schema since day one and
// there has never been a way to put a row in it. This is that way, and it is
// modelled on `displays` rather than on an email: the referee is standing next
// to the organiser, so an unguessable token on a QR code is both the invitation
// and the authentication. Proximity is the credential. Anyone who can scan the
// code off the organiser's screen is someone the organiser is already handing a
// court to.
//
// One row per role rather than one per person. The organiser shows the referee
// QR all morning to whoever turns up; minting a token per name would mean
// typing names into a phone in a hall, which is the friction this avoids.
// Individuals are revoked afterwards by deleting their `staff` row, and a link
// that got out is revoked by deactivating the invite.
//
// Every rule here is owner-only, deliberately, and not `staffOnly` like the
// collections around it. An invite mints staff, so anything looser would be a
// way around `staff`'s own owner-only create rule: a scorer who could write
// here could issue themselves an `organizer` token. That does mean a
// co-organiser cannot invite anyone, which is the same limit `staff` already
// has and is the right way round for a mistake to fall.
//
// There is no public read rule. The join screen needs the tournament's name
// before anyone commits to joining, and that is served by GET
// /api/staff/invite/{token} — a route, so that holding the token reveals a name
// and a role and never the row.
func init() {
	m.Register(func(app core.App) error {
		b := &builder{app: app}

		invites := core.NewBaseCollection("invites")
		ownerOnly := "@request.auth.id != '' && tournament.owner = @request.auth.id"
		invites.ListRule = types.Pointer(ownerOnly)
		invites.ViewRule = types.Pointer(ownerOnly)
		invites.CreateRule = types.Pointer(ownerOnly)
		invites.UpdateRule = types.Pointer(ownerOnly)
		invites.DeleteRule = types.Pointer(ownerOnly)
		invites.Fields.Add(
			b.rel("tournament", "tournaments", true, true),
			txt("token", true, 64),
			sel("role", true, "organizer", "referee", "scorer"),
			bln("active"),
		)
		stamps(invites)
		invites.AddIndex("idx_invites_token", true, "token", "")
		invites.AddIndex("idx_invites_tournament", false, "tournament, role", "")
		b.save(invites)

		return b.err
	}, func(app core.App) error {
		invites, err := app.FindCollectionByNameOrId("invites")
		if err != nil {
			return nil // already gone
		}
		return app.Delete(invites)
	})
}
