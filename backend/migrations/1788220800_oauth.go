package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

/*
oauth_clients, oauth_requests, oauth_codes, oauth_tokens — Whistle.day as an
OAuth 2.1 authorization server, so a person who already has an account can
sign in once and let an agent act as them, instead of the agent always
starting a fresh anonymous one (see backend/internal/oauth).

Four collections because there are four different lifetimes and shapes in
play, and folding them together would mean every row carrying columns that
mean nothing for most of its life:

  - a *client* (oauth_clients) is registered once and lives indefinitely;
  - a *request* (oauth_requests) is a browser mid-flight, gone in minutes;
  - a *code* (oauth_codes) is a single-use handoff, gone in about two;
  - a *token* (oauth_tokens) is what an agent actually holds day to day.

Modelled on handoffs: no collection rules at all, which leaves every one of
these superuser-only. Every read and write goes through a route in
internal/oauth that does its own check — there is no reason for a client to
reach these rows directly, and a list rule that ever leaked one would hand
over an account.

oauth_tokens.parent closes on itself the same way fixtures/slots does
elsewhere in this schema: the collection is created and saved once, then
reloaded and given the field that points back into itself.
*/
func init() {
	m.Register(func(app core.App) error {
		b := &builder{app: app}

		// ---------------------------------------------------------------
		// oauth_clients — the result of dynamic client registration.
		// Plaintext client_id: a public client's id is not a secret, and
		// this deployment never issues a client_secret at all.
		// ---------------------------------------------------------------
		clients := core.NewBaseCollection("oauth_clients")
		clients.Fields.Add(
			txt("client_id", true, 64),
			txt("client_name", false, 200),
			jsn("redirect_uris"),
			txt("token_endpoint_auth_method", true, 20),
			jsn("grant_types"),
			jsn("response_types"),
			txt("scope", false, 200),
			txt("software_id", false, 200),
			txt("software_version", false, 50),
		)
		stamps(clients)
		clients.AddIndex("idx_oauth_clients_client_id", true, "client_id", "")
		b.save(clients)

		// ---------------------------------------------------------------
		// oauth_requests — a pending /oauth/authorize call, waiting on
		// login and consent in the browser.
		// ---------------------------------------------------------------
		requests := core.NewBaseCollection("oauth_requests")
		requests.Fields.Add(
			txt("request_id", true, 64),
			b.rel("client", "oauth_clients", true, true),
			txt("redirect_uri", true, 2000),
			txt("state", false, 500),
			txt("scope", false, 200),
			txt("resource", false, 500),
			txt("code_challenge", true, 128),
			txt("code_challenge_method", true, 10),
			dt("expires"),
			bln("used"),
		)
		stamps(requests)
		requests.AddIndex("idx_oauth_requests_request_id", true, "request_id", "")
		b.save(requests)

		// ---------------------------------------------------------------
		// oauth_codes — an issued authorization code, post-consent. `user`
		// is the real, signed-in account: this field is the whole feature.
		// ---------------------------------------------------------------
		codes := core.NewBaseCollection("oauth_codes")
		codes.Fields.Add(
			txt("code", true, 64),
			b.rel("client", "oauth_clients", true, true),
			b.rel("user", "users", true, true),
			txt("redirect_uri", true, 2000),
			txt("code_challenge", true, 128),
			txt("code_challenge_method", true, 10),
			txt("scope", false, 200),
			txt("resource", false, 500),
			dt("expires"),
			bln("used"),
		)
		stamps(codes)
		codes.AddIndex("idx_oauth_codes_code", true, "code", "")
		b.save(codes)

		// ---------------------------------------------------------------
		// oauth_tokens — access/refresh pairs. Hashed at rest: unlike a
		// client_id or a single-use code, these are long-lived bearer
		// credentials — functionally passwords — so a database dump
		// should not hand them out.
		// ---------------------------------------------------------------
		tokens := core.NewBaseCollection("oauth_tokens")
		tokens.Fields.Add(
			b.rel("user", "users", true, true),
			b.rel("client", "oauth_clients", true, true),
			txt("access_token_hash", true, 128),
			txt("refresh_token_hash", true, 128),
			txt("scope", false, 200),
			txt("resource", false, 500),
			dt("access_expires"),
			dt("refresh_expires"),
			bln("revoked"),
		)
		stamps(tokens)
		tokens.AddIndex("idx_oauth_tokens_access", true, "access_token_hash", "")
		tokens.AddIndex("idx_oauth_tokens_refresh", true, "refresh_token_hash", "")
		tokens.AddIndex("idx_oauth_tokens_user", false, "user", "")
		b.save(tokens)

		// Close the cycle: `parent` links a rotated token back to the one it
		// replaced, for reuse-detection — it cannot be part of the initial
		// definition above because "oauth_tokens" does not have an id until
		// it has been saved once.
		if b.err == nil {
			tokens, err := app.FindCollectionByNameOrId("oauth_tokens")
			if err != nil {
				return err
			}
			tokens.Fields.Add(b.rel("parent", "oauth_tokens", false, false))
			tokens.AddIndex("idx_oauth_tokens_parent", false, "parent", "")
			b.save(tokens)
		}

		return b.err
	}, func(app core.App) error {
		for _, name := range []string{"oauth_tokens", "oauth_codes", "oauth_requests", "oauth_clients"} {
			collection, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				continue // already gone
			}
			if err := app.Delete(collection); err != nil {
				return err
			}
		}
		return nil
	})
}
