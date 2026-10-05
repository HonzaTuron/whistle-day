// Package apidocs serves the API reference from the API itself.
//
// There is one source: openapi.json, embedded in the binary. `/api/openapi.json`
// hands it out for tools, and `/api/docs` is the same document rendered as a
// page for people, so the two cannot disagree about what an endpoint does.
//
// The prose is written by hand and the field lists are not. Which columns a
// collection has is read from the running schema on every request, because a
// migration that adds one should not also have to remember this file. The
// collections that appear at all are the ones named under `x-collections` in
// the spec; nothing else in the database is described here, whatever it holds.
package apidocs

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"regexp"
	"sort"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

const (
	// DocsPath is the reference as a page.
	DocsPath = "/api/docs"
	// SpecPath is the same reference as an OpenAPI 3.1 document.
	SpecPath = "/api/openapi.json"

	// Long enough that a crawler does not render it on every hit, short
	// enough that a deploy shows up before anybody wonders where it went.
	cacheControl = "public, max-age=300"
)

//go:embed openapi.json
var specJSON []byte

//go:embed docs.html
var pageSource string

var (
	spec         = mustParse(specJSON)
	pageTemplate = template.Must(template.New("docs").Parse(pageSource))
)

// RegisterRoutes adds the reference page and the OpenAPI document.
func RegisterRoutes(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET(DocsPath, func(e *core.RequestEvent) error {
			page, err := Page(e.App)
			if err != nil {
				return e.InternalServerError("could not render the API reference", err)
			}
			e.Response.Header().Set("Cache-Control", cacheControl)
			return e.HTML(http.StatusOK, page)
		})

		se.Router.GET(SpecPath, func(e *core.RequestEvent) error {
			body, err := OpenAPI(e.App)
			if err != nil {
				return e.InternalServerError("could not build the OpenAPI document", err)
			}
			e.Response.Header().Set("Cache-Control", cacheControl)
			return e.Blob(http.StatusOK, "application/json", body)
		})

		return se.Next()
	})
}

// ---------------------------------------------------------------------------
// The spec, as much of it as the page reads
// ---------------------------------------------------------------------------

type document struct {
	Info struct {
		Title       string `json:"title"`
		Summary     string `json:"summary"`
		Description string `json:"description"`
	} `json:"info"`
	Servers []struct {
		URL string `json:"url"`
	} `json:"servers"`
	Tags []struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	} `json:"tags"`
	Components struct {
		Schemas map[string]struct {
			Example json.RawMessage `json:"example"`
		} `json:"schemas"`
	} `json:"components"`
	RawPaths    json.RawMessage `json:"paths"`
	Collections []collection    `json:"x-collections"`

	// Paths in the order the file lists them, which is the order they are
	// worth reading in. A map would hand them back shuffled.
	paths []pathItem
}

type pathItem struct {
	path       string
	operations map[string]operation
}

type operation struct {
	Tags        []string              `json:"tags"`
	Summary     string                `json:"summary"`
	Description string                `json:"description"`
	Security    []map[string][]string `json:"security"`
	Parameters  []struct {
		Name        string `json:"name"`
		In          string `json:"in"`
		Required    bool   `json:"required"`
		Description string `json:"description"`
	} `json:"parameters"`
	RequestBody *struct {
		Content map[string]media `json:"content"`
	} `json:"requestBody"`
	Responses map[string]struct {
		Description string           `json:"description"`
		Content     map[string]media `json:"content"`
	} `json:"responses"`
}

type media struct {
	Example json.RawMessage `json:"example"`
}

// collection is one row of `x-collections`: the sentences about a collection
// that its schema cannot say about itself.
type collection struct {
	Name  string `json:"name"`
	About string `json:"about"`
	Read  string `json:"read"`
	Write string `json:"write"`
}

// The order operations on one path are listed in.
var methods = []string{"get", "post", "patch", "put", "delete"}

func mustParse(raw []byte) *document {
	doc := &document{}
	if err := json.Unmarshal(raw, doc); err != nil {
		panic(fmt.Errorf("apidocs: openapi.json does not parse: %w", err))
	}

	byPath := map[string]map[string]operation{}
	if err := json.Unmarshal(doc.RawPaths, &byPath); err != nil {
		panic(fmt.Errorf("apidocs: paths do not parse: %w", err))
	}
	keys, err := keysInOrder(doc.RawPaths)
	if err != nil {
		panic(fmt.Errorf("apidocs: paths do not parse: %w", err))
	}
	for _, key := range keys {
		doc.paths = append(doc.paths, pathItem{path: key, operations: byPath[key]})
	}
	return doc
}

