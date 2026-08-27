package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/pocketbase/pocketbase/tests"

	"seedly/backend/internal/tournament"
	_ "seedly/backend/migrations"
)

func newTestApp(t *testing.T) *tests.TestApp {
	t.Helper()
	dir, err := os.MkdirTemp("", "seedly-mcp-test-*")
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

	t.Run("empty", func(t *testing.T) {
		r, e := s.listTournaments(ctx, toolArgs("list_tournaments", nil))
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
		if created["name"] != "Test Cup" {
			t.Fatalf("name = %v", created["name"])
		}

		r, e = s.listTournaments(ctx, toolArgs("list_tournaments", nil))
		if e != nil {
			t.Fatalf("list: %v", e)
		}
		var list []map[string]any
		json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &list)
		if len(list) != 1 {
			t.Fatalf("expected 1, got %d", len(list))
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

	t.Run("found", func(t *testing.T) {
		r, e := s.getTournament(ctx, toolArgs("get_tournament", map[string]any{"id": created["id"]}))
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
		_, e := s.getTournament(ctx, toolArgs("get_tournament", map[string]any{"id": "000000000000000"}))
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

	t.Run("add entry", func(t *testing.T) {
		r, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{
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
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{
			"tournament_id": tournament["id"], "name": "Team Beta", "seed": float64(2),
		}))
		if e != nil {
			t.Fatalf("add: %v", e)
		}
		_, e = s.addEntry(ctx, toolArgs("add_entry", map[string]any{
			"tournament_id": tournament["id"], "name": "Team Gamma", "seed": float64(3),
		}))
		if e != nil {
			t.Fatalf("add: %v", e)
		}

		r, e := s.listEntries(ctx, toolArgs("list_entries", map[string]any{"tournament_id": tournament["id"]}))
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

	t.Run("round robin", func(t *testing.T) {
		r, e := s.createStage(ctx, toolArgs("create_stage", map[string]any{
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
		r, e := s.createStage(ctx, toolArgs("create_stage", map[string]any{
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

	_, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{
		"tournament_id": tournament["id"], "name": "Groups", "format": "round_robin", "position": float64(0),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	_, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{
		"tournament_id": tournament["id"], "name": "Playoff", "format": "single_elim", "position": float64(1),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}

	r, e = s.listStages(ctx, toolArgs("list_stages", map[string]any{"tournament_id": tournament["id"]}))
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

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{
		"tournament_id": tournament["id"], "name": "My Stage", "format": "swiss", "position": float64(0),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	t.Run("found", func(t *testing.T) {
		r, e := s.getStage(ctx, toolArgs("get_stage", map[string]any{"id": stage["id"]}))
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
		_, e := s.getStage(ctx, toolArgs("get_stage", map[string]any{"id": "000000000000000"}))
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

	for i := 1; i <= 8; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{
			"tournament_id": tournament["id"],
			"name":          fmt.Sprintf("T%d", i),
			"seed":          float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{
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
		r, e := s.generateStage(ctx, toolArgs("generate_stage", map[string]any{
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
		r, e := s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"stage_id": stage["id"]}))
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
		r, e := s.listPools(ctx, toolArgs("list_pools", map[string]any{"stage_id": stage["id"]}))
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
		r, e := s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"stage_id": stage["id"]}))
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

	for i := 1; i <= 4; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{
			"tournament_id": tournament["id"],
			"name":          fmt.Sprintf("T%d", i),
			"seed":          float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{
		"tournament_id": tournament["id"], "name": "Playoff", "format": "single_elim", "position": float64(0),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	_, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("generate: %v", e)
	}

	r, e = s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"stage_id": stage["id"]}))
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
		r, e := s.getFixture(ctx, toolArgs("get_fixture", map[string]any{"id": fixture["id"]}))
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
		r, e := s.updateFixture(ctx, toolArgs("update_fixture", map[string]any{
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
		_, e := s.getFixture(ctx, toolArgs("get_fixture", map[string]any{"id": "000000000000000"}))
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

	for i := 1; i <= 8; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{
			"tournament_id": tournament["id"], "name": fmt.Sprintf("T%d", i), "seed": float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{
		"tournament_id": tournament["id"], "name": "Groups", "format": "round_robin",
		"position": float64(0), "config": `{"poolCount":2,"advancePerPool":2}`,
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	_, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("generate: %v", e)
	}

	t.Run("by round", func(t *testing.T) {
		r, e := s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{
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
		r, e := s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{
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

	for i := 1; i <= 4; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{
			"tournament_id": tournament["id"], "name": fmt.Sprintf("T%d", i), "seed": float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{
		"tournament_id": tournament["id"], "name": "Playoff", "format": "single_elim", "position": float64(0),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	_, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("generate: %v", e)
	}

	r, e = s.resolveStage(ctx, toolArgs("resolve_stage", map[string]any{"stage_id": stage["id"]}))
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

	for i := 1; i <= 4; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{
			"tournament_id": tournament["id"], "name": fmt.Sprintf("T%d", i), "seed": float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{
		"tournament_id": tournament["id"], "name": "Groups", "format": "round_robin",
		"position": float64(0), "config": `{"poolCount":1,"advancePerPool":2}`,
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	_, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("generate: %v", e)
	}

	r, e = s.listPools(ctx, toolArgs("list_pools", map[string]any{"stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("list pools: %v", e)
	}
	var pools []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &pools)
	if len(pools) == 0 {
		t.Fatal("expected pools")
	}

	r, e = s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("list fixtures: %v", e)
	}
	var fixtures []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &fixtures)
	if len(fixtures) > 0 {
		_, e = s.updateFixture(ctx, toolArgs("update_fixture", map[string]any{
			"id": fixtures[0]["id"], "status": "finished", "home_score": float64(2), "away_score": float64(0),
		}))
		if e != nil {
			t.Fatalf("update: %v", e)
		}
	}

	r, e = s.listStandings(ctx, toolArgs("list_standings", map[string]any{"pool_id": pools[0]["id"]}))
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

	r, e = s.publishTournament(ctx, toolArgs("publish_tournament", map[string]any{
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

	_, e = s.publishTournament(ctx, toolArgs("publish_tournament", map[string]any{
		"tournament_id": tournament["id"],
	}))
	if e != nil {
		t.Fatalf("publish: %v", e)
	}

	t.Run("default name", func(t *testing.T) {
		r, e := s.createDisplay(ctx, toolArgs("create_display", map[string]any{
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
		r, e := s.createDisplay(ctx, toolArgs("create_display", map[string]any{
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

	for i := 1; i <= 9; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{
			"tournament_id": tournament["id"], "name": fmt.Sprintf("S%d", i), "seed": float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{
		"tournament_id": tournament["id"], "name": "Swiss", "format": "swiss",
		"position": float64(0), "config": `{"advancePerPool":4}`,
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	r, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"stage_id": stage["id"]}))
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

	r, e = s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("list: %v", e)
	}
	var fixtures []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &fixtures)
	if len(fixtures) != 5 {
		t.Fatalf("expected 5, got %d", len(fixtures))
	}
}

func TestGenerateStageErrors(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	_, e := s.generateStage(ctx, toolArgs("generate_stage", map[string]any{
		"stage_id": "000000000000000",
	}))
	if e == nil {
		t.Fatal("expected error")
	}
}

func TestUpdateFixtureErrors(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	_, e := s.updateFixture(ctx, toolArgs("update_fixture", map[string]any{
		"id": "000000000000000", "status": "finished",
	}))
	if e == nil {
		t.Fatal("expected error")
	}
}

func TestPublishTournamentErrors(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	_, e := s.publishTournament(ctx, toolArgs("publish_tournament", map[string]any{
		"tournament_id": "000000000000000",
	}))
	if e == nil {
		t.Fatal("expected error")
	}
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

func TestEnsureSystemUser(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	user, e := s.ensureSystemUser()
	if e != nil {
		t.Fatalf("first call: %v", e)
	}
	if user.GetString("email") != "mcp@seedly.local" {
		t.Fatalf("email = %q", user.GetString("email"))
	}

	second, e := s.ensureSystemUser()
	if e != nil {
		t.Fatalf("second call: %v", e)
	}
	if second.Id != user.Id {
		t.Fatal("not idempotent")
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

	for i := 1; i <= 4; i++ {
		_, e := s.addEntry(ctx, toolArgs("add_entry", map[string]any{
			"tournament_id": tournament["id"], "name": fmt.Sprintf("Team %d", i), "seed": float64(i),
		}))
		if e != nil {
			t.Fatalf("add entry: %v", e)
		}
	}

	r, e = s.createStage(ctx, toolArgs("create_stage", map[string]any{
		"tournament_id": tournament["id"], "name": "Knockout", "format": "single_elim", "position": float64(0),
	}))
	if e != nil {
		t.Fatalf("create stage: %v", e)
	}
	var stage map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &stage)

	r, e = s.generateStage(ctx, toolArgs("generate_stage", map[string]any{"stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("generate: %v", e)
	}
	var gen map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &gen)
	if gen["fixtures"] != float64(3) {
		t.Fatalf("fixtures = %v, want 3", gen["fixtures"])
	}

	r, e = s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("list: %v", e)
	}
	var fixtures []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &fixtures)

	for _, f := range fixtures {
		if f["round"] == float64(0) {
			_, e := s.updateFixture(ctx, toolArgs("update_fixture", map[string]any{
				"id": f["id"], "status": "finished", "home_score": float64(2), "away_score": float64(0),
			}))
			if e != nil {
				t.Fatalf("update: %v", e)
			}
		}
	}

	r, e = s.resolveStage(ctx, toolArgs("resolve_stage", map[string]any{"stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("resolve: %v", e)
	}
	var resolve map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &resolve)
	if resolve["resolved"] != float64(2) {
		t.Fatalf("resolved = %v, want 2", resolve["resolved"])
	}

	r, e = s.listFixtures(ctx, toolArgs("list_fixtures", map[string]any{"stage_id": stage["id"]}))
	if e != nil {
		t.Fatalf("list: %v", e)
	}
	var updated []map[string]any
	json.Unmarshal([]byte(r.Content[0].(mcp.TextContent).Text), &updated)
	if updated[len(updated)-1]["round"] != float64(1) {
		t.Fatalf("final round = %v", updated[len(updated)-1]["round"])
	}
}
