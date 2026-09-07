package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

/*
Rate limits, shaped around the fact that a hall is one IP address.

PocketBase counts per client IP, and two hundred people in a sports hall are
behind one NAT. So the usual advice — a blanket cap on `/api/` — is exactly
wrong here: PocketBase's own default of 300 requests per 10 seconds sounds
generous until it is the whole venue's budget, and the first thing to break is
the phone the referee is holding.

What that means is that the rules below are deliberately *not* about traffic
volume. Every one of them guards a specific endpoint where a stranger can make
this server do work or make it store something, and none of them sits in front
of the paths a tournament actually runs on:

  - `GET /api/display/{token}`  a projector re-reads this on every nudge
  - `GET /api/realtime`         one long connection per screen
  - the collection API          every result, every set, every phone

Those have no rule at all, on purpose. A limit there is a wall going dark
mid-match, which is worse than anything a rate limit prevents.

The four that do have rules:

  - `*:auth`     brute force. Signing in is rare even in a busy hall — an
    organiser does it once — so this can be tight enough to
    matter without ever being met by a real person.
  - `/api/preview`  public, unauthenticated, and quadratic: a round robin is
    n² fixtures, capped at 128 teams. The cap bounds one request;
    this bounds how many.
  - `/api/mcp`   the one unauthenticated *write* on this server, because
    `create_tournament` deliberately needs no credential. Agents
    are not in the hall, so a per-IP limit costs nothing here.
  - user create  each wizard and each referee joining makes a device account,
    so this has to clear a crew arriving at once — but not a
    script making thousands.

Set here rather than in the dashboard so the reasoning above lives next to the
numbers, and so a rebuilt pb_data comes back with them. A migration rather
than something re-applied on every boot: changing a limit during an incident
should not mean a deploy, and this does not fight the dashboard afterwards.
*/
func init() {
	m.Register(func(app core.App) error {
		settings := app.Settings()

		settings.RateLimits.Enabled = true
		settings.RateLimits.Rules = []core.RateLimitRule{
			// Roughly one attempt every two seconds, sustained. A person
			// signing in never notices; a list of passwords does.
			{Label: "*:auth", MaxRequests: 5, Duration: 10, Audience: ""},

			// A marketing page renders one preview when it loads, and a
			// printable sheet re-renders when somebody types a team name. Sixty
			// a minute is a person using it; it is not a loop.
			{Label: "/api/preview", MaxRequests: 60, Duration: 60, Audience: ""},

			// Every MCP call goes through this one path, so it has to allow an
			// agent doing real work: filling a sixteen-team tournament is a few
			// dozen calls in a burst.
			{Label: "/api/mcp", MaxRequests: 120, Duration: 60, Audience: ""},

			// A crew of referees scanning a QR code at the start of the day all
			// create a device account within a minute or two of each other,
			// from the same wifi. Thirty clears that with room; a script making
			// accounts in bulk does not.
			{Label: "users:create", MaxRequests: 30, Duration: 60, Audience: ""},
		}

		return app.Save(settings)
	}, func(app core.App) error {
		settings := app.Settings()
		settings.RateLimits.Enabled = false
		settings.RateLimits.Rules = nil
		return app.Save(settings)
	})
}
