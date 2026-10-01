package mcp

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/pocketbase/pocketbase/core"

	"whistleday/backend/internal/oauth"
	"whistleday/backend/internal/tournament"
)

// realAccount is what a person who already has a Whistle.day account looks
// like, as opposed to newOrganiser()'s device account — a distinction that
// matters here because it is exactly what an OAuth-authenticated caller is.
func realAccount(t *testing.T, app core.App, email string) *core.Record {
	t.Helper()
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("users collection: %v", err)
	}
	u := core.NewRecord(users)
	u.Set("email", email)
	u.Set("password", "apassword123")
	u.Set("passwordConfirm", "apassword123")
	u.SetVerified(true)
	if err := app.Save(u); err != nil {
		t.Fatalf("save user: %v", err)
	}
	return u
}

func oauthClient(t *testing.T, app core.App) *core.Record {
	t.Helper()
	collection, err := app.FindCollectionByNameOrId("oauth_clients")
	if err != nil {
		t.Fatalf("oauth_clients collection: %v", err)
	}
	c := core.NewRecord(collection)
	c.Set("client_id", "wd_client_mcp_test")
	c.Set("client_name", "MCP Test Client")
	c.Set("redirect_uris", []string{"http://127.0.0.1:9999/callback"})
	c.Set("token_endpoint_auth_method", "none")
	if err := app.Save(c); err != nil {
		t.Fatalf("save client: %v", err)
	}
	return c
}

// bearerContext is what withCredentials would have produced from a real
// Authorization: Bearer header — building it directly here skips the HTTP
// layer, the same way toolArgs skips it for session_token.
func bearerContext(token string) context.Context {
	return context.WithValue(context.Background(), bearerCtxKey, token)
}

func TestCallerPrefersSessionArgOverBearer(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	_, sessionToken, err := s.newOrganiser()
	if err != nil {
		t.Fatalf("device session: %v", err)
	}

	person := realAccount(t, app, "person@example.test")
	client := oauthClient(t, app)
	access, _, err := oauth.MintTokenPair(app, person, client, "tournaments")
	if err != nil {
		t.Fatalf("mint access token: %v", err)
	}

	req := toolArgs("list_tournaments", map[string]any{"session_token": sessionToken})
	caller, err := s.caller(bearerContext(access), req)
	if err != nil {
		t.Fatalf("caller: %v", err)
	}

	// Not the OAuth-authenticated person — the explicit argument won, as
	// documented.
	deviceOwner, err := resolveSessionToken(app, sessionToken)
	if err != nil {
		t.Fatalf("resolve device session: %v", err)
	}
	if caller.Id != deviceOwner.Id {
		t.Fatalf("caller = %s, want the session_token's own account %s", caller.Id, deviceOwner.Id)
	}
}

func TestCallerAcceptsBearerWithNoSessionArg(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	person := realAccount(t, app, "person@example.test")
	client := oauthClient(t, app)
	access, _, err := oauth.MintTokenPair(app, person, client, "tournaments")
	if err != nil {
		t.Fatalf("mint access token: %v", err)
	}

	req := toolArgs("list_tournaments", map[string]any{})
	r, e := s.listTournaments(bearerContext(access), req)
	if e != nil {
		t.Fatalf("list_tournaments with only a Bearer header: %v", e)
	}
	var list []map[string]any
	if err := json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("expected no tournaments yet, got %d", len(list))
	}
}

// The payoff, in one test: an OAuth-authenticated agent's tournaments land
// on the real, signed-in account, so a second create_tournament call and a
// list_tournaments both see the same one account's growing list — not two
// fresh device accounts that can never see each other.
func TestCreateTournamentUsesRealOwnerWhenBearerPresent(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	person := realAccount(t, app, "person@example.test")
	client := oauthClient(t, app)
	access, _, err := oauth.MintTokenPair(app, person, client, "tournaments")
	if err != nil {
		t.Fatalf("mint access token: %v", err)
	}
	ctx := bearerContext(access)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "First Cup"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var first map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &first)

	if _, has := first["session_token"]; has {
		t.Fatal("an OAuth-authenticated create_tournament returned a session_token; it should have nothing new to hand back")
	}
	created, err := app.FindRecordById("tournaments", first["id"].(string))
	if err != nil {
		t.Fatalf("tournament: %v", err)
	}
	if owner := created.GetString("owner"); owner != person.Id {
		t.Fatalf("owner = %v, want the signed-in person %s", owner, person.Id)
	}

	r, e = s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Second Cup"}))
	if e != nil {
		t.Fatalf("second create: %v", e)
	}
	var second map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &second)

	r, e = s.listTournaments(ctx, toolArgs("list_tournaments", map[string]any{}))
	if e != nil {
		t.Fatalf("list: %v", e)
	}
	var list []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list)
	if len(list) != 2 {
		t.Fatalf("expected 2 tournaments under the one real account, got %d", len(list))
	}
}

// The anonymous path still works beside it: nothing presented mints a fresh
// device account, remembered by the connection rather than handed back.
func TestCreateTournamentAnonymousPathUnchanged(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Anon Cup"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var data map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)

	if _, has := data["session_token"]; has {
		t.Fatal("the anonymous path returned a credential through the tool result")
	}
	owner, err := s.caller(ctx, toolArgs("list_tournaments", map[string]any{}))
	if err != nil {
		t.Fatalf("the connection does not resolve to the account it made: %v", err)
	}
	if !tournament.IsDeviceAccount(owner.Email()) {
		t.Fatalf("expected a device account, got %s", owner.Email())
	}
}

// A credential that was presented and did not check out must error rather
// than silently falling back to a fresh anonymous account — a confusingly
// empty list_tournaments later is worse than an error now.
func TestCreateTournamentRejectsExpiredBearer(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	_, e := s.createTournament(bearerContext("not-a-real-access-token"),
		toolArgs("create_tournament", map[string]any{"name": "Should Not Exist"}))
	if e == nil {
		t.Fatal("a bad Bearer token was silently accepted")
	}
}
