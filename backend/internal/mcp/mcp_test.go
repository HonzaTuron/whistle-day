package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"whistleday/backend/internal/tournament"
	_ "whistleday/backend/migrations"
)

func newTestApp(t *testing.T) *tests.TestApp {
	t.Helper()
	dir, err := os.MkdirTemp("", "whistleday-mcp-test-*")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	app, err := tests.NewTestApp(dir)
	if err != nil {
		os.RemoveAll(dir)
		t.Fatalf("NewTestApp: %v", err)
	}
	tournament.RegisterHooks(app)
	tournament.RegisterHistory(app)
	return app
}

func toolArgs(method string, args map[string]any) mcp.CallToolRequest {
	return mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name:      method,
			Arguments: args,
		},
	}
}

var ctx = context.Background()

func TestListTournaments(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	// A session that has never made anything sees nothing — which is now a
	// statement about this account rather than about the server being empty.
	t.Run("a session with nothing", func(t *testing.T) {
		_, fresh, err := s.newOrganiser()
		if err != nil {
			t.Fatalf("session: %v", err)
		}
		r, e := s.listTournaments(ctx, toolArgs("list_tournaments", map[string]any{"session_token": fresh}))
		if e != nil {
			t.Fatalf("list: %v", e)
		}
		var list []map[string]any
		text := r.Content[0].(mcp.TextContent).Text
		if err := json.Unmarshal([]byte(text), &list); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if len(list) != 0 {
			t.Fatalf("expected empty list, got %d items", len(list))
		}
	})

	t.Run("with one tournament", func(t *testing.T) {
		r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Test Cup"}))
		if e != nil {
			t.Fatalf("create: %v", e)
		}
		var created map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &created)
		tok := created["session_token"].(string)
		if created["name"] != "Test Cup" {
			t.Fatalf("name = %v", created["name"])
		}

		r, e = s.listTournaments(ctx, toolArgs("list_tournaments", map[string]any{"session_token": tok}))
		if e != nil {
			t.Fatalf("list: %v", e)
		}
		var list []map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list)
		if len(list) != 1 {
			t.Fatalf("expected 1, got %d", len(list))
		}
	})

	// And it is only its own. Two sessions on one server do not see each
	// other's tournaments, which is the whole point of an account per
	// tournament and was not true before there were any.
	t.Run("and only its own", func(t *testing.T) {
		_, other, err := s.newOrganiser()
		if err != nil {
			t.Fatalf("session: %v", err)
		}
		r, e := s.listTournaments(ctx, toolArgs("list_tournaments", map[string]any{"session_token": other}))
		if e != nil {
			t.Fatalf("list: %v", e)
		}
		var list []map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list)
		if len(list) != 0 {
			t.Fatalf("a fresh session saw %d tournaments belonging to somebody else", len(list))
		}
	})
}

func TestCreateTournament(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "My Tournament"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var data map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)

	if data["name"] != "My Tournament" {
		t.Fatalf("name = %v", data["name"])
	}
	if data["status"] != "draft" {
		t.Fatalf("status = %v", data["status"])
	}
	if id, ok := data["id"].(string); !ok || id == "" {
		t.Fatal("expected non-empty id")
	}
}

func TestGetTournament(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Get Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var created map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &created)
	tok := created["session_token"].(string)

	t.Run("found", func(t *testing.T) {
		r, e := s.getTournament(ctx, toolArgs("get_tournament", map[string]any{"session_token": tok, "id": created["id"]}))
		if e != nil {
			t.Fatalf("get: %v", e)
		}
		var data map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
		if data["name"] != "Get Test" {
			t.Fatalf("name = %v", data["name"])
		}
	})

	t.Run("not found", func(t *testing.T) {
		_, e := s.getTournament(ctx, toolArgs("get_tournament", map[string]any{"session_token": tok, "id": "000000000000000"}))
		if e == nil {
			t.Fatal("expected error")
		}
	})
}

