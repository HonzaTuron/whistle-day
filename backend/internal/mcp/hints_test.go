package mcp

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

// Every tool states all three hints, and states them truthfully: this is the
// table a directory review checks the server against.
func TestToolHints(t *testing.T) {
	app := newTestApp(t)
	s := New(app)

	want := map[string]effect{
		"list_tournaments": reads, "get_tournament": reads, "list_stages": reads,
		"get_stage": reads, "list_pools": reads, "list_fixtures": reads,
		"get_fixture": reads, "list_entries": reads, "list_standings": reads,
		"get_stage_table": reads, "list_courts": reads,
		"create_tournament": adds, "add_entry": adds, "create_stage": adds, "add_court": adds,
		"publish_tournament": publishes, "create_display": publishes,
		"update_fixture": overwrites, "generate_stage": overwrites,
		"resolve_stage": overwrites, "create_handoff": overwrites,
	}

	tools := s.mcp.ListTools()
	if len(tools) != len(want) {
		t.Fatalf("got %d tools, the table covers %d", len(tools), len(want))
	}

	for name, registered := range tools {
		e, ok := want[name]
		if !ok {
			t.Errorf("%s: registered but not in the table", name)
			continue
		}
		a := registered.Tool.Annotations
		if a.ReadOnlyHint == nil || a.DestructiveHint == nil || a.OpenWorldHint == nil {
			t.Errorf("%s: a hint was left unset", name)
			continue
		}
		if *a.ReadOnlyHint != (e == reads) || *a.DestructiveHint != (e == overwrites) || *a.OpenWorldHint != (e == publishes) {
			t.Errorf("%s: hints do not match its effect", name)
		}

		raw, err := json.Marshal(registered.Tool)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if !strings.Contains(string(raw), `"securitySchemes":[{"type":"noauth"},{"scopes":["tournaments"],"type":"oauth2"}]`) {
			t.Errorf("%s: securitySchemes missing from _meta: %s", name, raw)
		}
		if _, asked := registered.Tool.InputSchema.Properties[sessionArg]; asked {
			t.Errorf("%s: asks the model for a credential", name)
		}
	}
}

// A call with no credential at all comes back as a challenge a client can
// act on, not as a bare error.
func TestNoCredentialIsASignInChallenge(t *testing.T) {
	app := newTestApp(t)
	s := New(app)

	tool := s.mcp.GetTool("list_tournaments")
	if tool == nil {
		t.Fatal("list_tournaments is not registered")
	}

	result, err := tool.Handler(context.Background(), toolArgs("list_tournaments", map[string]any{}))
	if err != nil {
		t.Fatalf("expected a result, got error: %v", err)
	}
	if !result.IsError {
		t.Fatal("expected an error result")
	}
	challenges, _ := result.Meta.AdditionalFields["mcp/www_authenticate"].([]string)
	if len(challenges) != 1 ||
		!strings.Contains(challenges[0], "/.well-known/oauth-protected-resource") ||
		!strings.Contains(challenges[0], `error="invalid_token"`) ||
		!strings.Contains(challenges[0], "error_description=") {
		t.Fatalf("unexpected challenge: %v", challenges)
	}

	// A credential that was presented and is wrong stays an ordinary error.
	_, err = tool.Handler(ctx, toolArgs("list_tournaments", map[string]any{"session_token": "nope"}))
	if err == nil {
		t.Fatal("a bad session_token should still be an error")
	}

	// And with nothing to remember an account against, create_tournament
	// asks for a sign-in rather than making a tournament nobody can reach.
	create := s.mcp.GetTool("create_tournament").Handler
	result, err = create(context.Background(), toolArgs("create_tournament", map[string]any{"name": "Lost"}))
	if err != nil || !result.IsError {
		t.Fatalf("expected a challenge, got %v, %v", result, err)
	}
}

func callOn(t *testing.T, c context.Context, fn func(context.Context, mcp.CallToolRequest) (*mcp.CallToolResult, error),
	name string, args map[string]any, out any) {
	t.Helper()
	r, err := fn(c, toolArgs(name, args))
	if err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	if out == nil {
		return
	}
	if err := json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), out); err != nil {
		t.Fatalf("%s: unmarshal: %v", name, err)
	}
}

// The account create_tournament makes is remembered by the connection: no
// credential comes back, none is needed on the next call, another connection
// is a stranger, and a claimed account is no longer the agent's.
func TestConnectionRemembersTheAccount(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	one := context.WithValue(context.Background(), connectionCtxKey, "mcp-session-11111111-1111-4111-8111-111111111111")
	two := context.WithValue(context.Background(), connectionCtxKey, "mcp-session-22222222-2222-4222-8222-222222222222")

	var cup map[string]any
	callOn(t, one, s.createTournament, "create_tournament", map[string]any{"name": "Cup"}, &cup)
	for _, leaked := range []string{"session_token", "owner", "created"} {
		if _, there := cup[leaked]; there {
			t.Errorf("create_tournament returned %q", leaked)
		}
	}
	id := cup["id"].(string)

	if _, err := s.addEntry(one, toolArgs("add_entry", map[string]any{
		"tournament_id": id, "name": "Aces", "seed": float64(1),
	})); err != nil {
		t.Fatalf("the connection that made it could not use it: %v", err)
	}

	// A second tournament on the same connection joins the first.
	callOn(t, one, s.createTournament, "create_tournament", map[string]any{"name": "Plate"}, nil)
	var mine []map[string]any
	callOn(t, one, s.listTournaments, "list_tournaments", map[string]any{}, &mine)
	if len(mine) != 2 {
		t.Fatalf("expected both tournaments on one account, got %d", len(mine))
	}

	if _, err := s.getTournament(two, toolArgs("get_tournament", map[string]any{"id": id})); err == nil {
		t.Fatal("another connection reached the tournament")
	}

	// Claimed: the address is a person's now, and the connection is done.
	r, _ := app.FindRecordById("tournaments", id)
	owner, _ := app.FindRecordById("users", r.GetString("owner"))
	owner.SetEmail("organiser@example.com")
	if err := app.Save(owner); err != nil {
		t.Fatalf("claim: %v", err)
	}
	if _, err := s.getTournament(one, toolArgs("get_tournament", map[string]any{"id": id})); err != errNoSession {
		t.Fatalf("a claimed account still answered its old connection: %v", err)
	}
}
