package mcp

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

// Every tool says what it returns, and what it returns is what it said: one
// tournament is taken from nothing to a handoff link through the registered
// handlers, and each result is checked against the schema a client was shown.
func TestToolOutputsMatchTheirSchemas(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	checked := map[string]bool{}

	// run calls a tool the way a client does and validates the answer.
	run := func(name string, args map[string]any) map[string]any {
		t.Helper()
		registered := s.mcp.GetTool(name)
		if registered == nil {
			t.Fatalf("%s is not registered", name)
		}
		raw := registered.Tool.RawOutputSchema
		if len(raw) == 0 {
			t.Fatalf("%s: no output schema", name)
		}

		// And it is in what tools/list sends, as an object schema.
		listed, err := json.Marshal(registered.Tool)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		var advertised struct {
			OutputSchema struct {
				Type string `json:"type"`
			} `json:"outputSchema"`
		}
		if err := json.Unmarshal(listed, &advertised); err != nil || advertised.OutputSchema.Type != "object" {
			t.Fatalf("%s: outputSchema missing from the tool listing: %s", name, listed)
		}

		result, err := registered.Handler(ctx, toolArgs(name, args))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if result.IsError {
			t.Fatalf("%s: error result: %v", name, result.Content)
		}

		structured, err := json.Marshal(result.StructuredContent)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		// The text block is the same JSON, for a client that reads only that.
		if text := result.Content[0].(mcp.TextContent).Text; text != string(structured) {
			t.Errorf("%s: text and structuredContent differ:\n%s\n%s", name, text, structured)
		}

		schemaDoc, err := jsonschema.UnmarshalJSON(bytes.NewReader(raw))
		if err != nil {
			t.Fatalf("%s: schema is not JSON: %v", name, err)
		}
		compiler := jsonschema.NewCompiler()
		if err := compiler.AddResource(name+".json", schemaDoc); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		schema, err := compiler.Compile(name + ".json")
		if err != nil {
			t.Fatalf("%s: schema does not compile: %v", name, err)
		}
		instance, err := jsonschema.UnmarshalJSON(bytes.NewReader(structured))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if err := schema.Validate(instance); err != nil {
			t.Errorf("%s: result does not match its schema: %v\n%s", name, err, structured)
		}

		var out map[string]any
		if err := json.Unmarshal(structured, &out); err != nil {
			t.Fatalf("%s: structuredContent is not an object: %v", name, err)
		}
		checked[name] = true
		return out
	}
	list := func(out map[string]any, key string) []any {
		t.Helper()
		items, _ := out[key].([]any)
		if len(items) == 0 {
			t.Fatalf("expected rows under %q, got %v", key, out)
		}
		return items
	}
	first := func(out map[string]any, key string) string {
		t.Helper()
		return list(out, key)[0].(map[string]any)["id"].(string)
	}

	cup := run("create_tournament", map[string]any{"name": "Schema Cup", "sport": "volleyball"})
	tid := cup["id"].(string)
	run("list_tournaments", map[string]any{})
	run("get_tournament", map[string]any{"id": tid})

	for i, name := range []string{"Ants", "Bees", "Cats", "Dogs"} {
		run("add_entry", map[string]any{"tournament_id": tid, "name": name, "seed": float64(i + 1)})
	}
	run("list_entries", map[string]any{"tournament_id": tid})

	court := run("add_court", map[string]any{"tournament_id": tid, "name": "Court 1"})
	run("list_courts", map[string]any{"tournament_id": tid})

	stage := run("create_stage", map[string]any{
		"tournament_id": tid, "name": "Group", "format": "round_robin",
		"position": float64(0), "config": `{"poolCount":1}`,
	})
	sid := stage["id"].(string)
	run("list_stages", map[string]any{"tournament_id": tid})
	run("get_stage", map[string]any{"id": sid})

	run("generate_stage", map[string]any{"stage_id": sid, "dry_run": true})
	run("generate_stage", map[string]any{"stage_id": sid})

	pid := first(run("list_pools", map[string]any{"stage_id": sid}), "pools")
	fid := first(run("list_fixtures", map[string]any{"stage_id": sid}), "fixtures")

	run("update_fixture", map[string]any{
		"id": fid, "status": "finished", "court": court["id"],
		"home_score": float64(2), "away_score": float64(0),
	})
	run("get_fixture", map[string]any{"id": fid})
	run("resolve_stage", map[string]any{"stage_id": sid})
	list(run("list_standings", map[string]any{"pool_id": pid}), "standings")
	run("get_stage_table", map[string]any{"stage_id": sid})

	run("publish_tournament", map[string]any{"tournament_id": tid})
	run("create_display", map[string]any{"tournament_id": tid})
	run("create_handoff", map[string]any{"tournament_id": tid})

	for name := range s.mcp.ListTools() {
		if !checked[name] {
			t.Errorf("%s: output never checked against its schema", name)
		}
	}
}
