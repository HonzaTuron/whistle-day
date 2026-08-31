package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"seedly/backend/internal/tournament"
)

type SeedlyMCP struct {
	app core.App
	mcp *server.MCPServer
	sse *server.SSEServer
}

func New(app core.App) *SeedlyMCP {
	s := &SeedlyMCP{app: app}

	s.mcp = server.NewMCPServer(
		"Seedly",
		"1.0.0",
		server.WithToolCapabilities(true),
		server.WithResourceCapabilities(true, true),
		server.WithLogging(),
	)

	s.registerTools()
	s.registerResources()

	s.sse = server.NewSSEServer(s.mcp,
		server.WithSSEEndpoint("/api/mcp/sse"),
		server.WithMessageEndpoint("/api/mcp/message"),
		server.WithKeepAlive(true),
	)

	return s
}

func (s *SeedlyMCP) SSEHandler() http.Handler {
	return s.sse.SSEHandler()
}

func (s *SeedlyMCP) MessageHandler() http.Handler {
	return s.sse.MessageHandler()
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

func (s *SeedlyMCP) registerTools() {
	s.mcp.AddTool(listTournamentsTool(), s.listTournaments)
	s.mcp.AddTool(getTournamentTool(), s.getTournament)
	s.mcp.AddTool(createTournamentTool(), s.createTournament)
	s.mcp.AddTool(addEntryTool(), s.addEntry)
	s.mcp.AddTool(createStageTool(), s.createStage)
	s.mcp.AddTool(publishTournamentTool(), s.publishTournament)
	s.mcp.AddTool(createDisplayTool(), s.createDisplay)
	s.mcp.AddTool(listStagesTool(), s.listStages)
	s.mcp.AddTool(getStageTool(), s.getStage)
	s.mcp.AddTool(listPoolsTool(), s.listPools)
	s.mcp.AddTool(listFixturesTool(), s.listFixtures)
	s.mcp.AddTool(getFixtureTool(), s.getFixture)
	s.mcp.AddTool(listEntriesTool(), s.listEntries)
	s.mcp.AddTool(listStandingsTool(), s.listStandings)
	s.mcp.AddTool(getStageTableTool(), s.getStageTable)
	s.mcp.AddTool(updateFixtureTool(), s.updateFixture)
	s.mcp.AddTool(generateStageTool(), s.generateStage)
	s.mcp.AddTool(resolveStageTool(), s.resolveStage)
}

func listTournamentsTool() mcp.Tool {
	return mcp.NewTool("list_tournaments",
		mcp.WithDescription("List all tournaments the caller has access to"),
	)
}

func (s *SeedlyMCP) listTournaments(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	records, err := s.app.FindRecordsByFilter("tournaments", "", "created", 0, 0, nil)
	if err != nil {
		return nil, fmt.Errorf("list tournaments: %w", err)
	}
	return resultJSON(toMapSlice(records, "id", "name", "sport", "location", "status", "created"))
}

func getTournamentTool() mcp.Tool {
	return mcp.NewTool("get_tournament",
		mcp.WithDescription("Get a tournament by ID"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tournament ID")),
	)
}

func (s *SeedlyMCP) getTournament(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	id := req.GetArguments()["id"].(string)
	r, err := s.app.FindRecordById("tournaments", id)
	if err != nil {
		return nil, fmt.Errorf("tournament not found: %w", err)
	}
	return resultJSON(recordToMap(r,
		"id", "name", "sport", "location", "status",
		"scoring", "description", "created", "updated",
	))
}

func listStagesTool() mcp.Tool {
	return mcp.NewTool("list_stages",
		mcp.WithDescription("List stages in a tournament"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
	)
}

func (s *SeedlyMCP) listStages(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := req.GetArguments()["tournament_id"].(string)
	records, err := s.app.FindRecordsByFilter(
		"stages", "tournament = {:t}", "position", 0, 0,
		dbx.Params{"t": tid},
	)
	if err != nil {
		return nil, fmt.Errorf("list stages: %w", err)
	}
	return resultJSON(toMapSlice(records, "id", "name", "format", "status", "position", "config"))
}

func getStageTool() mcp.Tool {
	return mcp.NewTool("get_stage",
		mcp.WithDescription("Get a stage by ID with its pools"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Stage ID")),
	)
}

func (s *SeedlyMCP) getStage(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	id := req.GetArguments()["id"].(string)
	r, err := s.app.FindRecordById("stages", id)
	if err != nil {
		return nil, fmt.Errorf("stage not found: %w", err)
	}
	return resultJSON(recordToMap(r,
		"id", "name", "format", "status", "position", "config",
		"tournament", "created", "updated",
	))
}

func listPoolsTool() mcp.Tool {
	return mcp.NewTool("list_pools",
		mcp.WithDescription("List pools in a stage"),
		mcp.WithString("stage_id", mcp.Required(), mcp.Description("Stage ID")),
	)
}

func (s *SeedlyMCP) listPools(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	sid := req.GetArguments()["stage_id"].(string)
	records, err := s.app.FindRecordsByFilter(
		"pools", "stage = {:s}", "position", 0, 0,
		dbx.Params{"s": sid},
	)
	if err != nil {
		return nil, fmt.Errorf("list pools: %w", err)
	}
	return resultJSON(toMapSlice(records, "id", "name", "kind", "position", "advance_count"))
}

func listFixturesTool() mcp.Tool {
	return mcp.NewTool("list_fixtures",
		mcp.WithDescription("List fixtures in a stage, optionally filtered by pool, round, or status"),
		mcp.WithString("stage_id", mcp.Required(), mcp.Description("Stage ID")),
		mcp.WithString("pool_id", mcp.Description("Pool ID (optional)")),
		mcp.WithNumber("round", mcp.Description("Round number (optional)")),
		mcp.WithString("status", mcp.Description("Status filter: pending, ready, live, finished, walkover, bye (optional)")),
	)
}

func (s *SeedlyMCP) listFixtures(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	sid := req.GetArguments()["stage_id"].(string)

	filter := "stage = {:stage}"
	params := dbx.Params{"stage": sid}

	if pid, ok := req.GetArguments()["pool_id"].(string); ok && pid != "" {
		filter += " && pool = {:pool}"
		params["pool"] = pid
	}
	if round, ok := req.GetArguments()["round"].(float64); ok {
		filter += fmt.Sprintf(" && round = %d", int(round))
	}
	if status, ok := req.GetArguments()["status"].(string); ok && status != "" {
		filter += " && status = {:status}"
		params["status"] = status
	}

	records, err := s.app.FindRecordsByFilter("fixtures", filter, "round, position", 0, 0, params)
	if err != nil {
		return nil, fmt.Errorf("list fixtures: %w", err)
	}

	return resultJSON(toMapSlice(records,
		"id", "code", "status", "round", "position",
		"home_entry", "away_entry", "home_score", "away_score",
		"winner", "court", "stage", "pool",
	))
}

func getFixtureTool() mcp.Tool {
	return mcp.NewTool("get_fixture",
		mcp.WithDescription("Get a fixture by ID with games"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Fixture ID")),
	)
}

func (s *SeedlyMCP) getFixture(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	id := req.GetArguments()["id"].(string)
	r, err := s.app.FindRecordById("fixtures", id)
	if err != nil {
		return nil, fmt.Errorf("fixture not found: %w", err)
	}

	games, err := s.app.FindRecordsByFilter(
		"games", "fixture = {:f}", "number", 0, 0,
		dbx.Params{"f": id},
	)
	if err != nil {
		return nil, fmt.Errorf("get games: %w", err)
	}

	gameList := make([]map[string]any, 0, len(games))
	for _, g := range games {
		gameList = append(gameList, recordToMap(g, "id", "number", "home_score", "away_score"))
	}

	data := recordToMap(r,
		"id", "code", "status", "round", "position",
		"home_entry", "away_entry", "home_score", "away_score",
		"winner", "loser", "court", "scheduled_at",
		"stage", "pool", "home_slot", "away_slot",
	)
	data["games"] = gameList
	return resultJSON(data)
}

func listEntriesTool() mcp.Tool {
	return mcp.NewTool("list_entries",
		mcp.WithDescription("List entries (participants) in a tournament"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
	)
}

func (s *SeedlyMCP) listEntries(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := req.GetArguments()["tournament_id"].(string)
	records, err := s.app.FindRecordsByFilter(
		"entries", "tournament = {:t}", "seed", 0, 0,
		dbx.Params{"t": tid},
	)
	if err != nil {
		return nil, fmt.Errorf("list entries: %w", err)
	}
	return resultJSON(toMapSlice(records, "id", "name", "short_name", "club", "seed", "status"))
}

func listStandingsTool() mcp.Tool {
	return mcp.NewTool("list_standings",
		mcp.WithDescription("List standings for a pool"),
		mcp.WithString("pool_id", mcp.Required(), mcp.Description("Pool ID")),
	)
}

func (s *SeedlyMCP) listStandings(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	pid := req.GetArguments()["pool_id"].(string)
	records, err := s.app.FindRecordsByFilter(
		"standings", "pool = {:p}", "position", 0, 0,
		dbx.Params{"p": pid},
	)
	if err != nil {
		return nil, fmt.Errorf("list standings: %w", err)
	}
	return resultJSON(toMapSlice(records,
		"id", "position", "entry", "played", "won", "drawn", "lost",
		"score_for", "score_against", "points", "qualified",
	))
}

func getStageTableTool() mcp.Tool {
	return mcp.NewTool("get_stage_table",
		mcp.WithDescription(
			"Get a stage's cross-pool table: every pool's first place, then every "+
				"second, then every third, ranked within each of those tiers. This is "+
				"what \"the best third-placed teams\" is decided on, and what a "+
				"stage_rank slot reads. Provisional until every pool in the stage has "+
				"finished — readable throughout, but nothing is seeded from it until then.",
		),
		mcp.WithString("stage_id", mcp.Required(), mcp.Description("Stage ID")),
	)
}

func (s *SeedlyMCP) getStageTable(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	sid := req.GetArguments()["stage_id"].(string)
	records, err := tournament.StageTable(s.app, sid)
	if err != nil {
		return nil, fmt.Errorf("get stage table: %w", err)
	}
	return resultJSON(toMapSlice(records,
		"id", "position", "entry", "played", "won", "drawn", "lost",
		"score_for", "score_against", "points",
	))
}

func updateFixtureTool() mcp.Tool {
	return mcp.NewTool("update_fixture",
		mcp.WithDescription("Update a fixture's score and status (settle a match)"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Fixture ID")),
		mcp.WithString("status", mcp.Required(), mcp.Description("New status: finished, walkover, live, ready, pending")),
		mcp.WithNumber("home_score", mcp.Description("Home score")),
		mcp.WithNumber("away_score", mcp.Description("Away score")),
		mcp.WithString("winner", mcp.Description("Winner entry ID (for walkover)")),
		mcp.WithString("court", mcp.Description("Court ID (optional)")),
	)
}

func (s *SeedlyMCP) updateFixture(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	id := req.GetArguments()["id"].(string)

	r, err := s.app.FindRecordById("fixtures", id)
	if err != nil {
		return nil, fmt.Errorf("fixture not found: %w", err)
	}

	status := req.GetArguments()["status"].(string)
	r.Set("status", status)

	if hs, ok := req.GetArguments()["home_score"].(float64); ok {
		r.Set("home_score", int(hs))
	}
	if as, ok := req.GetArguments()["away_score"].(float64); ok {
		r.Set("away_score", int(as))
	}
	if winner, ok := req.GetArguments()["winner"].(string); ok && winner != "" {
		r.Set("winner", winner)
	}
	if court, ok := req.GetArguments()["court"].(string); ok {
		r.Set("court", court)
	}

	if err := s.app.Save(r); err != nil {
		return nil, fmt.Errorf("save fixture: %w", err)
	}

	return resultJSON(recordToMap(r,
		"id", "code", "status", "home_score", "away_score", "winner",
	))
}

func generateStageTool() mcp.Tool {
	return mcp.NewTool("generate_stage",
		mcp.WithDescription("Generate pools, slots and fixtures for a stage. Use dry_run=true to preview without saving."),
		mcp.WithString("stage_id", mcp.Required(), mcp.Description("Stage ID")),
		mcp.WithBoolean("dry_run", mcp.Description("Preview only, don't write anything")),
	)
}

func (s *SeedlyMCP) generateStage(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	sid := req.GetArguments()["stage_id"].(string)
	dryRun, _ := req.GetArguments()["dry_run"].(bool)

	stage, err := s.app.FindRecordById("stages", sid)
	if err != nil {
		return nil, fmt.Errorf("stage not found: %w", err)
	}

	plan, err := tournament.PlanStage(s.app, stage)
	if err != nil {
		return nil, fmt.Errorf("plan stage: %w", err)
	}

	if dryRun {
		return resultJSON(map[string]any{
			"stage":   stage.Id,
			"dry_run": true,
			"plan":    plan,
		})
	}

	if err := tournament.CommitPlan(s.app, stage, plan); err != nil {
		return nil, fmt.Errorf("commit plan: %w", err)
	}

	tournament.ResolveStage(s.app, stage.Id)

	return resultJSON(map[string]any{
		"stage":    stage.Id,
		"pools":    len(plan.Pools),
		"slots":    len(plan.Slots),
		"fixtures": len(plan.Fixtures),
	})
}

func resolveStageTool() mcp.Tool {
	return mcp.NewTool("resolve_stage",
		mcp.WithDescription("Re-resolve a stage's fixture propagation and standings. Use after correcting scores."),
		mcp.WithString("stage_id", mcp.Required(), mcp.Description("Stage ID")),
	)
}

func (s *SeedlyMCP) resolveStage(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	sid := req.GetArguments()["stage_id"].(string)
	resolved, err := tournament.ResolveStage(s.app, sid)
	if err != nil {
		return nil, fmt.Errorf("resolve stage: %w", err)
	}
	return resultJSON(map[string]any{
		"stage":    sid,
		"resolved": resolved,
	})
}

func createTournamentTool() mcp.Tool {
	return mcp.NewTool("create_tournament",
		mcp.WithDescription("Create a new tournament draft. Owner is set to the internal system account."),
		mcp.WithString("name", mcp.Required(), mcp.Description("Tournament name")),
	)
}

func slugify(name string) string {
	base := strings.ToLower(name)
	base = strings.ReplaceAll(base, " ", "-")
	base = strings.ReplaceAll(base, "ě", "e")
	base = strings.ReplaceAll(base, "š", "s")
	base = strings.ReplaceAll(base, "č", "c")
	base = strings.ReplaceAll(base, "ř", "r")
	base = strings.ReplaceAll(base, "ž", "z")
	base = strings.ReplaceAll(base, "ý", "y")
	base = strings.ReplaceAll(base, "á", "a")
	base = strings.ReplaceAll(base, "í", "i")
	base = strings.ReplaceAll(base, "é", "e")
	base = strings.ReplaceAll(base, "ú", "u")
	base = strings.ReplaceAll(base, "ů", "u")
	base = strings.ReplaceAll(base, "ó", "o")
	base = strings.ReplaceAll(base, "ť", "t")
	base = strings.ReplaceAll(base, "ď", "d")
	base = strings.ReplaceAll(base, "ň", "n")
	re := regexp.MustCompile(`[^a-z0-9-]+`)
	base = re.ReplaceAllString(base, "-")
	base = strings.Trim(base, "-")
	if len(base) > 40 {
		base = base[:40]
	}
	rand := fmt.Sprintf("%05d", time.Now().UnixNano()%100000)
	return base + "-" + rand
}

func (s *SeedlyMCP) createTournament(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	name := req.GetArguments()["name"].(string)

	owner, err := s.ensureSystemUser()
	if err != nil {
		return nil, fmt.Errorf("system user: %w", err)
	}

	col, err := s.app.FindCollectionByNameOrId("tournaments")
	if err != nil {
		return nil, fmt.Errorf("find collection: %w", err)
	}

	r := core.NewRecord(col)
	r.Set("name", name)
	r.Set("slug", slugify(name))
	r.Set("status", "draft")
	r.Set("owner", owner.Id)
	r.Set("scoring", map[string]any{
		"bestOf":      1,
		"pointsWin":   3,
		"pointsDraw":  1,
		"pointsLoss":  0,
		"tiebreakers": []string{"points", "head_to_head", "score_diff", "score_for", "seed"},
	})

	if err := s.app.Save(r); err != nil {
		return nil, fmt.Errorf("create tournament: %w", err)
	}

	return resultJSON(recordToMap(r, "id", "name", "status", "created"))
}

func (s *SeedlyMCP) ensureSystemUser() (*core.Record, error) {
	users, err := s.app.FindRecordsByFilter("users", "email = {:email}", "", 1, 0,
		dbx.Params{"email": "mcp@seedly.local"})
	if err != nil {
		return nil, err
	}
	if len(users) > 0 {
		return users[0], nil
	}

	col, err := s.app.FindCollectionByNameOrId("users")
	if err != nil {
		return nil, err
	}
	r := core.NewRecord(col)
	r.Set("email", "mcp@seedly.local")
	r.Set("password", "mcp-system-account-2026")
	r.Set("passwordConfirm", "mcp-system-account-2026")
	r.Set("name", "MCP System")
	if err := s.app.Save(r); err != nil {
		return nil, err
	}
	return r, nil
}

func addEntryTool() mcp.Tool {
	return mcp.NewTool("add_entry",
		mcp.WithDescription("Add a team/participant to a tournament"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Team name")),
		mcp.WithNumber("seed", mcp.Required(), mcp.Description("Seed (position)")),
	)
}

func (s *SeedlyMCP) addEntry(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := req.GetArguments()["tournament_id"].(string)
	name := req.GetArguments()["name"].(string)
	seed := int(req.GetArguments()["seed"].(float64))

	col, err := s.app.FindCollectionByNameOrId("entries")
	if err != nil {
		return nil, fmt.Errorf("find collection: %w", err)
	}

	r := core.NewRecord(col)
	r.Set("tournament", tid)
	r.Set("name", name)
	r.Set("seed", seed)
	r.Set("status", "active")

	if err := s.app.Save(r); err != nil {
		return nil, fmt.Errorf("add entry: %w", err)
	}

	return resultJSON(recordToMap(r, "id", "name", "seed", "status"))
}

func createStageTool() mcp.Tool {
	return mcp.NewTool("create_stage",
		mcp.WithDescription("Create a stage in a tournament (e.g. round_robin group)"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Stage name, e.g. 'Group' or 'Playoff'")),
		mcp.WithString("format", mcp.Required(), mcp.Description("Format: round_robin, single_elim, double_elim, swiss")),
		mcp.WithNumber("position", mcp.Required(), mcp.Description("Stage position (0-based)")),
		mcp.WithString("config", mcp.Description("JSON config, e.g. {\"poolCount\":1}")),
	)
}

func (s *SeedlyMCP) createStage(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := req.GetArguments()["tournament_id"].(string)
	name := req.GetArguments()["name"].(string)
	format := req.GetArguments()["format"].(string)
	position := int(req.GetArguments()["position"].(float64))

	var config any
	if raw, ok := req.GetArguments()["config"].(string); ok && raw != "" {
		if err := json.Unmarshal([]byte(raw), &config); err != nil {
			return nil, fmt.Errorf("invalid config JSON: %w", err)
		}
	}

	col, err := s.app.FindCollectionByNameOrId("stages")
	if err != nil {
		return nil, fmt.Errorf("find collection: %w", err)
	}

	r := core.NewRecord(col)
	r.Set("tournament", tid)
	r.Set("name", name)
	r.Set("format", format)
	r.Set("position", position)
	r.Set("status", "draft")
	if config != nil {
		r.Set("config", config)
	}

	if err := s.app.Save(r); err != nil {
		return nil, fmt.Errorf("create stage: %w", err)
	}

	return resultJSON(recordToMap(r, "id", "name", "format", "position", "status", "config"))
}

func createDisplayTool() mcp.Tool {
	return mcp.NewTool("create_display",
		mcp.WithDescription("Create a projector display screen for a published tournament"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		mcp.WithString("name", mcp.Description("Display name (default: Main screen)")),
		mcp.WithString("token", mcp.Description("URL token (default: auto-generated)")),
	)
}

func (s *SeedlyMCP) createDisplay(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := req.GetArguments()["tournament_id"].(string)
	name := "Main screen"
	if n, ok := req.GetArguments()["name"].(string); ok && n != "" {
		name = n
	}
	token := ""
	if t, ok := req.GetArguments()["token"].(string); ok && t != "" {
		token = t
	} else {
		const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"
		b := make([]byte, 8)
		for i := range b {
			b[i] = alphabet[time.Now().UnixNano()%int64(len(alphabet))]
		}
		token = string(b)
	}

	col, err := s.app.FindCollectionByNameOrId("displays")
	if err != nil {
		return nil, fmt.Errorf("find collection: %w", err)
	}

	r := core.NewRecord(col)
	r.Set("tournament", tid)
	r.Set("name", name)
	r.Set("token", token)
	r.Set("mode", "auto")
	r.Set("rotate_seconds", 12)
	r.Set("active", true)

	if err := s.app.Save(r); err != nil {
		return nil, fmt.Errorf("create display: %w", err)
	}

	return resultJSON(map[string]any{
		"id":            r.Id,
		"name":          name,
		"token":         token,
		"display_url":   fmt.Sprintf("http://127.0.0.1:8090/api/display/%s", token),
		"projector_url": fmt.Sprintf("http://127.0.0.1:8090/display/%s", token),
	})
}

func publishTournamentTool() mcp.Tool {
	return mcp.NewTool("publish_tournament",
		mcp.WithDescription("Publish a tournament (set status to live) so the display works"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
	)
}

func (s *SeedlyMCP) publishTournament(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := req.GetArguments()["tournament_id"].(string)

	r, err := s.app.FindRecordById("tournaments", tid)
	if err != nil {
		return nil, fmt.Errorf("tournament not found: %w", err)
	}

	r.Set("status", "live")
	if err := s.app.Save(r); err != nil {
		return nil, fmt.Errorf("publish tournament: %w", err)
	}

	return resultJSON(recordToMap(r, "id", "name", "status"))
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

func (s *SeedlyMCP) registerResources() {
	s.mcp.AddResource(
		mcp.NewResource("tournaments://overview", "Tournaments Overview",
			mcp.WithResourceDescription("Overview of all tournaments"),
			mcp.WithMIMEType("application/json"),
		),
		func(ctx context.Context, req mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
			records, err := s.app.FindRecordsByFilter("tournaments", "", "created", 0, 0, nil)
			if err != nil {
				return nil, err
			}
			data := toMapSlice(records, "id", "name", "sport", "status")
			raw, _ := json.Marshal(data)
			return []mcp.ResourceContents{
				mcp.TextResourceContents{URI: "tournaments://overview", Text: string(raw)},
			}, nil
		},
	)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func recordToMap(r *core.Record, fields ...string) map[string]any {
	m := map[string]any{}
	for _, f := range fields {
		m[f] = fieldValue(r, f)
	}
	return m
}

func toMapSlice(records []*core.Record, fields ...string) []map[string]any {
	out := make([]map[string]any, 0, len(records))
	for _, r := range records {
		out = append(out, recordToMap(r, fields...))
	}
	return out
}

func fieldValue(r *core.Record, field string) any {
	switch field {
	case "id":
		return r.Id
	case "created":
		return r.GetString("created")
	case "updated":
		return r.GetString("updated")
	default:
		return r.Get(field)
	}
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

func resultJSON(data any) (*mcp.CallToolResult, error) {
	return mcp.NewToolResultJSON(data)
}

func RegisterMCPServer(app core.App) {
	mcpServer := New(app)

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/mcp/sse", func(e *core.RequestEvent) error {
			mcpServer.SSEHandler().ServeHTTP(e.Response, e.Request)
			return nil
		})

		se.Router.POST("/api/mcp/message", func(e *core.RequestEvent) error {
			mcpServer.MessageHandler().ServeHTTP(e.Response, e.Request)
			return nil
		})

		return se.Next()
	})
}