// keysInOrder reads the keys of a JSON object in the order they were written.
func keysInOrder(object json.RawMessage) ([]string, error) {
	dec := json.NewDecoder(bytes.NewReader(object))
	if _, err := dec.Token(); err != nil {
		return nil, err
	}
	var keys []string
	for dec.More() {
		token, err := dec.Token()
		if err != nil {
			return nil, err
		}
		key, ok := token.(string)
		if !ok {
			return nil, fmt.Errorf("expected a key, got %v", token)
		}
		keys = append(keys, key)

		var skipped json.RawMessage
		if err := dec.Decode(&skipped); err != nil {
			return nil, err
		}
	}
	return keys, nil
}

// ---------------------------------------------------------------------------
// Collections, read from the running schema
// ---------------------------------------------------------------------------

// field is one column of a documented collection.
type field struct {
	Name string
	// PocketBase's own name for the type: text, number, select, relation, …
	Type string
	// What a select accepts.
	Values []string
	// The collection a relation points at.
	Target string
	// More than one value: a multi-select, or a relation to several records.
	Many bool
}

// Kind is the type as a person would say it.
func (f field) Kind() string {
	kind := f.Type
	switch {
	case f.Target != "":
		kind = "relation to " + f.Target
	case len(f.Values) > 0:
		kind = strings.Join(f.Values, " | ")
	}
	if f.Many {
		return "list of " + kind
	}
	return kind
}

// schema is the field as JSON Schema.
func (f field) schema() map[string]any {
	one := map[string]any{}
	switch f.Type {
	case "number":
		one["type"] = "number"
	case "bool":
		one["type"] = "boolean"
	case "json":
		// Anything: an object for most of them, and not ours to narrow.
	default:
		one["type"] = "string"
	}
	if len(f.Values) > 0 {
		one["enum"] = f.Values
	}
	if f.Target != "" {
		one["description"] = "The id of a record in `" + f.Target + "`."
	}
	if f.Many {
		return map[string]any{"type": "array", "items": one}
	}
	return one
}

// fieldsOf lists what a collection's records carry.
//
// A hidden field is left out for the reason it is hidden: the API never
// returns it. A collection that does not exist yields nothing rather than an
// error, so a spec that runs ahead of a migration still renders.
func fieldsOf(app core.App, name string) []field {
	col, err := app.FindCachedCollectionByNameOrId(name)
	if err != nil {
		return nil
	}

	var fields []field
	for _, f := range col.Fields {
		if f.GetHidden() {
			continue
		}
		described := field{Name: f.GetName(), Type: f.Type()}
		switch typed := f.(type) {
		case *core.SelectField:
			described.Values = typed.Values
			described.Many = typed.MaxSelect > 1
		case *core.RelationField:
			described.Many = typed.MaxSelect > 1
			if target, err := app.FindCachedCollectionByNameOrId(typed.CollectionId); err == nil {
				described.Target = target.Name
			}
		case *core.FileField:
			described.Many = typed.MaxSelect > 1
		}
		fields = append(fields, described)
	}
	return fields
}

// ---------------------------------------------------------------------------
// The OpenAPI document
// ---------------------------------------------------------------------------

