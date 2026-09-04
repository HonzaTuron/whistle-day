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
				// The error goes to the log and not into the response. Handing
				// back the validation detail — `email: validation_not_unique`
				// — turns this route into a way to ask whether an address has
				// an account here, one guess at a time, from a form that needs
				// no account of its own to reach. The caller is told the same
				// sentence whichever way it failed.
				e.App.Logger().Error("could not claim an account", "user", user.Id, "error", err)
				return e.BadRequestError(claimError(err), nil)
			}

			// The caller signs in again with what it just set; there is no
			// token to hand back that would still be valid.
			return e.JSON(http.StatusOK, map[string]any{"email": data.Email})
		}).Bind(apis.RequireAuth())

		// Take a team out of a tournament that is already running, and put
		// one back.
		//
		// A route rather than a status field somebody PATCHes, because the
		// write is the small half of it: everything they had left has to be
		// closed, and every stage retallied, in one transaction. Half-applied
		// is the one state worse than not having the feature — a team gone
		// from the draw but still in the table is a tournament nobody can
		// explain.
		se.Router.POST("/api/entries/{entry}/withdraw", func(e *core.RequestEvent) error {
			entry, err := e.App.FindRecordById("entries", e.Request.PathValue("entry"))
			if err != nil {
				return e.NotFoundError("team not found", err)
			}
			if err := requireStaff(e, entry.GetString("tournament")); err != nil {
				return err
			}

			data := struct {
				Policy string `json:"policy"`
				Status string `json:"status"`
			}{}
			if err := e.BindBody(&data); err != nil {
				return e.BadRequestError("could not read the request", err)
			}
			if data.Status == "" {
				data.Status = "withdrawn"
			}

			// No default policy. The two answers rank everybody else
			// differently, and picking one on the organiser's behalf would be
			// deciding a competition from inside a web framework.
			policy := WithdrawalPolicy(data.Policy)
			if policy != PolicyForfeit && policy != PolicyVoid {
				return e.BadRequestError(
					"say whether they forfeit the rest or their results are struck", nil)
			}

			if err := WithdrawEntry(e.App, entry, data.Status, policy); err != nil {
				return e.BadRequestError("could not take that team out", err)
			}

			// No explicit nudge: RegisterRealtime fires on every record
			// write, and this made a great many of them.
			return e.JSON(http.StatusOK, map[string]any{
				"entry":  entry.Id,
				"status": entry.GetString("status"),
				"policy": entry.GetString("withdrawal"),
			})
		}).Bind(apis.RequireAuth())

		// Put a team in that was not there when the draw was made.
		//
		// The other half of the withdrawal above, and the same shape for the
		// same reason: the record is the small part of it, and what has to
		// happen around it — the matches they now owe a group, a seat in a
		// Swiss table, a bracket drawn again — is a transaction rather than a
		// patch. The entry itself is created through the ordinary collection
		// API first, exactly as the wizard creates one; this is what fits it
		// into a tournament that is already under way.
		//
		// Idempotent: a team already in a stage is left in it rather than
		// given a second seat.
		se.Router.POST("/api/entries/{entry}/admit", func(e *core.RequestEvent) error {
			entry, err := e.App.FindRecordById("entries", e.Request.PathValue("entry"))
			if err != nil {
				return e.NotFoundError("team not found", err)
			}
			if err := requireStaff(e, entry.GetString("tournament")); err != nil {
				return err
			}

			admitted, err := AdmitEntry(e.App, entry)
			if err != nil {
				// The refusal an organiser actually meets is "the playoff has
				// started", which is a sentence about their tournament rather
				// than about this server, so it goes back as it is written.
				return e.BadRequestError(err.Error(), err)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"entry":  entry.Id,
				"stages": admitted,
			})
		}).Bind(apis.RequireAuth())

		se.Router.POST("/api/entries/{entry}/reinstate", func(e *core.RequestEvent) error {
			entry, err := e.App.FindRecordById("entries", e.Request.PathValue("entry"))
			if err != nil {
				return e.NotFoundError("team not found", err)
			}
			if err := requireStaff(e, entry.GetString("tournament")); err != nil {
				return err
			}

			if err := ReinstateEntry(e.App, entry); err != nil {
				return e.BadRequestError("could not put that team back", err)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"entry":  entry.Id,
				"status": entry.GetString("status"),
			})
		}).Bind(apis.RequireAuth())

		// What a join link is for, before anyone commits to using it.
		//
		// Public, like the display payload and for the same reason: the
		// unguessable token is the credential, and a join screen that could
		// not name the tournament would be asking someone to accept a blank
		// invitation. It answers with a name and a role and never the row —
		// holding the token reveals what you are being invited to, nothing
		// else about the event.
		//
		// A draft tournament is visible here, unlike on the display endpoint.
		// Screens are found by a token printed on a wall, so drafts are hidden
		// there to stop the endpoint being used to probe for unpublished
		// events; an invite token is handed to one person on purpose, and
		// setting the crew up before publishing is an ordinary thing to do.
		se.Router.GET("/api/staff/invite/{token}", func(e *core.RequestEvent) error {
			invite, err := findInvite(e.App, e.Request.PathValue("token"))
			if err != nil {
				return e.NotFoundError("this invitation is not valid", err)
			}

			tournament, err := e.App.FindRecordById("tournaments", invite.GetString("tournament"))
			if err != nil {
				return e.NotFoundError("this invitation is not valid", err)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"name": tournament.GetString("name"),
				"role": invite.GetString("role"),
			})
		})

		// Accept one, as whoever is signed in on this device.
		//
		// The account is not created here. The caller arrives already
		// authenticated — usually as a device account the join screen made the
		// same way the wizard makes the organiser's, occasionally as a real
		// one belonging to a referee who has claimed theirs and works every
		// weekend. Both are the same request, which is the whole reason this
		// takes a session rather than a name: joining twice from two devices
		// is two device accounts, and joining twice as a claimed account is
		// the same person twice.
		//
		// The staff row is written with e.App.Save, which does not go through
		// collection rules — `staff.createRule` is owner-only and the person
		// joining is by definition not the owner. The invite is the authority
		// instead, and it could only have been minted by the owner.
		se.Router.POST("/api/staff/join", func(e *core.RequestEvent) error {
			auth := e.Auth
			if auth == nil || auth.Collection().Name != "users" {
				return e.UnauthorizedError("sign in first", nil)
			}

			data := struct {
				Token string `json:"token"`
				Name  string `json:"name"`
			}{}
			if err := e.BindBody(&data); err != nil {
				return e.BadRequestError("could not read the request", err)
			}

			invite, err := findInvite(e.App, data.Token)
			if err != nil {
				return e.NotFoundError("this invitation is not valid", err)
			}

			tournamentID := invite.GetString("tournament")
			tournament, err := e.App.FindRecordById("tournaments", tournamentID)
			if err != nil {
				return e.NotFoundError("this invitation is not valid", err)
			}

			joined := func(role string) error {
				return e.JSON(http.StatusOK, map[string]any{
					"tournament": tournamentID,
					"name":       tournament.GetString("name"),
					"role":       role,
				})
			}

			// The owner scanning their own code is a no-op rather than an
			// error: they already have everything the invite grants, and a
			// staff row would be a second, weaker claim on the same access.
			if tournament.GetString("owner") == auth.Id {
				return joined("owner")
			}

			role := invite.GetString("role")
			existing, _ := e.App.FindFirstRecordByFilter(
				"staff",
				"tournament = {:tournament} && user = {:user}",
				map[string]any{"tournament": tournamentID, "user": auth.Id},
			)

			// Scanning a link does what the link says, including when that is
			// a change: the referee code makes a referee of someone who was an
			// organiser. The alternative — first scan wins, silently — makes
			// promoting somebody impossible without deleting them first, and
			// which code was shown is the owner's decision either way.
			name := staffName(data.Name, role)

			if existing != nil {
				if existing.GetString("role") == role && existing.GetString("name") == name {
					return joined(role)
				}
				existing.Set("role", role)
				existing.Set("name", name)
				if err := e.App.Save(existing); err != nil {
					return e.BadRequestError("could not join this tournament", err)
				}
				return joined(role)
			}

			collection, err := e.App.FindCollectionByNameOrId("staff")
			if err != nil {
				return e.InternalServerError("could not join this tournament", err)
			}

			member := core.NewRecord(collection)
			member.Set("tournament", tournamentID)
			member.Set("user", auth.Id)
			member.Set("role", role)
			member.Set("name", name)
			if err := e.App.Save(member); err != nil {
				return e.BadRequestError("could not join this tournament", err)
			}

			return joined(role)
		}).Bind(apis.RequireAuth())

		// Draw a stage that does not exist.
		//
		// Public and unauthenticated, because it reads nothing and writes
		// nothing: a format, a field size and a config in, a plan out. It is
		// what lets a page about an eight-team knockout show an eight-team
		// knockout to somebody who has never been here before, and what the
		// printable bracket sheets are rendered from.
		//
		// It runs the same four generators as a real stage. That is the whole
		// reason it exists rather than a bracket drawn in TypeScript on the
		// client: two implementations of bracket seeding is how brackets
		// drift, and this way a marketing page cannot promise a draw the hall
		// would not get.
		se.Router.POST("/api/preview", func(e *core.RequestEvent) error {
			req := PreviewRequest{}
			if err := e.BindBody(&req); err != nil {
				return e.BadRequestError("could not read the request", err)
			}

			plan, err := PreviewPlan(req)
			if err != nil {
				return e.BadRequestError(err.Error(), err)
			}

			// Deterministic for a given body and derived from no stored data,
			// so it is worth letting a CDN keep it. The prerendered pages are
			// built against it and would otherwise ask on every build.
			e.Response.Header().Set("Cache-Control", "public, max-age=3600")

			return e.JSON(http.StatusOK, map[string]any{
				"format": req.Format,
				"plan":   plan,
			})
		})

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
const DeviceAccountDomain = "@device.whistleday.local"