func TestAddEntry(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Entry Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	t.Run("add entry", func(t *testing.T) {
		r, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"],
			"name":          "Team Alpha",
			"seed":          float64(1),
		}))
		if e != nil {
			t.Fatalf("add: %v", e)
		}
		var data map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
		if data["name"] != "Team Alpha" {
			t.Fatalf("name = %v", data["name"])
		}
		if data["seed"] != float64(1) {
			t.Fatalf("seed = %v", data["seed"])
		}
	})

	t.Run("list entries", func(t *testing.T) {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"], "name": "Team Beta", "seed": float64(2),
		}))
		if e != nil {
			t.Fatalf("add: %v", e)
		}
		_, e = s.addEntry(ctx, toolArgs("add_entry", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"], "name": "Team Gamma", "seed": float64(3),
		}))
		if e != nil {
			t.Fatalf("add: %v", e)
		}

		r, e := s.listEntries(ctx, toolArgs("list_entries", map[string]any{"session_token": tok, "tournament_id": tournament["id"]}))
		if e != nil {
			t.Fatalf("list: %v", e)
		}
		var list []map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list)
		if len(list) != 3 {
			t.Fatalf("expected 3, got %d", len(list))
		}
	})
}

func TestCreateStage(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Stage Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	t.Run("round robin", func(t *testing.T) {
		r, e := s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"],
			"name":          "Groups",
			"format":        "round_robin",
			"position":      float64(0),
		}))
		if e != nil {
			t.Fatalf("create stage: %v", e)
		}
		var data map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
		if data["name"] != "Groups" {
			t.Fatalf("name = %v", data["name"])
		}
		if data["format"] != "round_robin" {
			t.Fatalf("format = %v", data["format"])
		}
		if data["status"] != "draft" {
			t.Fatalf("status = %v", data["status"])
		}
	})

	t.Run("with config", func(t *testing.T) {
		r, e := s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"],
			"name":          "Playoff",
			"format":        "single_elim",
			"position":      float64(1),
			"config":        `{"thirdPlace":true}`,
		}))
		if e != nil {
			t.Fatalf("create stage: %v", e)
		}
		var data map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
		cfg, ok := data["config"].(map[string]any)
		if !ok {
			t.Fatal("expected config")
		}
		if cfg["thirdPlace"] != true {
			t.Fatal("expected thirdPlace: true")
		}
	})
}

func TestListStages(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Multi Stage"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	_, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"], "name": "Groups", "format": "round_robin", "position": float64(0),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	_, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"], "name": "Playoff", "format": "single_elim", "position": float64(1),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}

	r, e = s.listStages(ctx, toolArgs("list_stages", map[string]any{"session_token": tok, "tournament_id": tournament["id"]}))
	if e != nil {
		t.Fatalf("list: %v", e)
	}
	var list []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list)
	if len(list) != 2 {
		t.Fatalf("expected 2, got %d", len(list))
	}
}

func TestGetStage(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Get Stage"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"], "name": "My Stage", "format": "swiss", "position": float64(0),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	t.Run("found", func(t *testing.T) {
		r, e := s.getStage(ctx, toolArgs("get_stage", map[string]any{"session_token": tok, "id": stage["id"]}))
		if e != nil {
			t.Fatalf("get: %v", e)
		}
		var data map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
		if data["name"] != "My Stage" {
			t.Fatalf("name = %v", data["name"])
		}
	})

	t.Run("not found", func(t *testing.T) {
		_, e := s.getStage(ctx, toolArgs("get_stage", map[string]any{"session_token": tok, "id": "000000000000000"}))
		if e == nil {
			t.Fatal("expected error")
		}
	})
}

func TestGenerateStage(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Gen Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	for i := 1; i <= 8; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"],
			"name":          fmt.Sprintf("T%d", i),
			"seed":          float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"],
		"name":          "Groups",
		"format":        "round_robin",
		"position":      float64(0),
		"config":        `{"poolCount":2,"advancePerPool":2}`,
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	t.Run("dry run", func(t *testing.T) {
		r, e := s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"session_token": tok,
			"stage_id": stage["id"], "dry_run": true,
		}))
		if e != nil {
			t.Fatalf("generate: %v", e)
		}
		var data map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
		if data["dry_run"] != true {
			t.Fatal("expected dry_run")
		}
	})

	t.Run("commit", func(t *testing.T) {
		r, e := s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
		if e != nil {
			t.Fatalf("generate: %v", e)
		}
		var data map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
		if data["fixtures"] != float64(12) {
			t.Fatalf("fixtures = %v, want 12", data["fixtures"])
		}
		if data["pools"] != float64(2) {
			t.Fatalf("pools = %v, want 2", data["pools"])
		}
	})

	t.Run("pools", func(t *testing.T) {
		r, e := s.listPools(ctx, toolArgs("list_pools", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
		if e != nil {
			t.Fatalf("list pools: %v", e)
		}
		var list []map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list)
		if len(list) != 2 {
			t.Fatalf("expected 2 pools, got %d", len(list))
		}
	})

	t.Run("fixtures", func(t *testing.T) {
		r, e := s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
		if e != nil {
			t.Fatalf("list fixtures: %v", e)
		}
		var list []map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list)
		if len(list) != 12 {
			t.Fatalf("expected 12 fixtures, got %d", len(list))
		}
	})
}

