package tournament

import (
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// subscriptionField is the one column on `users` that says whether an account
// is paying. Nothing outside this file should name it.
const subscriptionField = "subscription_until"

// SubscriptionActive reports whether an account is paying for something today.
//
// Empty is an account that never subscribed and a past date is one that has
// lapsed; both are the same answer here, and the difference is kept only
// because the column happens to record it. A subscription meant to last is a
// date far ahead — there is no value that means "for ever", because a
// subscription that cannot expire is an account nobody ever revisits.
//
// A missing user is not subscribed. That matters more than it reads: the
// caller is the projector, and "we could not load the owner" has to fall out on
// the same side as "the owner is not paying".
func SubscriptionActive(user *core.Record) bool {
	if user == nil {
		return false
	}
	until := user.GetDateTime(subscriptionField)
	return !until.IsZero() && until.Time().After(time.Now())
}

// RegisterSubscriptionGuard stops an account from selling itself a
// subscription.
//
// A user record is writable by the person it belongs to — that is what lets an
// organiser put their own email on a device account — and the subscription
// lives on that same record. A collection rule cannot say "every field except
// this one", so the exception is a hook.
//
// Only *request* hooks are bound, so whatever grants a subscription
// server-side (a payment webhook, an admin, a migration) goes through app.Save
// and is not affected. That asymmetry is the point: the field is writable,
// just not by the account it is about.
func RegisterSubscriptionGuard(app core.App) {
	// Signup posts whatever it likes.
	app.OnRecordCreateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
		if !isSuperuser(e.Auth) {
			e.Record.Set(subscriptionField, "")
		}
		return e.Next()
	})

	app.OnRecordUpdateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
		if isSuperuser(e.Auth) {
			return e.Next()
		}

		original := e.Record.Original()
		if original == nil {
			return e.Next()
		}

		if e.Record.GetString(subscriptionField) != original.GetString(subscriptionField) {
			// Refused rather than silently reverted: a request that tried to
			// buy itself a subscription should hear about it, and a client
			// that sent the field by accident should be fixed.
			return e.ForbiddenError(
				"a subscription is not something an account sets on itself", nil,
			)
		}

		return e.Next()
	})
}

func isSuperuser(auth *core.Record) bool {
	return auth != nil && auth.IsSuperuser()
}
