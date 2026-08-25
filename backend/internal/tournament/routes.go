package tournament

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

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

		// Draw a Swiss stage's next round.
		//
		// Rounds normally draw themselves: entering the last result of a round
		// is what produces the next one. This is the repair path — the same
		// thing /resolve is for a bracket — and it is idempotent, because the
		// pairing depends only on rounds that are complete.
		se.Router.POST("/api/stages/{stage}/pair", func(e *core.RequestEvent) error {
			stageID := e.Request.PathValue("stage")

			stage, err := e.App.FindRecordById("stages", stageID)
			if err != nil {
				return e.NotFoundError("stage not found", err)
			}
			if err := requireStaff(e, stage.GetString("tournament")); err != nil {
				return err
			}
			if stage.GetString("format") != "swiss" {
				return e.BadRequestError("only a Swiss stage draws rounds as it goes", nil)
			}

			drawn, err := PairNextRound(e.App, stage.Id)
			if err != nil {
				return e.InternalServerError("pairing failed", err)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"stage": stage.Id,
				// -1 when there was nothing to draw: the round in progress is
				// not finished, or the stage has played out.
				"round": drawn.Round,
				// True when the field ran out of fresh opponents and the round
				// repeats a meeting. Nothing is wrong; somebody should know.
				"rematch": drawn.Rematch,
			})
		}).Bind(apis.RequireAuth())

		// Generate a stage's pools, slots and fixtures.
		//
		// ?dry_run=1 returns the plan without writing anything, which is how
		// the organiser previews a draw. Preview and commit therefore run the
		// same generator — there is no second implementation to drift.
		se.Router.POST("/api/stages/{stage}/generate", func(e *core.RequestEvent) error {
			stageID := e.Request.PathValue("stage")

			stage, err := e.App.FindRecordById("stages", stageID)
			if err != nil {
				return e.NotFoundError("stage not found", err)
			}
			if err := requireStaff(e, stage.GetString("tournament")); err != nil {
				return err
			}

			plan, err := PlanStage(e.App, stage)
			if err != nil {
				return e.BadRequestError(err.Error(), err)
			}

			dryRun := e.Request.URL.Query().Get("dry_run")
			if dryRun == "1" || dryRun == "true" {
				return e.JSON(http.StatusOK, map[string]any{
					"stage":   stage.Id,
					"dry_run": true,
					"plan":    plan,
				})
			}

			if err := CommitPlan(e.App, stage, plan); err != nil {
				return e.BadRequestError(err.Error(), err)
			}

			// A bracket seeded from finished pools resolves immediately.
			if _, err := ResolveStage(e.App, stage.Id); err != nil {
				return e.InternalServerError("generated, but resolving failed", err)
			}
			if err := resolveSourceStages(e.App, plan); err != nil {
				return e.InternalServerError("generated, but seeding failed", err)
			}

			stage.Set("status", "seeded")
			if err := e.App.Save(stage); err != nil {
				return err
			}

			return e.JSON(http.StatusOK, map[string]any{
				"stage":    stage.Id,
				"pools":    len(plan.Pools),
				"slots":    len(plan.Slots),
				"fixtures": len(plan.Fixtures),
			})
		}).Bind(apis.RequireAuth())

		// Turn a device account into one somebody can sign in with.
		//
		// The wizard creates an account nobody asked for: a random address and
		// a random password, kept in one browser. That is what lets an
		// organiser start a tournament without meeting a signup form, and it
		// is also the thing that loses them the tournament when they clear
		// their site data. This is where they take it back.
		//
		// PocketBase's own email-change flow sends a confirmation link, which
		// needs SMTP that a hall laptop does not have. Here the caller is
		// already authenticated as the account being claimed, so there is
		// nobody to confirm to — the request IS the proof.
		//
		// It only ever upgrades an unclaimed device account. Pointed at a real
		// one it refuses, because otherwise it would be a way to take over any
		// account whose token leaked.
		se.Router.POST("/api/organiser/claim", func(e *core.RequestEvent) error {
			auth := e.Auth
			if auth == nil || auth.Collection().Name != "users" {
				return e.UnauthorizedError("sign in first", nil)
			}
			if !IsDeviceAccount(auth.Email()) {
				return e.BadRequestError("this account already has an email", nil)
			}

			data := struct {
				Email    string `json:"email"`
				Password string `json:"password"`
			}{}
			if err := e.BindBody(&data); err != nil {
				return e.BadRequestError("could not read the request", err)
			}
			if len(data.Password) < minPasswordLength {
				return e.BadRequestError(
					fmt.Sprintf("the password needs at least %d characters", minPasswordLength),
					nil,
				)
			}

			user, err := e.App.FindRecordById("users", auth.Id)
			if err != nil {
				return e.NotFoundError("account not found", err)
			}

			user.SetEmail(data.Email)
			user.SetPassword(data.Password)
			// Every token issued to the anonymous account stops working, which
			// is the point: what was on the old device is no longer a way in.
			user.RefreshTokenKey()

			if err := e.App.Save(user); err != nil {
				return e.BadRequestError(claimError(err), err)
			}

			// The caller signs in again with what it just set; there is no
			// token to hand back that would still be valid.
			return e.JSON(http.StatusOK, map[string]any{"email": data.Email})
		}).Bind(apis.RequireAuth())

		// One assembled payload for a projector screen.
		//
		// Public on purpose: the unguessable token is the only credential, so
		// the screen opens on a borrowed laptop without anyone logging in. A
		// draft tournament is treated as non-existent rather than forbidden,
		// so the endpoint cannot be used to probe for unpublished events.
		se.Router.GET("/api/display/{token}", func(e *core.RequestEvent) error {
			token := e.Request.PathValue("token")
			if token == "" {
				return e.NotFoundError("display not found", nil)
			}

			display, err := e.App.FindFirstRecordByFilter(
				"displays",
				"token = {:token} && active = true",
				map[string]any{"token": token},
			)
			if err != nil || display == nil {
				return e.NotFoundError("display not found", err)
			}

			payload, err := BuildDisplayPayload(e.App, display)
			if err != nil {
				return e.NotFoundError("display not found", err)
			}
			if payload.Tournament.Status == "draft" {
				return e.NotFoundError("display not found", nil)
			}

			body, err := json.Marshal(payload)
			if err != nil {
				return e.InternalServerError("could not encode payload", err)
			}

			// A screen polls; most polls change nothing. GeneratedAt is
			// excluded from the tag so an unchanged tournament keeps hitting
			// the same one.
			tagged := body
			if trimmed, err := json.Marshal(withoutTimestamp(payload)); err == nil {
				tagged = trimmed
			}
			etag := payloadETag(tagged)
			e.Response.Header().Set("ETag", etag)
			e.Response.Header().Set("Cache-Control", "no-cache")

			if e.Request.Header.Get("If-None-Match") == etag {
				e.Response.WriteHeader(http.StatusNotModified)
				return nil
			}

			e.Response.Header().Set("Content-Type", "application/json")
			e.Response.WriteHeader(http.StatusOK)
			_, err = e.Response.Write(body)
			return err
		})

		return se.Next()
	})
}