func TestUpdateAndGetFixture(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Fixture Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	for i := 1; i <= 4; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"],
			"name":          fmt.Sprintf("T%d", i),
			"seed":          float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"], "name": "Playoff", "format": "single_elim", "position": float64(0),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	_, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("generate: %v", e)
	}

	r, e = s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("list fixtures: %v", e)
	}
	var fixtures []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &fixtures)
	if len(fixtures) < 1 {
		t.Fatal("expected fixtures")
	}
	fixture := fixtures[0]

	t.Run("get", func(t *testing.T) {
		r, e := s.getFixture(ctx, toolArgs("get_fixture", map[string]any{"session_token": tok, "id": fixture["id"]}))
		if e != nil {
			t.Fatalf("get: %v", e)
		}
		var data map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
		if _, ok := data["games"]; !ok {
			t.Fatal("expected games field")
		}
	})

	t.Run("update", func(t *testing.T) {
		r, e := s.updateFixture(ctx, toolArgs("update_fixture", map[string]any{"session_token": tok,
			"id": fixture["id"], "status": "finished", "home_score": float64(2), "away_score": float64(0),
		}))
		if e != nil {
			t.Fatalf("update: %v", e)
		}
		var data map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
		if data["status"] != "finished" {
			t.Fatalf("status = %v", data["status"])
		}
	})

	t.Run("not found", func(t *testing.T) {
		_, e := s.getFixture(ctx, toolArgs("get_fixture", map[string]any{"session_token": tok, "id": "000000000000000"}))
		if e == nil {
			t.Fatal("expected error")
		}
	})
}

func TestListFixturesWithFilters(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Filter Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	for i := 1; i <= 8; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"], "name": fmt.Sprintf("T%d", i), "seed": float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"], "name": "Groups", "format": "round_robin",
		"position": float64(0), "config": `{"poolCount":2,"advancePerPool":2}`,
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	_, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("generate: %v", e)
	}

	t.Run("by round", func(t *testing.T) {
		r, e := s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"session_token": tok,
			"stage_id": stage["id"], "round": float64(0),
		}))
		if e != nil {
			t.Fatalf("list: %v", e)
		}
		var list []map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list)
		if len(list) != 4 {
			t.Fatalf("expected 4, got %d", len(list))
		}
	})

	t.Run("by status", func(t *testing.T) {
		r, e := s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"session_token": tok,
			"stage_id": stage["id"], "status": "ready",
		}))
		if e != nil {
			t.Fatalf("list: %v", e)
		}
		var list []map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list)
		if len(list) == 0 {
			t.Fatal("expected ready fixtures")
		}
	})
}

func TestResolveStage(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Resolve Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	for i := 1; i <= 4; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"], "name": fmt.Sprintf("T%d", i), "seed": float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"], "name": "Playoff", "format": "single_elim", "position": float64(0),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	_, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("generate: %v", e)
	}

	r, e = s.resolveStage(ctx, toolArgs("resolve_stage", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("resolve: %v", e)
	}
	var data map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
	if data["stage"] != stage["id"] {
		t.Fatalf("stage id mismatch")
	}
}

