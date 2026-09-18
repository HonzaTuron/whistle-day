package tournament

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/tools/types"
)

/*
Giving a tournament to a person.

An account made by the wizard or by an agent is the same thing — unclaimed,
holding a tournament, and reachable only by whoever holds its credentials.
`/api/organiser/claim` turns one into a person's account, but only for a
caller already authenticated as it. That is exactly right in the browser that
made it and no use at all when the thing holding the account is an agent: it
cannot hand over its session, and it should not want to, because the session
would still work afterwards.

This is the same claim reached from a link. Mint one while you are the owner,
send it to whoever is actually running the day, and they finish it on their
own phone.

## What the link is worth

More than any other token in this system. A display token shows a wall, an
invite token makes somebody a referee; this one hands over an account and
everything it owns. That is why it expires, why it is single-use, and why the
claim is refused the moment the account stops being unclaimed.

The last of those is the subtle one. Without it, a second handoff minted
before the first was used would still be redeemable afterwards — a link that
quietly resets the password of an account that now belongs to a person.
*/

// HandoffLifetime is how long a link is good for.
//
// Long enough to be sent in a message and opened after lunch; short enough
// that it is not still live in a chat log a month later. Anything sitting
// unclaimed for a day is a handoff that did not happen, and minting another
// costs one call.
const HandoffLifetime = 24 * time.Hour

// The token is the entire credential and is never typed by a person, so it is
// long. The display token's alphabet exists for reading off a wall; this is
// only ever clicked.
const handoffTokenLength = 40