const minPasswordLength = 8

func IsDeviceAccount(email string) bool {
	return strings.HasSuffix(strings.ToLower(email), DeviceAccountDomain)
}

// claimError turns PocketBase's validation into something an organiser can act
// on. The only failure that happens in practice is an address already in use,
// and "Failed to update record." does not say so.
// What a refused claim is allowed to say.
//
// Deliberately unable to tell "already taken" from "not a valid address": one
// of those answers a question nobody asked, and answering it repeatedly is
// account enumeration. The detail is in the log, where it is worth having and
// costs nothing.
func claimError(err error) string {
	if strings.Contains(strings.ToLower(err.Error()), "unique") ||
		strings.Contains(err.Error(), "email") {
		return "that address cannot be used here"
	}
	return "could not save the account"
}

// staffName cleans up what somebody typed into the join screen.
//
// The box is optional and skipping it is a reasonable thing to do when a
// referee is being handed a phone mid-match, so an empty one falls back to the
// role. "Referee" in a crew list is worth more than a blank line, and it still
// tells two rows apart from the third that says "Jana".
func staffName(typed, role string) string {
	name := strings.TrimSpace(typed)
	if name == "" {
		switch role {
		case "organizer":
			return "Organiser"
		case "scorer":
			return "Scorer"
		default:
			return "Referee"
		}
	}
	if len([]rune(name)) > 60 {
		name = string([]rune(name)[:60])
	}
	return name
}