func TestListStandings(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Standings Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	for i := 1; i <= 4; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"], "name": fmt.Sprintf("T%d", i), "seed": float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"], "name": "Groups", "format": "round_robin",
		"position": float64(0), "config": `{"poolCount":1,"advancePerPool":2}`,
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	_, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("generate: %v", e)
	}

	r, e = s.listPools(ctx, toolArgs("list_pools", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("list pools: %v", e)
	}
	var pools []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &pools)
	if len(pools) == 0 {
		t.Fatal("expected pools")
	}

	r, e = s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("list fixtures: %v", e)
	}
	var fixtures []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &fixtures)
	if len(fixtures) > 0 {
		_, e = s.updateFixture(ctx, toolArgs("update_fixture", map[string]any{"session_token": tok,
			"id": fixtures[0]["id"], "status": "finished", "home_score": float64(2), "away_score": float64(0),
		}))
		if e != nil {
			t.Fatalf("update: %v", e)
		}
	}

	r, e = s.listStandings(ctx, toolArgs("list_standings", map[string]any{"session_token": tok, "pool_id": pools[0]["id"]}))
	if e != nil {
		t.Fatalf("list standings: %v", e)
	}
	var list []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list)
	if len(list) != 4 {
		t.Fatalf("expected 4, got %d", len(list))
	}
	for _, row := range list {
		if _, ok := row["entry"]; !ok {
			t.Fatal("expected entry field")
		}
	}
}

func TestPublishTournament(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Publish Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	r, e = s.publishTournament(ctx, toolArgs("publish_tournament", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"],
	}))
	if e != nil {
		t.Fatalf("publish: %v", e)
	}
	var data map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
	if data["status"] != "live" {
		t.Fatalf("status = %v", data["status"])
	}
}

func TestCreateDisplay(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Display Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	_, e = s.publishTournament(ctx, toolArgs("publish_tournament", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"],
	}))
	if e != nil {
		t.Fatalf("publish: %v", e)
	}

	t.Run("default name", func(t *testing.T) {
		r, e := s.createDisplay(ctx, toolArgs("create_display", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"],
		}))
		if e != nil {
			t.Fatalf("create display: %v", e)
		}
		var data map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
		if data["name"] != "Main screen" {
			t.Fatalf("name = %v", data["name"])
		}
	})

	t.Run("custom token", func(t *testing.T) {
		r, e := s.createDisplay(ctx, toolArgs("create_display", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"],
			"name":          "Side",
			"token":         "mytoken",
		}))
		if e != nil {
			t.Fatalf("create display: %v", e)
		}
		var data map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &data)
		if data["token"] != "mytoken" {
			t.Fatalf("token = %v", data["token"])
		}
	})
}

func TestSwissStage(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Swiss Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	for i := 1; i <= 9; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"], "name": fmt.Sprintf("S%d", i), "seed": float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"], "name": "Swiss", "format": "swiss",
		"position": float64(0), "config": `{"advancePerPool":4}`,
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	r, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("generate: %v", e)
	}
	var gen map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &gen)
	if gen["pools"] != float64(1) {
		t.Fatalf("pools = %v", gen["pools"])
	}
	if gen["fixtures"] != float64(5) {
		t.Fatalf("fixtures = %v", gen["fixtures"])
	}

	r, e = s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("list: %v", e)
	}
	var fixtures []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &fixtures)
	if len(fixtures) != 5 {
		t.Fatalf("expected 5, got %d", len(fixtures))
	}
}

// The id does not exist, and the session is a real one — so what is being
// tested is still the missing record rather than the missing credential.
func TestGenerateStageErrors(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)
	tok := freshSession(t, s)

	_, e := s.generateStage(ctx, toolArgs("generate_stage", map[string]any{
		"session_token": tok,
		"stage_id":      "000000000000000",
	}))
	if e == nil {
		t.Fatal("expected error")
	}
}

func TestUpdateFixtureErrors(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)
	tok := freshSession(t, s)

	_, e := s.updateFixture(ctx, toolArgs("update_fixture", map[string]any{
		"session_token": tok,
		"id":            "000000000000000", "status": "finished",
	}))
	if e == nil {
		t.Fatal("expected error")
	}
}

func TestPublishTournamentErrors(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)
	tok := freshSession(t, s)

	_, e := s.publishTournament(ctx, toolArgs("publish_tournament", map[string]any{
		"session_token": tok,
		"tournament_id": "000000000000000",
	}))
	if e == nil {
		t.Fatal("expected error")
	}
}

