package main

import (
	"log"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"seedly/backend/internal/tournament"
	_ "seedly/backend/migrations"
)

func main() {
	app := pocketbase.New()

	// `go run .` gets automigrate, so schema edits made in the admin UI are
	// written back into migrations/. A compiled binary never rewrites source.
	isGoRun := strings.HasPrefix(os.Args[0], os.TempDir())
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: isGoRun,
	})

	tournament.RegisterHooks(app)
	tournament.RegisterHistory(app)
	tournament.RegisterRoutes(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
