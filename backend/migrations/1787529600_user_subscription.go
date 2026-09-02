package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// users.subscription_until — when an organiser's subscription runs out.
//
// The only thing it buys today is the sponsor slots on the projector's closing
// panel: a free tournament credits Whistle.day, a paid one credits Whistle.day and the
// people who paid for the hall.
//
// It hangs off the user rather than the tournament because that is what is
// actually bought — somebody who runs four events a year does not buy it four
// times. The projector reaches it through `tournaments.owner`.
//
// One date, and no plan column beside it. "Is this account paying" is a
// question a date already answers, and it answers "has it lapsed" as well:
// empty is an account that never subscribed, a date in the past is one that
// did. A subscription meant to last is written far ahead. Tiers, if there are
// ever any, are a select added then and backfilled from this — inventing one
// now would mean maintaining two columns that can disagree, for a distinction
// nothing makes.
//
// The field is on a record its owner may write — that is what lets somebody
// change their own email — so the collection rules cannot protect it. The
// guard is a hook: tournament.RegisterSubscriptionGuard.
func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.Fields.Add(dt("subscription_until"))

		return app.Save(users)
	}, func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return nil // already gone
		}
		users.Fields.RemoveByName("subscription_until")
		return app.Save(users)
	})
}