// Every tool but create_tournament refuses a caller it cannot identify, and
// refuses one that is identified but has no business with the tournament.
// This is the whole of the authorisation story, so it is asserted rather than
// assumed.
func TestToolsRefuseWithoutASession(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Mine"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var mine map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &mine)
	id := mine["id"].(string)

	t.Run("no token at all", func(t *testing.T) {
		if _, err := s.getTournament(ctx, toolArgs("get_tournament",
			map[string]any{"id": id})); err == nil {
			t.Fatal("a tool answered a caller with no session")
		}
	})

	t.Run("a token that means nothing", func(t *testing.T) {
		if _, err := s.getTournament(ctx, toolArgs("get_tournament",
			map[string]any{"id": id, "session_token": "not-a-token"})); err == nil {
			t.Fatal("a tool answered a caller holding nonsense")
		}
	})

	t.Run("somebody else's session", func(t *testing.T) {
		other := freshSession(t, s)
		if _, err := s.getTournament(ctx, toolArgs("get_tournament",
			map[string]any{"id": id, "session_token": other})); err == nil {
			t.Fatal("a tool handed one session's tournament to another")
		}
	})

	t.Run("and writes too, not only reads", func(t *testing.T) {
		other := freshSession(t, s)
		if _, err := s.publishTournament(ctx, toolArgs("publish_tournament",
			map[string]any{"tournament_id": id, "session_token": other})); err == nil {
			t.Fatal("a stranger published somebody else's tournament")
		}
		if _, err := s.addEntry(ctx, toolArgs("add_entry", map[string]any{
			"tournament_id": id, "name": "Gatecrasher", "seed": float64(1),
			"session_token": other,
		})); err == nil {
			t.Fatal("a stranger added a team to somebody else's tournament")
		}
	})
}

func TestSlugify(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"Hello World", "hello-world"},
		{"Český turnaj", "cesky-turnaj"},
		{"  spaces  ", "spaces"},
		{"UPPERCASE", "uppercase"},
		{"special!@#chars", "special-chars"},
	}
	for _, c := range cases {
		got := slugify(c.input)
		prefix := got[:len(got)-6]
		if prefix != c.want {
			t.Errorf("slugify(%q) prefix = %q, want %q", c.input, prefix, c.want)
		}
		if len(got) <= 6 {
			t.Errorf("slugify(%q) too short: %q", c.input, got)
		}
	}
}

func TestSlugifyUnique(t *testing.T) {
	slugs := make(map[string]bool, 50)
	for i := 0; i < 50; i++ {
		s := slugify("Test Tournament")
		if slugs[s] {
			t.Fatalf("duplicate slug: %s", s)
		}
		slugs[s] = true
	}
}

// freshSession mints an account and the token to act as it, for tests that
// need somebody who is definitely not the owner of anything.
func freshSession(t *testing.T, s *WhistleMCP) string {
	t.Helper()
	_, token, err := s.newOrganiser()
	if err != nil {
		t.Fatalf("session: %v", err)
	}
	return token
}

// An account per tournament, and each one claimable.
//
// The shared `mcp@whistleday.local` this replaces meant every tournament the
// MCP ever made had the same owner: any caller could edit all of them, and no
// single tournament could be handed to a person without handing over the lot.
func TestNewOrganiser(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	first, tokenA, err := s.newOrganiser()
	if err != nil {
		t.Fatalf("first: %v", err)
	}
	second, tokenB, err := s.newOrganiser()
	if err != nil {
		t.Fatalf("second: %v", err)
	}

	if first.Id == second.Id {
		t.Fatal("two calls produced one account")
	}
	if tokenA == tokenB {
		t.Fatal("two accounts produced one token")
	}

	// On the device suffix, so `/api/organiser/claim` will hand it to a person
	// later. An agent's account is an unclaimed account like any other.
	if !tournament.IsDeviceAccount(first.Email()) {
		t.Fatalf("email %q is not claimable", first.Email())
	}

	// And the token actually identifies the account it came from.
	got, err := s.app.FindAuthRecordByToken(tokenA, core.TokenTypeAuth)
	if err != nil || got == nil || got.Id != first.Id {
		t.Fatalf("token did not resolve to its own account: %v", err)
	}
}