// findInvite resolves a join token to a live invitation. Deactivating a row is
// how a link that got out is withdrawn, so an inactive one is not merely
// ignored here — it is indistinguishable from a token that never existed.
func findInvite(app core.App, token string) (*core.Record, error) {
	if token == "" {
		return nil, fmt.Errorf("no token")
	}
	invite, err := app.FindFirstRecordByFilter(
		"invites",
		"token = {:token} && active = true",
		map[string]any{"token": token},
	)
	if err != nil {
		return nil, err
	}
	if invite == nil {
		return nil, fmt.Errorf("no such invitation")
	}
	return invite, nil
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
		sourceStage := ""
		switch slot.SourceType {
		case "pool_rank":
			if slot.SourcePool == "" {
				continue
			}
			pool, err := app.FindRecordById("pools", slot.SourcePool)
			if err != nil {
				continue
			}
			sourceStage = pool.GetString("stage")
		case "stage_rank":
			sourceStage = slot.SourceStage
		default:
			continue
		}
		if sourceStage == "" || seen[sourceStage] {
			continue
		}
		seen[sourceStage] = true

		if _, err := ResolvePoolRanks(app, sourceStage); err != nil {
			return err
		}
		if _, err := ResolveStageRanks(app, sourceStage); err != nil {
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
