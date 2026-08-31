package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// staff.name, and letting a crew see itself.
//
// Two things that only became problems once a tournament could have more than
// one person in it.
//
// **The name.** `fixture_events.actor` is a relation to `users`, and the users
// collection lets an account view itself and nobody else — rightly, since it
// holds email addresses. So the owner could hold a complete log of who changed
// which result and be unable to render a single one of those names. Putting
// the name on the staff row instead solves it at the level the question is
// actually asked: not "who is this account" but "who is this, at this
// tournament". It is what the person typed when they scanned the code, it is
// scoped to the event, and it leaks nothing about the account behind it. A
// device account has no name worth showing anyway — the wizard sets "Organiser"
// on all of them.
//
// **The read rule.** It was `tournament.owner = auth || user = auth`, which
// means a referee could see their own staff row and not their colleagues'.
// That was invisible while nobody had colleagues. Now it is the difference
// between a match history that says "changed 2–0 to 2–1 · Jana" and one that
// says it only to the owner. Reads widen to the whole crew; writes stay
// owner-only, because a referee who could write here could rename or re-role
// themselves.
func init() {
	m.Register(func(app core.App) error {
		staff, err := app.FindCollectionByNameOrId("staff")
		if err != nil {
			return err
		}

		// Optional: a row created through the API rather than by scanning a
		// code has nobody to have typed one, and a crew member with no name is
		// better than a join that fails on a blank box.
		staff.Fields.Add(txt("name", false, 60))

		crew := staffOnly("tournament")
		staff.ListRule = types.Pointer(crew)
		staff.ViewRule = types.Pointer(crew)

		return app.Save(staff)
	}, func(app core.App) error {
		staff, err := app.FindCollectionByNameOrId("staff")
		if err != nil {
			return nil // already gone
		}

		staff.Fields.RemoveByName("name")

		self := "@request.auth.id != '' && (tournament.owner = @request.auth.id || " +
			"user = @request.auth.id)"
		staff.ListRule = types.Pointer(self)
		staff.ViewRule = types.Pointer(self)

		return app.Save(staff)
	})
}