func TestCompleteFlow(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	r, e := s.createTournament(ctx, toolArgs("create_tournament", map[string]any{"name": "Complete Test"}))
	if e != nil {
		t.Fatalf("create: %v", e)
	}
	var tournament map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &tournament)
	tok := tournament["session_token"].(string)

	for i := 1; i <= 4; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{"session_token": tok,
			"tournament_id": tournament["id"], "name": fmt.Sprintf("Team %d", i), "seed": float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{"session_token": tok,
		"tournament_id": tournament["id"], "name": "Knockout", "format": "single_elim", "position": float64(0),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	r, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("generate: %v", e)
	}
	var gen map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &gen)
	if gen["fixtures"] != float64(3) {
		t.Fatalf("fixtures = %v, want 3", gen["fixtures"])
	}

	r, e = s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("list: %v", e)
	}
	var fixtures []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &fixtures)

	for _, f := range fixtures {
		if f["round"] == float64(0) {
			_, e := s.updateFixture(ctx, toolArgs("update_fixture", map[string]any{"session_token": tok,
				"id": f["id"], "status": "finished", "home_score": float64(2), "away_score": float64(0),
			}))
			if e != nil {
				t.Fatalf("update: %v", e)
			}
		}
	}

	r, e = s.resolveStage(ctx, toolArgs("resolve_stage", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("resolve: %v", e)
	}
	var resolve map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &resolve)
	if resolve["resolved"] != float64(2) {
		t.Fatalf("resolved = %v, want 2", resolve["resolved"])
	}

	r, e = s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"session_token": tok, "stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("list: %v", e)
	}
	var updated []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &updated)
	if updated[len(updated)-1]["round"] != float64(1) {
		t.Fatalf("final round = %v", updated[len(updated)-1]["round"])
	}
}

// ---------------------------------------------------------------------------
// stage_rank: qualifying on a comparison across pools
// ---------------------------------------------------------------------------