// RegisterHandoffRoutes adds minting, reading and claiming.
func RegisterHandoffRoutes(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Mint one. Owner only — not `requireStaff`, for the same reason
		// minting an invite is owner-only: this is the tournament itself
		// changing hands, and a scorer who could do it could take it.
		se.Router.POST("/api/organiser/handoff", func(e *core.RequestEvent) error {
			data := struct {
				Tournament string `json:"tournament"`
			}{}
			if err := e.BindBody(&data); err != nil {
				return e.BadRequestError("could not read the request", err)
			}

			tournament, err := e.App.FindRecordById("tournaments", data.Tournament)
			if err != nil {
				return e.NotFoundError("tournament not found", err)
			}
			if e.Auth == nil || tournament.GetString("owner") != e.Auth.Id {
				return e.ForbiddenError("only the owner can hand a tournament over", nil)
			}
			// Nothing to hand over: this account is already somebody's.
			if !IsDeviceAccount(e.Auth.Email()) {
				return e.BadRequestError(
					"this account already belongs to somebody, so there is nothing to claim", nil)
			}

			handoff, err := MintHandoff(e.App, e.Auth, tournament)
			if err != nil {
				return e.InternalServerError("could not make a handoff link", err)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"token":   handoff.GetString("token"),
				"url":     HandoffURL(e.App, handoff.GetString("token")),
				"expires": handoff.GetString("expires"),
			})
		}).Bind(apis.RequireAuth())

		// What the link is for, before anyone commits to it.
		//
		// Public, like the invite preview and for the same reason: the
		// unguessable token is the credential, and a screen that could not name
		// the tournament would be asking somebody to accept a blank cheque. It
		// answers with a name and never the row.
		se.Router.GET("/api/organiser/handoff/{token}", func(e *core.RequestEvent) error {
			handoff, err := findHandoff(e.App, e.Request.PathValue("token"))
			if err != nil {
				return e.NotFoundError("this link is not valid any more", err)
			}

			tournament, err := e.App.FindRecordById("tournaments", handoff.GetString("tournament"))
			if err != nil {
				return e.NotFoundError("this link is not valid any more", err)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"tournament": tournament.GetString("name"),
			})
		})

		// Take it.
		//
		// Public, because the point is that the person arriving has no account
		// here yet — the token is what authorises this, exactly as it is for
		// the display and the invite.
		se.Router.POST("/api/organiser/handoff/{token}/claim", func(e *core.RequestEvent) error {
			data := struct {
				Email    string `json:"email"`
				Password string `json:"password"`
			}{}
			if err := e.BindBody(&data); err != nil {
				return e.BadRequestError("could not read the request", err)
			}
			if len(data.Password) < minPasswordLength {
				return e.BadRequestError(
					fmt.Sprintf("the password needs at least %d characters", minPasswordLength), nil)
			}

			handoff, err := findHandoff(e.App, e.Request.PathValue("token"))
			if err != nil {
				return e.NotFoundError("this link is not valid any more", err)
			}

			user, err := e.App.FindRecordById("users", handoff.GetString("user"))
			if err != nil {
				return e.NotFoundError("this link is not valid any more", err)
			}
			// Somebody got here first, or the owner claimed it another way.
			if !IsDeviceAccount(user.Email()) {
				return e.BadRequestError(
					"this tournament already belongs to somebody", nil)
			}

			// One transaction: the account write and the burn cannot come
			// apart, or a link that arrived twice at once would claim twice.
			err = e.App.RunInTransaction(func(tx core.App) error {
				user.SetEmail(data.Email)
				user.SetPassword(data.Password)
				user.SetVerified(true)
				// Everything the agent or the old device held stops working,
				// which is the point: what was handed over is now theirs alone.
				user.RefreshTokenKey()
				if err := tx.Save(user); err != nil {
					return err
				}

				handoff.Set("used", true)
				return tx.Save(handoff)
			})
			if err != nil {
				// Same sentence whichever way it failed: the only failure that
				// happens in practice is an address already in use, and saying
				// so turns this into a way to ask whether an address has an
				// account here.
				e.App.Logger().Error("could not complete a handoff",
					"handoff", handoff.Id, "error", err)
				return e.BadRequestError(claimError(err), nil)
			}

			// The caller signs in with what it just set; there is no token to
			// hand back that would still be valid after RefreshTokenKey.
			return e.JSON(http.StatusOK, map[string]any{
				"email":      data.Email,
				"tournament": handoff.GetString("tournament"),
			})
		})

		// Claiming by Google or Facebook instead of a password is two
		// requests either side of the provider's own redirect, not one — see
		// the comment on /finish for why.
		//
		// This half hands the browser a session for the handoff's target
		// account before it ever leaves for the provider, so that coming back
		// and calling PocketBase's own OAuth2 endpoint claims that account
		// rather than creating an unrelated one — the same "already
		// authenticated as it" resolution api/oauth.ts leans on for a device
		// account already sitting in this browser, except here the browser
		// never had a session for it at all.
		//
		// Nothing about the account changes here. A token that never gets
		// used past this point is exactly as harmless as the link itself
		// sitting unopened in a chat log — the handoff is spent by /finish,
		// not by this.
		se.Router.POST("/api/organiser/handoff/{token}/oauth-session", func(e *core.RequestEvent) error {
			handoff, err := findHandoff(e.App, e.Request.PathValue("token"))
			if err != nil {
				return e.NotFoundError("this link is not valid any more", err)
			}

			user, err := e.App.FindRecordById("users", handoff.GetString("user"))
			if err != nil {
				return e.NotFoundError("this link is not valid any more", err)
			}
			if !IsDeviceAccount(user.Email()) {
				return e.BadRequestError("this tournament already belongs to somebody", nil)
			}

			token, err := user.NewAuthToken()
			if err != nil {
				return e.InternalServerError("could not start signing in", err)
			}

			return e.JSON(http.StatusOK, map[string]any{"token": token})
		})

		// The other half: the browser linked a provider to the session
		// /oauth-session gave it, through PocketBase's own OAuth2 endpoint,
		// and this is where that becomes the same commitment the password
		// path makes in a single request — the handoff is spent and whatever
		// the agent or the old device held stops working.
		//
		// `email` is optional and, when sent, is whatever the provider handed
		// back — PocketBase's OAuth2 endpoint does not overwrite a device
		// account's non-empty address on its own (see oauth2Submit's
		// "existing record" branch), so this is the one place that can put
		// the real one on the account.
		//
		// Authenticated rather than token-in-body: the caller has to be
		// signed in as the exact account the link names, which the OAuth2
		// exchange it just completed is what put it there. Anyone else's
		// session is refused rather than allowed to spend somebody else's
		// handoff.
		se.Router.POST("/api/organiser/handoff/{token}/finish", func(e *core.RequestEvent) error {
			data := struct {
				Email string `json:"email"`
			}{}
			if err := e.BindBody(&data); err != nil {
				return e.BadRequestError("could not read the request", err)
			}

			handoff, err := findHandoff(e.App, e.Request.PathValue("token"))
			if err != nil {
				return e.NotFoundError("this link is not valid any more", err)
			}
			if e.Auth == nil || e.Auth.Id != handoff.GetString("user") {
				return e.ForbiddenError("this session did not come from that link", nil)
			}

			user := e.Auth
			var newToken string

			// One transaction, the same reason the password path uses one:
			// the account write and the burn cannot come apart, or a request
			// retried after a dropped response would finish twice.
			err = e.App.RunInTransaction(func(tx core.App) error {
				if data.Email != "" {
					user.SetEmail(data.Email)
				}
				user.SetVerified(true)
				// There was never a password to change, so the device's
				// random one is rotated to another nobody knows rather than
				// left live and simply unmentioned.
				user.SetRandomPassword()
				user.RefreshTokenKey()
				if err := tx.Save(user); err != nil {
					return err
				}

				handoff.Set("used", true)
				if err := tx.Save(handoff); err != nil {
					return err
				}

				// Minted after the rotation above, so it is the one token
				// this exchange leaves valid — the request's own bearer
				// token, minted before RefreshTokenKey, stops working the
				// moment this transaction commits.
				minted, err := user.NewAuthToken()
				if err != nil {
					return err
				}
				newToken = minted
				return nil
			})
			if err != nil {
				e.App.Logger().Error("could not complete an oauth handoff",
					"handoff", handoff.Id, "error", err)
				return e.BadRequestError(claimError(err), nil)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"token": newToken,
				"email": user.Email(),
			})
		}).Bind(apis.RequireAuth())

		return se.Next()
	})
}

