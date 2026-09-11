package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Rate limits for the new OAuth endpoints, added to whatever
// 1788134400_rate_limits.go already set rather than replacing it — that
// migration's own `down` clears the whole list, so appending here (and
// removing only these three labels in this migration's `down`) is what
// keeps the two independently reversible.
//
//   - /oauth/register  the DCR equivalent of users:create: unauthenticated,
//     and some clients re-register on every connection rather than caching
//     a client_id, which is worth budget for without inviting a script to
//     spam the oauth_clients table.
//   - /oauth/authorize  public, but writes an oauth_requests row per hit.
//   - /oauth/token      covers both the code exchange and every refresh; an
//     agent doing real work refreshes occasionally, not in a loop.
func init() {
	newRules := []core.RateLimitRule{
		{Label: "/oauth/register", MaxRequests: 20, Duration: 60, Audience: ""},
		{Label: "/oauth/authorize", MaxRequests: 60, Duration: 60, Audience: ""},
		{Label: "/oauth/token", MaxRequests: 60, Duration: 60, Audience: ""},
	}

	m.Register(func(app core.App) error {
		settings := app.Settings()
		settings.RateLimits.Rules = append(settings.RateLimits.Rules, newRules...)
		return app.Save(settings)
	}, func(app core.App) error {
		settings := app.Settings()
		added := map[string]bool{}
		for _, rule := range newRules {
			added[rule.Label] = true
		}
		kept := settings.RateLimits.Rules[:0]
		for _, rule := range settings.RateLimits.Rules {
			if !added[rule.Label] {
				kept = append(kept, rule)
			}
		}
		settings.RateLimits.Rules = kept
		return app.Save(settings)
	})
}
