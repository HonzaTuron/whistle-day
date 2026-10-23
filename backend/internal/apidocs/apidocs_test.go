package apidocs

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/tests"
	"github.com/spf13/cobra"

	_ "whistleday/backend/migrations"
)

func newTestApp(t *testing.T) *tests.TestApp {
	t.Helper()
	dir, err := os.MkdirTemp("", "whistleday-apidocs-test-*")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	app, err := tests.NewTestApp(dir)
	if err != nil {
		os.RemoveAll(dir)
		t.Fatalf("NewTestApp: %v", err)
	}
	t.Cleanup(func() {
		app.Cleanup()
		os.RemoveAll(dir)
	})
	return app
}

// Routes that exist and are deliberately not in the reference, with why.
var undocumented = map[string]string{
	// The consent screen's own backend: what /oauth/authorize redirects a
	// browser into. No client other than that screen has a request id to
	// call it with.
	"GET /api/oauth/consent/{request_id}":  "internal to the consent screen",
	"POST /api/oauth/consent/{request_id}": "internal to the consent screen",
}

var routeCall = regexp.MustCompile(`se\.Router\.(GET|POST|PUT|PATCH|DELETE)\(("[^"]+"|MCPEndpoint)`)

// A reference that lists fewer routes than the server answers is the failure
// this file is most likely to have, and nothing about adding a route would
// otherwise point here. So the routes are read out of the source that
// registers them, and every one has to be either documented or excused.
func TestEveryRouteIsDocumented(t *testing.T) {
	sources, err := filepath.Glob("../*/*.go")
	if err != nil {
		t.Fatal(err)
	}

	found := 0
	for _, source := range sources {
		if strings.HasSuffix(source, "_test.go") || strings.Contains(source, "/apidocs/") {
			continue
		}
		body, err := os.ReadFile(source)
		if err != nil {
			t.Fatal(err)
		}
		for _, call := range routeCall.FindAllStringSubmatch(string(body), -1) {
			found++
			method, path := call[1], strings.Trim(call[2], `"`)
			if path == "MCPEndpoint" {
				path = "/api/mcp"
			}

			route := method + " " + path
			if _, excused := undocumented[route]; excused {
				continue
			}
			if _, ok := operationAt(path, method); !ok {
				t.Errorf("%s is registered in %s and missing from openapi.json", route, source)
			}
		}
	}

	// The pattern above is the weak point: if routes stop being registered
	// in a shape it recognises, this test would pass by finding nothing.
	if found < 20 {
		t.Fatalf("found only %d registered routes; the pattern no longer matches how they are written", found)
	}
}

func operationAt(path, method string) (operation, bool) {
	for _, item := range spec.paths {
		if item.path == path {
			op, ok := item.operations[strings.ToLower(method)]
			return op, ok
		}
	}
	return operation{}, false
}

func TestEveryOperationIsReadable(t *testing.T) {
	tags := map[string]bool{}
	for _, tag := range spec.Tags {
		tags[tag.Name] = true
	}

	for _, item := range spec.paths {
		for method, op := range item.operations {
			route := strings.ToUpper(method) + " " + item.path
			if op.Summary == "" || op.Description == "" {
				t.Errorf("%s needs a summary and a description", route)
			}
			if len(op.Responses) == 0 {
				t.Errorf("%s lists no responses", route)
			}
			// An operation under a tag the page does not know is one the
			// page silently leaves out.
			if len(op.Tags) != 1 || !tags[op.Tags[0]] {
				t.Errorf("%s needs exactly one tag from the tags list, has %v", route, op.Tags)
			}
			for _, name := range pathParams(item.path) {
				if !hasPathParam(op, name) {
					t.Errorf("%s does not describe its {%s}", route, name)
				}
			}
		}
	}
}

var pathParam = regexp.MustCompile(`\{([^}]+)\}`)

func pathParams(path string) []string {
	var names []string
	for _, match := range pathParam.FindAllStringSubmatch(path, -1) {
		names = append(names, match[1])
	}
	return names
}

func hasPathParam(op operation, name string) bool {
	for _, p := range op.Parameters {
		if p.In == "path" && p.Name == name && p.Required {
			return true
		}
	}
	return false
}