// call runs one MCP tool and unmarshals its JSON result into out.
func call(t *testing.T, fn func(context.Context, mcp.CallToolRequest) (*mcp.CallToolResult, error),
	name string, args map[string]any, out any) {
	t.Helper()
	r, err := fn(ctx, toolArgs(name, args))
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

// playPool settles every fixture in one pool, with descending scores so the
// table comes out in a definite order rather than a tied heap.
func playPool(t *testing.T, s *WhistleMCP, tok, stageID, poolID string) {
	t.Helper()
	var fixtures []map[string]any
	call(t, s.listFixtures, "list_fixtures",
		map[string]any{"session_token": tok, "stage_id": stageID, "pool_id": poolID}, &fixtures)

	for i, f := range fixtures {
		call(t, s.updateFixture, "update_fixture", map[string]any{
			"session_token": tok,
			"id":            f["id"], "status": "finished",
			"home_score": float64(3), "away_score": float64(i % 3),
		}, nil)
	}
}

func entriesAt(table []map[string]any, from, to int) map[string]bool {
	set := map[string]bool{}
	for _, row := range table {
		if p := int(row["position"].(float64)); p >= from && p <= to {
			set[row["entry"].(string)] = true
		}
	}
	return set
}

// A playoff can be seeded on "the best runners-up" — a comparison between
// teams who were never in the same pool. It runs through the stage table and
// the stage_rank slots that read it, all the way from create_stage to a
// bracket with both sides of every match filled in.
func TestStageRankSeedsAPlayoff(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	var cup map[string]any
	call(t, s.createTournament, "create_tournament", map[string]any{"name": "Stage Rank Cup"}, &cup)
	tok := cup["session_token"].(string)

	for i := 1; i <= 12; i++ {
		call(t, s.addEntry, "add_entry", map[string]any{"session_token": tok,
			"tournament_id": cup["id"], "name": fmt.Sprintf("Team %d", i), "seed": float64(i),
		}, nil)
	}

	var groups map[string]any
	call(t, s.createStage, "create_stage", map[string]any{"session_token": tok,
		"tournament_id": cup["id"], "name": "Groups", "format": "round_robin",
		"position": float64(0), "config": `{"poolCount":4,"advancePerPool":1}`,
	}, &groups)
	call(t, s.generateStage, "generate_stage", map[string]any{"session_token": tok, "stage_id": groups["id"]}, nil)

	// Four pool winners, plus all four runners-up on merit: an eight-team
	// bracket where half the seeds cannot be named until every group is in.
	var playoff map[string]any
	call(t, s.createStage, "create_stage", map[string]any{"session_token": tok,
		"tournament_id": cup["id"], "name": "Playoff", "format": "single_elim",
		"position": float64(1),
		"config": fmt.Sprintf(
			`{"seedFrom":{"stage":%q,"advancePerPool":1,"bestOfNext":4}}`, groups["id"]),
	}, &playoff)
	call(t, s.generateStage, "generate_stage", map[string]any{"session_token": tok, "stage_id": playoff["id"]}, nil)

	var pools []map[string]any
	call(t, s.listPools, "list_pools", map[string]any{"session_token": tok, "stage_id": groups["id"]}, &pools)
	if len(pools) != 4 {
		t.Fatalf("pools = %d, want 4", len(pools))
	}

	// --- three pools in, one still playing ---------------------------------
	//
	// The pool winners of a finished pool go through immediately; a best
	// runner-up cannot, because the pool still playing might produce a better
	// one. This is the difference between pool_rank and stage_rank.
	for _, pool := range pools[:3] {
		playPool(t, s, tok, groups["id"].(string), pool["id"].(string))
	}

	// The table itself is kept up to date throughout, exactly as a pool table
	// is — the third-place race is the thing everybody wants to watch. What
	// waits for the last group is anything being *seeded* from it.
	var early []map[string]any
	call(t, s.getStageTable, "get_stage_table", map[string]any{"session_token": tok, "stage_id": groups["id"]}, &early)
	if len(early) != 12 {
		t.Fatalf("provisional stage table = %d rows, want 12", len(early))
	}

	var midway []map[string]any
	call(t, s.listFixtures, "list_fixtures", map[string]any{"session_token": tok, "stage_id": playoff["id"], "round": float64(0)}, &midway)
	resolved := 0
	for _, f := range midway {
		if f["home_entry"] != "" {
			resolved++
		}
		if f["away_entry"] != "" {
			resolved++
		}
	}
	if resolved != 3 {
		t.Fatalf("resolved seeds = %d, want the 3 finished pools' winners only", resolved)
	}

	// --- the last pool finishes --------------------------------------------
	playPool(t, s, tok, groups["id"].(string), pools[3]["id"].(string))

	var table []map[string]any
	call(t, s.getStageTable, "get_stage_table", map[string]any{"session_token": tok, "stage_id": groups["id"]}, &table)
	if len(table) != 12 {
		t.Fatalf("stage table = %d rows, want 12", len(table))
	}
	for i, row := range table {
		if got := int(row["position"].(float64)); got != i+1 {
			t.Fatalf("row %d has position %d", i, got)
		}
	}

	// Positions 1-4 are the four pool winners and 5-8 the four runners-up,
	// whatever their records: a runner-up never outranks a winner.
	winners, runnersUp := map[string]bool{}, map[string]bool{}
	for _, pool := range pools {
		var poolTable []map[string]any
		call(t, s.listStandings, "list_standings", map[string]any{"session_token": tok, "pool_id": pool["id"]}, &poolTable)
		winners[poolTable[0]["entry"].(string)] = true
		runnersUp[poolTable[1]["entry"].(string)] = true
	}

	assertSameEntries(t, "tier 1", entriesAt(table, 1, 4), winners)
	assertSameEntries(t, "tier 2", entriesAt(table, 5, 8), runnersUp)

	// --- and the bracket is full -------------------------------------------
	var bracket []map[string]any
	call(t, s.listFixtures, "list_fixtures", map[string]any{"session_token": tok, "stage_id": playoff["id"], "round": float64(0)}, &bracket)
	if len(bracket) != 4 {
		t.Fatalf("round 0 fixtures = %d, want 4", len(bracket))
	}
	for _, f := range bracket {
		if f["home_entry"] == "" || f["away_entry"] == "" {
			t.Fatalf("%v still unresolved: %v v %v", f["code"], f["home_entry"], f["away_entry"])
		}
		if f["status"] != "ready" {
			t.Fatalf("%v status = %v, want ready", f["code"], f["status"])
		}
	}
}

func assertSameEntries(t *testing.T, what string, got, want map[string]bool) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: %d entries, want %d", what, len(got), len(want))
	}
	for entry := range want {
		if !got[entry] {
			t.Fatalf("%s: %s missing", what, entry)
		}
	}
}