// DeviceAccountDomain marks an account created by the wizard rather than by a
// person. Nothing depends on the exact string except the claim endpoint, which
// uses it to tell "never had an email" from "has one already".
const DeviceAccountDomain = "@device.seedly.local"

const minPasswordLength = 8

func IsDeviceAccount(email string) bool {
	return strings.HasSuffix(strings.ToLower(email), DeviceAccountDomain)
}

// claimError turns PocketBase's validation into something an organiser can act
// on. The only failure that happens in practice is an address already in use,
// and "Failed to update record." does not say so.
func claimError(err error) string {
	if strings.Contains(strings.ToLower(err.Error()), "unique") ||
		strings.Contains(err.Error(), "email") {
		return "that email is already in use, or is not a valid address"
	}
	return "could not save the account"
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

// resolveSourceStages fills a freshly generated bracket from the tables of the
// stages it is seeded from, so a playoff generated after the groups have
// finished is populated immediately rather than on the next result.
func resolveSourceStages(app core.App, plan *StagePlan) error {
	seen := map[string]bool{}
	for _, slot := range plan.Slots {
		if slot.SourceType != "pool_rank" || slot.SourcePool == "" {
			continue
		}
		pool, err := app.FindRecordById("pools", slot.SourcePool)
		if err != nil {
			continue
		}
		sourceStage := pool.GetString("stage")
		if seen[sourceStage] {
			continue
		}
		seen[sourceStage] = true

		if _, err := ResolvePoolRanks(app, sourceStage); err != nil {
			return err
		}
	}
	return nil
}

// withoutTimestamp copies a payload with GeneratedAt cleared, so the ETag
// reflects the tournament's state rather than the clock.
func withoutTimestamp(payload *DisplayPayload) DisplayPayload {
	copied := *payload
	copied.GeneratedAt = ""
	return copied
}
