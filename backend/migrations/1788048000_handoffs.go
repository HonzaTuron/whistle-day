package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// handoffs — a link that gives a tournament to a person.
//
// The wizard's account and an agent's account are the same thing: unclaimed,
// owned by nobody, holding a tournament. `/api/organiser/claim` already turns
// one into a person's, but only for somebody who is *already signed in as it*
// — which is fine in the browser that made it and useless everywhere else. An
// agent that built a tournament over MCP cannot hand its session to a human,
// and should not: it is a credential, and it would still work afterwards.
//
// So this is the same claim, arriving from a different place. A row here says
// "whoever opens this link may put their email on that account", and opening
// it does exactly what `/account` does, once.
//
// It is modelled on `invites`, and differs in the two ways that matter.
//
// **It expires.** An invite is shown across a morning and a screen token is
// read off a wall for a week, so neither has a clock on it. This one grants an
// account rather than a role, and a link that grants an account should not be
// good in a chat log a month later.
//
// **It burns.** An invite mints a `staff` row per person and re-scanning is
// idempotent; this transfers ownership and a second use has nothing left to
// mean. `used` is set inside the same transaction as the account write, so a
// link that arrives twice at once cannot claim twice.
//
// No collection rules at all, deliberately, which leaves it superuser-only.
// Every path in and out is a route: minting checks the tournament's owner,
// reading is public because the token is the credential, and claiming is the
// one write. There is no reason for a client to reach the rows themselves, and
// `token` is the whole secret — a list rule that ever leaked one would hand
// over the tournament it belongs to.
func init() {
	m.Register(func(app core.App) error {
		b := &builder{app: app}

		handoffs := core.NewBaseCollection("handoffs")
		handoffs.Fields.Add(
			// The account being given away, not the person receiving it.
			b.rel("user", "users", true, true),
			// Only so the link can say what it is for before anyone accepts it.
			b.rel("tournament", "tournaments", true, true),
			txt("token", true, 64),
			dt("expires"),
			bln("used"),
		)
		stamps(handoffs)
		handoffs.AddIndex("idx_handoffs_token", true, "token", "")
		handoffs.AddIndex("idx_handoffs_tournament", false, "tournament", "")
		b.save(handoffs)

		return b.err
	}, func(app core.App) error {
		handoffs, err := app.FindCollectionByNameOrId("handoffs")
		if err != nil {
			return nil // already gone
		}
		return app.Delete(handoffs)
	})
}
