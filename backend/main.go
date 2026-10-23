package main

import (
	"log"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"whistleday/backend/internal/apidocs"
	"whistleday/backend/internal/mcp"
	"whistleday/backend/internal/oauth"
	"whistleday/backend/internal/tournament"
	_ "whistleday/backend/migrations"
)

func main() {
	app := pocketbase.New()

	// `go run .` gets automigrate, so schema edits made in the admin UI are
	// written back into migrations/. A compiled binary never rewrites source.
	isGoRun := strings.HasPrefix(os.Args[0], os.TempDir())
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: isGoRun,
	})

	tournament.RegisterMail(app)
	tournament.RegisterSocialAuth(app)
	tournament.RegisterHooks(app)
	tournament.RegisterHistory(app)
	tournament.RegisterRealtime(app)
	tournament.RegisterSubscriptionGuard(app)
	tournament.RegisterRoutes(app)
	tournament.RegisterHandoffRoutes(app)
	tournament.RegisterClubs(app)
	tournament.RegisterSweep(app)
	mcp.RegisterMCPServer(app)
	oauth.RegisterOAuthServer(app)
	oauth.RegisterSweep(app)
	apidocs.RegisterRoutes(app)
	apidocs.RegisterCommand(app, app.RootCmd)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