// MintHandoff writes a link for one unclaimed account.
//
// Any link already outstanding for the tournament is burned first. Two live
// links would mean the one somebody was sent quietly stops being the only way
// in, and the owner has no way to tell which is which.
func MintHandoff(app core.App, owner *core.Record, tournament *core.Record) (*core.Record, error) {
	if err := burnHandoffs(app, tournament.Id); err != nil {
		return nil, err
	}

	collection, err := app.FindCollectionByNameOrId("handoffs")
	if err != nil {
		return nil, err
	}

	handoff := core.NewRecord(collection)
	handoff.Set("user", owner.Id)
	handoff.Set("tournament", tournament.Id)
	handoff.Set("token", security.RandomString(handoffTokenLength))
	handoff.Set("expires", types.NowDateTime().Add(HandoffLifetime))
	handoff.Set("used", false)

	if err := app.Save(handoff); err != nil {
		return nil, err
	}
	return handoff, nil
}

// HandoffURL is the address to send somebody.
func HandoffURL(app core.App, token string) string {
	base := strings.TrimSuffix(app.Settings().Meta.AppURL, "/")
	return base + "/claim/" + token
}

// findHandoff resolves a token to a live link.
//
// Expired, used and never-existed are one answer. The difference is only ever
// useful to somebody guessing, and "this link is not valid any more" is the
// true sentence for all three.
func findHandoff(app core.App, token string) (*core.Record, error) {
	if token == "" {
		return nil, fmt.Errorf("no token")
	}

	handoff, err := app.FindFirstRecordByFilter(
		"handoffs",
		"token = {:token} && used = false",
		map[string]any{"token": token},
	)
	if err != nil || handoff == nil {
		return nil, fmt.Errorf("no such handoff")
	}

	expires := handoff.GetDateTime("expires")
	if !expires.IsZero() && expires.Time().Before(time.Now()) {
		return nil, fmt.Errorf("expired")
	}
	return handoff, nil
}

func burnHandoffs(app core.App, tournamentID string) error {
	existing, err := app.FindRecordsByFilter(
		"handoffs", "tournament = {:t} && used = false", "", 0, 0,
		map[string]any{"t": tournamentID},
	)
	if err != nil {
		return err
	}
	for _, handoff := range existing {
		handoff.Set("used", true)
		if err := app.Save(handoff); err != nil {
			return err
		}
	}
	return nil
}
