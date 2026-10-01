package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// oauth_requests.state — room for what a client actually sends.
//
// `state` is the client's to choose and this server only hands it back, so
// 500 characters was a guess at "more than anybody needs". ChatGPT's plugin
// dashboard packs a base64 JSON relay into it — which app, which version,
// where to return to — and arrives with 553, so /oauth/authorize
// refused it at the validator and answered "Could not start signing in."
//
// 4000 rather than unlimited: it is still a column an unauthenticated request
// can write to, and with the redirect_uri beside it that keeps a row inside
// what a URL can carry anyway.
const oauthStateMax = 4000

func init() {
	m.Register(func(app core.App) error {
		return setOAuthStateMax(app, oauthStateMax)
	}, func(app core.App) error {
		return setOAuthStateMax(app, 500)
	})
}

func setOAuthStateMax(app core.App, max int) error {
	requests, err := app.FindCollectionByNameOrId("oauth_requests")
	if err != nil {
		return err
	}
	state, ok := requests.Fields.GetByName("state").(*core.TextField)
	if !ok {
		return nil
	}
	state.Max = max
	return app.Save(requests)
}
