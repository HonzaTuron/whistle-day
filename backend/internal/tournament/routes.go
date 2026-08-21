package tournament

import (
	"net/http"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// RegisterRoutes adds the custom endpoints that collection rules cannot express.
func RegisterRoutes(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Re-resolve a whole stage. Used after generating a bracket and as the
		// repair path when a result is corrected after the fact.
		se.Router.POST("/api/stages/{stage}/resolve", func(e *core.RequestEvent) error {
			stageID := e.Request.PathValue("stage")

			stage, err := e.App.FindRecordById("stages", stageID)
			if err != nil {
				return e.NotFoundError("stage not found", err)
			}

			if err := requireStaff(e, stage.GetString("tournament")); err != nil {
				return err
			}

			resolved, err := ResolveStage(e.App, stage.Id)
			if err != nil {
				return e.InternalServerError("resolve failed", err)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"stage":    stage.Id,
				"resolved": resolved,
			})
		}).Bind(apis.RequireAuth())

		return se.Next()
	})
}

// requireStaff mirrors the staffOnly collection rule for custom routes, which
// are not covered by collection API rules.
func requireStaff(e *core.RequestEvent, tournamentID string) error {
	auth := e.Auth
	if auth == nil {
		return e.UnauthorizedError("authentication required", nil)
	}
	if auth.IsSuperuser() {
		return nil
	}

	tournament, err := e.App.FindRecordById("tournaments", tournamentID)
	if err != nil {
		return e.NotFoundError("tournament not found", err)
	}
	if tournament.GetString("owner") == auth.Id {
		return nil
	}

	member, _ := e.App.FindFirstRecordByFilter(
		"staff",
		"tournament = {:tournament} && user = {:user}",
		map[string]any{"tournament": tournamentID, "user": auth.Id},
	)
	if member == nil {
		return e.ForbiddenError("not a staff member of this tournament", nil)
	}
	return nil
}
