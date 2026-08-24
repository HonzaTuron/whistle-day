package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Let a tournament's own staff read its screens.
//
// The original rule was `active = true && token = @request.query.token`: the
// unguessable token is the screen's only credential, so a projector opens on a
// borrowed laptop and nobody can enumerate screens without one. That part is
// worth keeping exactly as it is.
//
// What it also did, unintentionally, was stop the *owner* asking which screens
// their own tournament has. That was invisible while the only device that
// could organise a tournament was the one that had generated the token and
// kept it in localStorage. Signing in somewhere else makes it visible
// immediately: the organiser can run the day and cannot find the link to put
// it on the wall.
//
// The added branch requires authentication, so the public surface is unchanged
// — without a token an anonymous request still sees nothing.
func init() {
	const publicByToken = "active = true && token = @request.query.token"
	const staff = "@request.auth.id != '' && (tournament.owner = @request.auth.id || " +
		"tournament.staff_via_tournament.user ?= @request.auth.id)"

	m.Register(func(app core.App) error {
		displays, err := app.FindCollectionByNameOrId("displays")
		if err != nil {
			return err
		}
		displays.ListRule = types.Pointer(publicByToken + " || (" + staff + ")")
		displays.ViewRule = types.Pointer(publicByToken + " || (" + staff + ")")
		return app.Save(displays)
	}, func(app core.App) error {
		displays, err := app.FindCollectionByNameOrId("displays")
		if err != nil {
			return err
		}
		displays.ListRule = types.Pointer(publicByToken)
		displays.ViewRule = types.Pointer(publicByToken)
		return app.Save(displays)
	})
}
