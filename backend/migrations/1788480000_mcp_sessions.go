package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

/*
mcp_sessions — which anonymous account an MCP connection has been acting as.

`create_tournament` used to answer an agent with no account by minting one
and returning its auth token as a tool result, for the agent to pass back as
an argument on every later call. That put a credential in the model's context
twice per call. This table is what replaces it: the account is remembered
against the connection's own Mcp-Session-Id — a header the transport carries
and the model never sees — so nothing secret has to travel through a tool.

`session` is a SHA-256 of that id rather than the id, for the same reason a
password is not stored: the id is the credential, and a copy of this table
should not be a list of them.

No collection rules, like handoffs and the oauth_* collections: superuser
only, read and written by internal/mcp and nothing else. Deleting the account
takes its rows with it.
*/
func init() {
	m.Register(func(app core.App) error {
		b := &builder{app: app}

		sessions := core.NewBaseCollection("mcp_sessions")
		sessions.Fields.Add(
			txt("session", true, 64),
			b.rel("user", "users", true, true),
		)
		stamps(sessions)
		sessions.AddIndex("idx_mcp_sessions_session", true, "session", "")
		b.save(sessions)

		return b.err
	}, func(app core.App) error {
		c, err := app.FindCollectionByNameOrId("mcp_sessions")
		if err != nil {
			return nil
		}
		return app.Delete(c)
	})
}