// OpenAPI is the embedded spec with a schema added for every documented
// collection, built from the fields the collection has right now.
func OpenAPI(app core.App) ([]byte, error) {
	doc := map[string]any{}
	if err := json.Unmarshal(specJSON, &doc); err != nil {
		return nil, err
	}

	components, _ := doc["components"].(map[string]any)
	if components == nil {
		components = map[string]any{}
		doc["components"] = components
	}
	schemas, _ := components["schemas"].(map[string]any)
	if schemas == nil {
		schemas = map[string]any{}
		components["schemas"] = schemas
	}

	for _, c := range spec.Collections {
		properties := map[string]any{}
		for _, f := range fieldsOf(app, c.Name) {
			properties[f.Name] = f.schema()
		}
		schemas[c.Name] = map[string]any{
			"type":        "object",
			"description": c.About,
			"properties":  properties,
		}
	}

	return json.MarshalIndent(doc, "", "  ")
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

type pageData struct {
	Title        string
	Summary      string
	Intro        template.HTML
	Server       string
	SpecPath     string
	ErrorExample string
	Sections     []sectionData
	Collections  []collectionData
}

type sectionData struct {
	Name   string
	Anchor string
	About  template.HTML
	Ops    []opData
}

type opData struct {
	Method    string
	Path      string
	Anchor    string
	Summary   string
	About     template.HTML
	Auth      bool
	Params    []paramData
	Request   string
	Responses []responseData
}

type paramData struct {
	Name     string
	In       string
	Required bool
	About    template.HTML
}

type responseData struct {
	Status  string
	About   template.HTML
	Example string
}

type collectionData struct {
	Name   string
	About  template.HTML
	Read   template.HTML
	Write  template.HTML
	Fields []field
}

// Page renders the reference.
func Page(app core.App) (string, error) {
	data := pageData{
		Title:    spec.Info.Title,
		Summary:  spec.Info.Summary,
		Intro:    paragraphs(spec.Info.Description),
		SpecPath: SpecPath,
	}
	if len(spec.Servers) > 0 {
		data.Server = spec.Servers[0].URL
	}
	if e, ok := spec.Components.Schemas["Error"]; ok {
		data.ErrorExample = pretty(e.Example)
	}

	for _, tag := range spec.Tags {
		section := sectionData{
			Name:   tag.Name,
			Anchor: slug(tag.Name),
			About:  paragraphs(tag.Description),
		}
		for _, item := range spec.paths {
			for _, method := range methods {
				op, ok := item.operations[method]
				if !ok || len(op.Tags) == 0 || op.Tags[0] != tag.Name {
					continue
				}
				section.Ops = append(section.Ops, describe(method, item.path, op))
			}
		}
		data.Sections = append(data.Sections, section)
	}

	for _, c := range spec.Collections {
		data.Collections = append(data.Collections, collectionData{
			Name:   c.Name,
			About:  inline(c.About),
			Read:   inline(c.Read),
			Write:  inline(c.Write),
			Fields: fieldsOf(app, c.Name),
		})
	}

	var out bytes.Buffer
	if err := pageTemplate.Execute(&out, data); err != nil {
		return "", err
	}
	return out.String(), nil
}

func describe(method, path string, op operation) opData {
	described := opData{
		Method:  strings.ToUpper(method),
		Path:    path,
		Anchor:  slug(method + " " + path),
		Summary: op.Summary,
		About:   paragraphs(op.Description),
		Auth:    len(op.Security) > 0,
	}

	for _, p := range op.Parameters {
		described.Params = append(described.Params, paramData{
			Name:     p.Name,
			In:       p.In,
			Required: p.Required,
			About:    inline(p.Description),
		})
	}

	if op.RequestBody != nil {
		described.Request = pretty(op.RequestBody.Content["application/json"].Example)
	}

	// Statuses sort as strings, which for three digits is numeric order.
	statuses := make([]string, 0, len(op.Responses))
	for status := range op.Responses {
		statuses = append(statuses, status)
	}
	sort.Strings(statuses)
	for _, status := range statuses {
		r := op.Responses[status]
		described.Responses = append(described.Responses, responseData{
			Status:  status,
			About:   inline(r.Description),
			Example: pretty(r.Content["application/json"].Example),
		})
	}
	return described
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

var (
	codeSpan = regexp.MustCompile("`([^`]+)`")
	bareURL  = regexp.MustCompile(`https://[\w./-]*\w`)
	nonSlug  = regexp.MustCompile(`[^a-z0-9]+`)
)

// inline turns the two things the spec's prose uses, `code` and bare links,
// into markup. Everything else is escaped: the descriptions are plain text
// that happens to be readable as markdown, not markdown.
func inline(text string) template.HTML {
	escaped := template.HTMLEscapeString(text)
	// Code first, and links only outside it: an address inside backticks is
	// an example, not somewhere to go.
	parts := codeSpan.Split(escaped, -1)
	spans := codeSpan.FindAllStringSubmatch(escaped, -1)

	var b strings.Builder
	for i, part := range parts {
		b.WriteString(bareURL.ReplaceAllString(part, `<a href="$0">$0</a>`))
		if i < len(spans) {
			b.WriteString("<code>" + spans[i][1] + "</code>")
		}
	}
	return template.HTML(b.String())
}

func paragraphs(text string) template.HTML {
	var b strings.Builder
	for _, paragraph := range strings.Split(text, "\n\n") {
		if strings.TrimSpace(paragraph) == "" {
			continue
		}
		b.WriteString("<p>")
		b.WriteString(string(inline(paragraph)))
		b.WriteString("</p>")
	}
	return template.HTML(b.String())
}

func pretty(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var out bytes.Buffer
	if err := json.Indent(&out, raw, "", "  "); err != nil {
		return string(raw)
	}
	return out.String()
}

func slug(text string) string {
	return strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(text), "-"), "-")
}