func TestPageListsEveryOperationAndLiveFields(t *testing.T) {
	app := newTestApp(t)

	page, err := Page(app)
	if err != nil {
		t.Fatalf("Page: %v", err)
	}

	for _, item := range spec.paths {
		for method := range item.operations {
			if !strings.Contains(page, `id="`+slug(method+" "+item.path)+`"`) {
				t.Errorf("the page has no section for %s %s", strings.ToUpper(method), item.path)
			}
		}
	}

	// Read from the schema the migrations built, not from the spec.
	for _, want := range []string{"<code>home_score</code>", "relation to tournaments", "round_robin | single_elim"} {
		if !strings.Contains(page, want) {
			t.Errorf("the page is missing %q", want)
		}
	}

	// A collection the spec names and the database does not have would
	// render as a row with no fields behind it.
	for _, c := range spec.Collections {
		if len(fieldsOf(app, c.Name)) == 0 {
			t.Errorf("x-collections names %q, which has no fields in the schema", c.Name)
		}
	}
}

func TestPageLeavesPrivateCollectionsOut(t *testing.T) {
	app := newTestApp(t)

	page, err := Page(app)
	if err != nil {
		t.Fatalf("Page: %v", err)
	}
	body, err := OpenAPI(app)
	if err != nil {
		t.Fatalf("OpenAPI: %v", err)
	}

	// Columns of collections nobody outside the server reads. If one of
	// these turns up, a private collection was added to x-collections.
	for _, private := range []string{"subscription_until", "tokenKey", "emailVisibility"} {
		if strings.Contains(page, private) || strings.Contains(string(body), private) {
			t.Errorf("%q is in the published reference", private)
		}
	}
}

func TestOpenAPICarriesCollectionSchemas(t *testing.T) {
	app := newTestApp(t)

	body, err := OpenAPI(app)
	if err != nil {
		t.Fatalf("OpenAPI: %v", err)
	}

	doc := struct {
		OpenAPI    string `json:"openapi"`
		Components struct {
			Schemas map[string]struct {
				Properties map[string]map[string]any `json:"properties"`
			} `json:"schemas"`
		} `json:"components"`
	}{}
	if err := json.Unmarshal(body, &doc); err != nil {
		t.Fatalf("the document is not JSON: %v", err)
	}
	if !strings.HasPrefix(doc.OpenAPI, "3.1") {
		t.Errorf("openapi = %q, want 3.1.x", doc.OpenAPI)
	}

	fixtures := doc.Components.Schemas["fixtures"].Properties
	if fixtures["home_score"]["type"] != "number" {
		t.Errorf("fixtures.home_score = %v, want a number", fixtures["home_score"])
	}
	if _, ok := fixtures["status"]["enum"]; !ok {
		t.Errorf("fixtures.status = %v, want an enum", fixtures["status"])
	}
	if _, ok := doc.Components.Schemas["Error"]; !ok {
		t.Error("the hand-written Error schema was dropped")
	}
}

func TestInlineEscapesAndLinks(t *testing.T) {
	got := string(inline("see `a<b` at https://whistle.day/mcp. <script>"))
	want := `see <code>a&lt;b</code> at <a href="https://whistle.day/mcp">https://whistle.day/mcp</a>. &lt;script&gt;`
	if got != want {
		t.Errorf("inline =\n  %s\nwant\n  %s", got, want)
	}
}

func TestOpenAPICommandWritesFile(t *testing.T) {
	app := newTestApp(t)

	outPath := filepath.Join(t.TempDir(), "openapi.json")

	rootCmd := &cobra.Command{Use: "pocketbase"}
	RegisterCommand(app, rootCmd)

	rootCmd.SetArgs([]string{"openapi", outPath})
	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("command execution failed: %v", err)
	}

	raw, err := os.ReadFile(outPath)
	if err != nil {
		t.Fatalf("reading generated file: %v", err)
	}

	var doc struct {
		OpenAPI    string `json:"openapi"`
		Components struct {
			Schemas map[string]any `json:"schemas"`
		} `json:"components"`
		Paths map[string]any `json:"paths"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("unmarshal generated openapi: %v", err)
	}

	if !strings.HasPrefix(doc.OpenAPI, "3.1") {
		t.Errorf("openapi version = %q, want 3.1.x", doc.OpenAPI)
	}
	if len(doc.Paths) == 0 {
		t.Errorf("generated doc has no paths")
	}
	for _, c := range spec.Collections {
		if _, ok := doc.Components.Schemas[c.Name]; !ok {
			t.Errorf("missing schema for collection %q", c.Name)
		}
	}
}