// Snaked pools are not always equal — ten teams in three pools is 4/3/3 — and
// a team from the pool of four has played a match the others have not. The
// stage table drops that bottom place and disregards the results against it,
// so every row it holds is over the same number of matches.
func TestStageTableEvensOutUnequalPools(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	var cup map[string]any
	call(t, s.createTournament, "create_tournament", map[string]any{"name": "Uneven Cup"}, &cup)
	tok := cup["session_token"].(string)
	for i := 1; i <= 10; i++ {
		call(t, s.addEntry, "add_entry", map[string]any{"session_token": tok,
			"tournament_id": cup["id"], "name": fmt.Sprintf("Team %d", i), "seed": float64(i),
		}, nil)
	}

	var groups map[string]any
	call(t, s.createStage, "create_stage", map[string]any{"session_token": tok,
		"tournament_id": cup["id"], "name": "Groups", "format": "round_robin",
		"position": float64(0), "config": `{"poolCount":3,"advancePerPool":1}`,
	}, &groups)
	call(t, s.generateStage, "generate_stage", map[string]any{"session_token": tok, "stage_id": groups["id"]}, nil)

	var pools []map[string]any
	call(t, s.listPools, "list_pools", map[string]any{"session_token": tok, "stage_id": groups["id"]}, &pools)
	for _, pool := range pools {
		playPool(t, s, tok, groups["id"].(string), pool["id"].(string))
	}

	var table []map[string]any
	call(t, s.getStageTable, "get_stage_table", map[string]any{"session_token": tok, "stage_id": groups["id"]}, &table)

	// Three pools, and the smallest holds three: nine rows, not ten. The team
	// that came fourth in the pool of four has no counterpart to be compared
	// against and is left out rather than ranked against nobody.
	if len(table) != 9 {
		t.Fatalf("stage table = %d rows, want 9", len(table))
	}
	for _, row := range table {
		if played := int(row["played"].(float64)); played != 2 {
			t.Fatalf("%v played %d matches in the stage table, want 2 for everyone",
				row["entry"], played)
		}
	}
}

// bestOfNext asks for a place every pool has to have. A stage whose pools are
// too small to offer one is a config error, not a bracket quietly seeded from
// the tier below.
func TestBestOfNextRejectsPoolsWithoutThatPlace(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	var cup map[string]any
	call(t, s.createTournament, "create_tournament", map[string]any{"name": "Too Small"}, &cup)
	tok := cup["session_token"].(string)
	for i := 1; i <= 4; i++ {
		call(t, s.addEntry, "add_entry", map[string]any{"session_token": tok,
			"tournament_id": cup["id"], "name": fmt.Sprintf("Team %d", i), "seed": float64(i),
		}, nil)
	}

	var groups map[string]any
	call(t, s.createStage, "create_stage", map[string]any{"session_token": tok,
		"tournament_id": cup["id"], "name": "Groups", "format": "round_robin",
		"position": float64(0), "config": `{"poolCount":2,"advancePerPool":2}`,
	}, &groups)
	call(t, s.generateStage, "generate_stage", map[string]any{"session_token": tok, "stage_id": groups["id"]}, nil)

	var playoff map[string]any
	call(t, s.createStage, "create_stage", map[string]any{"session_token": tok,
		"tournament_id": cup["id"], "name": "Playoff", "format": "single_elim",
		"position": float64(1),
		"config": fmt.Sprintf(
			`{"seedFrom":{"stage":%q,"advancePerPool":2,"bestOfNext":2}}`, groups["id"]),
	}, &playoff)

	// Pools of two, both teams already through: there is no third place.
	_, err := s.generateStage(ctx, toolArgs("generate_stage",
		map[string]any{"session_token": tok, "stage_id": playoff["id"]}))
	if err == nil {
		t.Fatal("expected generate to refuse a 3rd place that does not exist")
	}
	if !strings.Contains(err.Error(), "too few") {
		t.Fatalf("error = %v, want it to say the pool is too small", err)
	}
}
