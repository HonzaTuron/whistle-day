package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"

	"whistleday/backend/internal/tournament"
)

type WhistleMCP struct {
	app  core.App
	mcp  *server.MCPServer
	http *server.StreamableHTTPServer
}

// MCPEndpoint is the whole transport: one address, GET, POST and DELETE.
//
// The HTTP+SSE transport this replaces needed two — a long-lived GET on
// `/api/mcp/sse` that the server wrote replies down, and a POST on
// `/api/mcp/message` that carried the requests. It is deprecated, and the
// split was awkward here for a reason worth keeping in mind: headers arrived
// once, when the stream opened, so anything a client learned afterwards had
// no way onto a later request. Streamable HTTP gives every call its own
// headers.
const MCPEndpoint = "/api/mcp"

func New(app core.App) *WhistleMCP {
	s := &WhistleMCP{app: app}

	s.mcp = server.NewMCPServer(
		// The name an MCP client shows in its list of servers, so it is the
		// product's rather than this package's.
		"Whistle.day",
		"1.0.0",
		server.WithToolCapabilities(true),
		server.WithPromptCapabilities(false),
		server.WithCacheHints(60_000, mcp.CacheScopePublic),
		server.WithLogging(),
	)

	s.registerTools()
	s.registerResources()
	s.registerPrompts()

	s.http = server.NewStreamableHTTPServer(s.mcp,
		server.WithEndpointPath(MCPEndpoint),
		// Lifts X-Whistle-Session and Authorization: Bearer onto the request
		// context, where caller() looks for a credential when a tool call
		// carries no session_token argument of its own, and Mcp-Session-Id,
		// which is what an account made by create_tournament is remembered by.
		server.WithHTTPContextFunc(withCredentials),
		// A long poll through a proxy is a connection something will decide to
		// close; the heartbeat is what stops it being closed as idle.
		server.WithHeartbeatInterval(30*time.Second),
		server.WithDisableLocalhostProtection(behindProxy()),
	)

	return s
}

// Handler serves the endpoint. One handler for every method it answers.
func (s *WhistleMCP) Handler() http.Handler {
	return s.http
}

// behindProxy reports whether something else is terminating requests for us.
//
// mcp-go refuses a request whose connection arrived on loopback while its Host
// header says otherwise, which is DNS rebinding protection: without it a
// malicious page could point its own domain at 127.0.0.1 and drive a local MCP
// server through somebody's browser. That is a real attack and the default is
// right.
//
// It is also exactly what a reverse proxy on the same host looks like. Caddy
// listens on 443, forwards to PocketBase on 127.0.0.1 and preserves
// `Host: whistle.day`, and every MCP request comes back 403. The library
// suggests rewriting Host to localhost at the proxy instead; that would fix
// this and quietly break every absolute URL PocketBase builds from it,
// including the handoff links.
//
// So it is a deliberate switch rather than a guess. Unset, the protection
// stays on, which is what a checkout of this repo and a laptop want.
func behindProxy() bool {
	switch strings.ToLower(os.Getenv("WHISTLEDAY_MCP_BEHIND_PROXY")) {
	case "1", "true", "yes":
		return true
	default:
		return false
	}
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

func (s *WhistleMCP) registerTools() {
	s.add(listTournamentsTool(), reads, s.listTournaments)
	s.add(getTournamentTool(), reads, s.getTournament)
	s.add(createTournamentTool(), adds, s.createTournament)
	s.add(addEntryTool(), adds, s.addEntry)
	s.add(createStageTool(), adds, s.createStage)
	s.add(publishTournamentTool(), publishes, s.publishTournament)
	s.add(createDisplayTool(), publishes, s.createDisplay)
	s.add(listStagesTool(), reads, s.listStages)
	s.add(getStageTool(), reads, s.getStage)
	s.add(listPoolsTool(), reads, s.listPools)
	s.add(listFixturesTool(), reads, s.listFixtures)
	s.add(getFixtureTool(), reads, s.getFixture)
	s.add(listEntriesTool(), reads, s.listEntries)
	s.add(listStandingsTool(), reads, s.listStandings)
	s.add(getStageTableTool(), reads, s.getStageTable)
	s.add(updateFixtureTool(), overwrites, s.updateFixture)
	s.add(generateStageTool(), overwrites, s.generateStage)
	s.add(resolveStageTool(), overwrites, s.resolveStage)
	s.add(createHandoffTool(), overwrites, s.createHandoff)
	s.add(addCourtTool(), adds, s.addCourt)
	s.add(listCourtsTool(), reads, s.listCourts)
}

func addCourtTool() mcp.Tool {
	return mcp.NewTool("add_court",
		mcp.WithDescription(
			"Add a court, pitch or table. Courts are what the schedule puts "+
				"matches on and what the projector groups them by, so a "+
				"tournament with none can be played but not organised: "+
				"update_fixture's court argument has nothing to point at.",
		),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Court name, e.g. 'Court 1'")),
		mcp.WithNumber("position", mcp.Description("Order on the screen, 0-based (default: after the last one)")),
		returnsRecord(courtFields),
	)
}

func (s *WhistleMCP) addCourt(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := argString(req, "tournament_id")
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}

	name := argString(req, "name")
	if name == "" {
		return nil, fmt.Errorf("a court needs a name")
	}

	// Appended by default. An agent adding four courts in a row should not
	// have to count, and four courts all at position 0 is a screen whose
	// order depends on which row was written first.
	position, given := req.GetArguments()["position"].(float64)
	if !given {
		existing, err := s.app.FindRecordsByFilter(
			"courts", "tournament = {:t}", "-position", 1, 0, dbx.Params{"t": tid},
		)
		if err != nil {
			return nil, fmt.Errorf("could not read the courts: %w", err)
		}
		if len(existing) > 0 {
			position = float64(existing[0].GetInt("position") + 1)
		}
	}

	col, err := s.app.FindCollectionByNameOrId("courts")
	if err != nil {
		return nil, fmt.Errorf("find collection: %w", err)
	}

	r := core.NewRecord(col)
	r.Set("tournament", tid)
	r.Set("name", name)
	r.Set("position", int(position))
	r.Set("active", true)

	if err := s.app.Save(r); err != nil {
		return nil, fmt.Errorf("add court: %w", err)
	}

	return resultJSON(recordToMap(r, courtFields...))
}

func listCourtsTool() mcp.Tool {
	return mcp.NewTool("list_courts",
		mcp.WithDescription(
			"The courts a tournament is played on. Their ids are what "+
				"update_fixture's court argument takes.",
		),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		returnsList("courts", courtFields),
	)
}

func (s *WhistleMCP) listCourts(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := argString(req, "tournament_id")
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}

	records, err := s.app.FindRecordsByFilter(
		"courts", "tournament = {:t}", "position", 0, 0, dbx.Params{"t": tid},
	)
	if err != nil {
		return nil, fmt.Errorf("list courts: %w", err)
	}
	return resultList("courts", records, courtFields)
}

func createHandoffTool() mcp.Tool {
	return mcp.NewTool("create_handoff",
		mcp.WithDescription(
			"Make a link that hands this tournament to a person. They open it, "+
				"set an email and a password, and the account this session has "+
				"been acting as becomes theirs. Single use, and it expires. "+
				"Afterwards this connection can no longer change the tournament "+
				"— which is the point, so hand it over when the tournament is "+
				"ready rather than when you are still building it. Only for a "+
				"tournament made without signing in; a signed-in account "+
				"already owns what it creates.",
		),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		returns(objectSchema(map[string]any{
			"url":     str("The link to give to the person taking the tournament over"),
			"expires": str("When the link stops working, UTC"),
			"note":    str("What to tell the person, and what changes once they open it"),
		}, "url", "expires", "note")),
	)
}

func (s *WhistleMCP) createHandoff(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := argString(req, "tournament_id")
	user, err := s.operator(ctx, req, tid)
	if err != nil {
		return nil, err
	}

	record, err := s.app.FindRecordById("tournaments", tid)
	if err != nil {
		return nil, fmt.Errorf("no tournament %s", tid)
	}
	// Owner only, like the route. Being crew on a tournament is not being in a
	// position to give it away.
	if record.GetString("owner") != user.Id {
		return nil, fmt.Errorf("only the owner can hand a tournament over")
	}
	if !tournament.IsDeviceAccount(user.Email()) {
		return nil, fmt.Errorf(
			"this account already belongs to somebody, so there is nothing to claim")
	}

	handoff, err := tournament.MintHandoff(s.app, user, record)
	if err != nil {
		return nil, fmt.Errorf("could not make a handoff link: %w", err)
	}

	return resultJSON(map[string]any{
		"url":     tournament.HandoffURL(s.app, handoff.GetString("token")),
		"expires": handoff.GetString("expires"),
		"note": "Give this link to the person running the tournament. " +
			"Once they open it, this connection can no longer change the tournament.",
	})
}

// argString reads a string argument without trusting the client to have sent
// one. The unchecked assertion this replaces panicked on a missing argument,
// and a panic in a tool handler takes the server down with it.
func argString(req mcp.CallToolRequest, name string) string {
	v, _ := req.GetArguments()[name].(string)
	return v
}

func listTournamentsTool() mcp.Tool {
	return mcp.NewTool("list_tournaments",
		mcp.WithDescription("List the tournaments this session can act on"),
		returnsList("tournaments", tournamentSummaryFields),
	)
}

func (s *WhistleMCP) listTournaments(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	user, err := s.caller(ctx, req)
	if err != nil {
		return nil, err
	}

	// The same expression the collection rule uses: mine, or one I am crew on.
	// It used to return every tournament on the server, which is what made
	// "the caller has access to" in the old description untrue.
	records, err := s.app.FindRecordsByFilter(
		"tournaments",
		"owner = {:u} || staff_via_tournament.user ?= {:u}",
		"created", 0, 0,
		dbx.Params{"u": user.Id},
	)
	if err != nil {
		return nil, fmt.Errorf("list tournaments: %w", err)
	}
	return resultList("tournaments", records, tournamentSummaryFields)
}

func getTournamentTool() mcp.Tool {
	return mcp.NewTool("get_tournament",
		mcp.WithDescription("Get a tournament by ID"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tournament ID")),
		returnsRecord(tournamentFields),
	)
}

func (s *WhistleMCP) getTournament(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	id := argString(req, "id")
	if _, err := s.operator(ctx, req, id); err != nil {
		return nil, err
	}
	r, err := s.app.FindRecordById("tournaments", id)
	if err != nil {
		return nil, fmt.Errorf("tournament not found: %w", err)
	}
	return resultJSON(recordToMap(r, tournamentFields...))
}

func listStagesTool() mcp.Tool {
	return mcp.NewTool("list_stages",
		mcp.WithDescription("List stages in a tournament"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		returnsList("stages", stageSummaryFields),
	)
}

func (s *WhistleMCP) listStages(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := argString(req, "tournament_id")
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}
	records, err := s.app.FindRecordsByFilter(
		"stages", "tournament = {:t}", "position", 0, 0,
		dbx.Params{"t": tid},
	)
	if err != nil {
		return nil, fmt.Errorf("list stages: %w", err)
	}
	return resultList("stages", records, stageSummaryFields)
}

func getStageTool() mcp.Tool {
	return mcp.NewTool("get_stage",
		mcp.WithDescription("Get a stage by ID with its pools"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Stage ID")),
		returnsRecord(stageFields),
	)
}

func (s *WhistleMCP) getStage(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	id := argString(req, "id")
	tid, err := s.tournamentOfStage(id)
	if err != nil {
		return nil, err
	}
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}
	r, err := s.app.FindRecordById("stages", id)
	if err != nil {
		return nil, fmt.Errorf("stage not found: %w", err)
	}
	return resultJSON(recordToMap(r, stageFields...))
}

func listPoolsTool() mcp.Tool {
	return mcp.NewTool("list_pools",
		mcp.WithDescription("List pools in a stage"),
		mcp.WithString("stage_id", mcp.Required(), mcp.Description("Stage ID")),
		returnsList("pools", poolFields),
	)
}

func (s *WhistleMCP) listPools(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	sid := argString(req, "stage_id")
	tid, err := s.tournamentOfStage(sid)
	if err != nil {
		return nil, err
	}
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}
	records, err := s.app.FindRecordsByFilter(
		"pools", "stage = {:s}", "position", 0, 0,
		dbx.Params{"s": sid},
	)
	if err != nil {
		return nil, fmt.Errorf("list pools: %w", err)
	}
	return resultList("pools", records, poolFields)
}

func listFixturesTool() mcp.Tool {
	return mcp.NewTool("list_fixtures",
		mcp.WithDescription("List fixtures in a stage, optionally filtered by pool, round, or status"),
		mcp.WithString("stage_id", mcp.Required(), mcp.Description("Stage ID")),
		mcp.WithString("pool_id", mcp.Description("Pool ID (optional)")),
		mcp.WithNumber("round", mcp.Description("Round number (optional)")),
		mcp.WithString("status", mcp.Description("Status filter: pending, ready, live, finished, walkover, bye (optional)")),
		returnsList("fixtures", fixtureSummaryFields),
	)
}

func (s *WhistleMCP) listFixtures(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	sid := argString(req, "stage_id")
	tid, err := s.tournamentOfStage(sid)
	if err != nil {
		return nil, err
	}
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}

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

	return resultList("fixtures", records, fixtureSummaryFields)
}

func getFixtureTool() mcp.Tool {
	return mcp.NewTool("get_fixture",
		mcp.WithDescription("Get a fixture by ID with games"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Fixture ID")),
		returnsRecord(fixtureFields, map[string]any{
			"games": arrayOf(recordSchema(gameFields)),
		}),
	)
}

func (s *WhistleMCP) getFixture(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	id := argString(req, "id")
	tid, err := s.tournamentOfFixture(id)
	if err != nil {
		return nil, err
	}
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}
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
		gameList = append(gameList, recordToMap(g, gameFields...))
	}

	data := recordToMap(r, fixtureFields...)
	data["games"] = gameList
	return resultJSON(data)
}

func listEntriesTool() mcp.Tool {
	return mcp.NewTool("list_entries",
		mcp.WithDescription("List entries (participants) in a tournament"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		returnsList("entries", entryFields),
	)
}

func (s *WhistleMCP) listEntries(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := argString(req, "tournament_id")
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}
	records, err := s.app.FindRecordsByFilter(
		"entries", "tournament = {:t}", "seed", 0, 0,
		dbx.Params{"t": tid},
	)
	if err != nil {
		return nil, fmt.Errorf("list entries: %w", err)
	}
	return resultList("entries", records, entryFields)
}

func listStandingsTool() mcp.Tool {
	return mcp.NewTool("list_standings",
		mcp.WithDescription("List standings for a pool"),
		mcp.WithString("pool_id", mcp.Required(), mcp.Description("Pool ID")),
		returnsList("standings", standingFields),
	)
}

func (s *WhistleMCP) listStandings(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	pid := argString(req, "pool_id")
	tid, err := s.tournamentOfPool(pid)
	if err != nil {
		return nil, err
	}
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}
	records, err := s.app.FindRecordsByFilter(
		"standings", "pool = {:p}", "position", 0, 0,
		dbx.Params{"p": pid},
	)
	if err != nil {
		return nil, fmt.Errorf("list standings: %w", err)
	}
	return resultList("standings", records, standingFields)
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
		returnsList("standings", stageTableFields),
	)
}

func (s *WhistleMCP) getStageTable(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	sid := argString(req, "stage_id")
	tid, err := s.tournamentOfStage(sid)
	if err != nil {
		return nil, err
	}
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}
	records, err := tournament.StageTable(s.app, sid)
	if err != nil {
		return nil, fmt.Errorf("get stage table: %w", err)
	}
	return resultList("standings", records, stageTableFields)
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
		returnsRecord(updatedFixtureFields),
	)
}

func (s *WhistleMCP) updateFixture(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	id := argString(req, "id")
	tid, err := s.tournamentOfFixture(id)
	if err != nil {
		return nil, err
	}
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}

	r, err := s.app.FindRecordById("fixtures", id)
	if err != nil {
		return nil, fmt.Errorf("fixture not found: %w", err)
	}

	status := argString(req, "status")
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

	return resultJSON(recordToMap(r, updatedFixtureFields...))
}

func generateStageTool() mcp.Tool {
	return mcp.NewTool("generate_stage",
		mcp.WithDescription("Generate pools, slots and fixtures for a stage. Use dry_run=true to preview without saving."),
		mcp.WithString("stage_id", mcp.Required(), mcp.Description("Stage ID")),
		mcp.WithBoolean("dry_run", mcp.Description("Preview only, don't write anything")),
		// Two answers under one schema: a dry run carries the plan, a real
		// one the counts of what it wrote. Only the stage is in both.
		returns(objectSchema(map[string]any{
			"stage":   str("Stage ID"),
			"dry_run": boolean("True when this was a preview and nothing was written"),
			"plan": map[string]any{
				"type":        "object",
				"description": "The pools, slots and fixtures that would be written. Dry run only.",
			},
			"pools":    integer("Pools written"),
			"slots":    integer("Slots written"),
			"fixtures": integer("Fixtures written"),
		}, "stage")),
	)
}

func (s *WhistleMCP) generateStage(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	sid := argString(req, "stage_id")
	dryRun, _ := req.GetArguments()["dry_run"].(bool)

	tid, err := s.tournamentOfStage(sid)
	if err != nil {
		return nil, err
	}
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}

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
		returns(objectSchema(map[string]any{
			"stage":    str("Stage ID"),
			"resolved": integer("How many updates the resolve made"),
		}, "stage", "resolved")),
	)
}

func (s *WhistleMCP) resolveStage(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	sid := argString(req, "stage_id")
	tid, err := s.tournamentOfStage(sid)
	if err != nil {
		return nil, err
	}
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}
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
		mcp.WithDescription(
			"Create a draft tournament. Signed in, it is created on that "+
				"account. Not signed in, it is created on a temporary account "+
				"that lasts as long as this connection does, and the other "+
				"tools then work on it for the rest of the connection; use "+
				"create_handoff to give a person a link that makes it theirs.",
		),
		mcp.WithString("name", mcp.Required(), mcp.Description("Tournament name")),
		mcp.WithString("sport",
			mcp.Description(
				"What is being played: "+sportChoices()+". This decides the points, "+
					"whether a draw is a result at all, and how many sets a match is "+
					"played to — so getting it wrong scores the whole day wrong. "+
					"Defaults to \"other\", which is a generic table rather than a guess.",
			),
		),
		returnsRecord(createdTournamentFields, map[string]any{
			"scoring": map[string]any{
				"type":        "object",
				"description": "The scoring rules the sport preset set",
			},
			"note": str("Which account the tournament was created on"),
		}),
	)
}

// sportChoices is built from the presets rather than typed out, so a sport
// added to sports.json turns up in the tool's description without anybody
// having to remember this line exists.
func sportChoices() string { return tournament.SportIDs() }

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

func (s *WhistleMCP) createTournament(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	name := argString(req, "name")
	if name == "" {
		return nil, fmt.Errorf("a tournament needs a name")
	}

	// Refused rather than quietly generic. An agent that asked for "padel" and
	// was given a football table would produce a day scored wrong, and the
	// first anybody would know is a standings screen crediting draws in a
	// sport that has none.
	sport := argString(req, "sport")
	if sport != "" && !tournament.KnownSport(sport) {
		return nil, fmt.Errorf("no sport %q — try one of: %s", sport, tournament.SportIDs())
	}
	if sport == "" {
		sport = tournament.DefaultSport
	}
	preset := tournament.SportByID(sport)

	// A caller that already signed in (internal/oauth) owns this outright —
	// no throwaway account, because there is nothing new to keep. Anything else — including a credential that was
	// presented but did not check out, such as an expired Bearer token —
	// falls back to the anonymous device account this always minted, so a
	// bad credential errors here rather than quietly becoming a fresh
	// account with an empty list_tournaments later.
	owner, err := s.callerOrNil(ctx, req)
	if err != nil {
		return nil, err
	}

	anonymous := owner == nil
	if anonymous {
		// Nothing to remember the account against means nothing could ever
		// reach the tournament again, so it is not made. The wrapper in
		// hints.go turns this into an invitation to sign in.
		if connectionFromContext(ctx) == "" {
			return nil, errNoSession
		}
		// An account of its own rather than one shared system user. What
		// that bought: every tournament the MCP made used to have the same
		// owner, so any caller could edit any of them, and no human could
		// ever be given one without being given all of them.
		owner, _, err = s.newOrganiser()
		if err != nil {
			return nil, fmt.Errorf("could not make an account for this tournament: %w", err)
		}
		if err := s.bind(ctx, owner); err != nil {
			return nil, fmt.Errorf("could not make an account for this tournament: %w", err)
		}
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
	r.Set("sport", preset.Sport)
	r.Set("scoring", preset.Scoring)

	if err := s.app.Save(r); err != nil {
		return nil, fmt.Errorf("create tournament: %w", err)
	}

	// The tournament and how it scores, and nothing about who or when: the
	// account id and the timestamp were of no use to whoever asked for a
	// tournament, and the credential that used to be here is the reason
	// mcp_sessions exists.
	data := recordToMap(r, createdTournamentFields...)
	data["scoring"] = preset.Scoring
	if anonymous {
		data["note"] = "Created on a temporary account that lasts as long as this connection. " +
			"Use create_handoff when a person should take this tournament over."
	} else {
		data["note"] = "Created on the signed-in account."
	}

	return resultJSON(data)
}

func addEntryTool() mcp.Tool {
	return mcp.NewTool("add_entry",
		mcp.WithDescription("Add a team/participant to a tournament"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Team name")),
		mcp.WithNumber("seed", mcp.Required(), mcp.Description("Seed (position)")),
		returnsRecord(createdEntryFields),
	)
}

func (s *WhistleMCP) addEntry(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := argString(req, "tournament_id")
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}
	name := argString(req, "name")
	seedArg, _ := req.GetArguments()["seed"].(float64)
	seed := int(seedArg)

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

	return resultJSON(recordToMap(r, createdEntryFields...))
}

func createStageTool() mcp.Tool {
	return mcp.NewTool("create_stage",
		mcp.WithDescription("Create a stage in a tournament (e.g. round_robin group)"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Stage name, e.g. 'Group' or 'Playoff'")),
		mcp.WithString("format", mcp.Required(), mcp.Description("Format: round_robin, single_elim, double_elim, swiss")),
		mcp.WithNumber("position", mcp.Required(), mcp.Description("Stage position (0-based)")),
		mcp.WithString("config", mcp.Description("JSON config, e.g. {\"poolCount\":1}")),
		returnsRecord(stageSummaryFields),
	)
}

func (s *WhistleMCP) createStage(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := argString(req, "tournament_id")
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}
	name := argString(req, "name")
	format := argString(req, "format")
	positionArg, _ := req.GetArguments()["position"].(float64)
	position := int(positionArg)

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

	return resultJSON(recordToMap(r, stageSummaryFields...))
}

func createDisplayTool() mcp.Tool {
	return mcp.NewTool("create_display",
		mcp.WithDescription("Create a projector display screen for a published tournament"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		mcp.WithString("name", mcp.Description("Display name (default: Main screen)")),
		mcp.WithString("token", mcp.Description("URL token (default: auto-generated)")),
		returns(objectSchema(map[string]any{
			"id":            str("Display ID"),
			"name":          str("Display name"),
			"token":         str("URL token; anybody who has it can open the screen"),
			"display_url":   str("JSON feed the screen reads"),
			"projector_url": str("The page to open on the projector"),
		}, "id", "name", "token", "display_url", "projector_url")),
	)
}

func (s *WhistleMCP) createDisplay(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := argString(req, "tournament_id")
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}
	name := "Main screen"
	if n := argString(req, "name"); n != "" {
		name = n
	}
	token := argString(req, "token")
	if token == "" {
		// Was eight reads of the clock in a loop that runs in well under a
		// nanosecond, so every character came out the same and a screen token
		// — the only credential the projector endpoint has — was effectively
		// one letter repeated.
		token = security.RandomStringWithAlphabet(8, tokenAlphabet)
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

	base := strings.TrimSuffix(s.app.Settings().Meta.AppURL, "/")
	return resultJSON(map[string]any{
		"id":            r.Id,
		"name":          name,
		"token":         token,
		"display_url":   base + "/api/display/" + token,
		"projector_url": base + "/display/" + token,
	})
}

func publishTournamentTool() mcp.Tool {
	return mcp.NewTool("publish_tournament",
		mcp.WithDescription("Publish a tournament (set status to live) so the display works"),
		mcp.WithString("tournament_id", mcp.Required(), mcp.Description("Tournament ID")),
		returnsRecord(publishedTournamentFields),
	)
}

func (s *WhistleMCP) publishTournament(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	tid := argString(req, "tournament_id")
	if _, err := s.operator(ctx, req, tid); err != nil {
		return nil, err
	}

	r, err := s.app.FindRecordById("tournaments", tid)
	if err != nil {
		return nil, fmt.Errorf("tournament not found: %w", err)
	}

	r.Set("status", "live")
	if err := s.app.Save(r); err != nil {
		return nil, fmt.Errorf("publish tournament: %w", err)
	}

	return resultJSON(recordToMap(r, publishedTournamentFields...))
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

// There are none, deliberately.
//
// `tournaments://overview` used to list every tournament on the server. A
// resource read carries no arguments, so there is nowhere for a session_token
// to go and no way for the handler to know who is asking — which makes an
// authorised version of that resource impossible rather than merely unwritten.
// `list_tournaments` answers the same question for one caller, and does.
func (s *WhistleMCP) registerResources() {}

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

// resultList answers with rows under a name rather than as a bare array,
// which structuredContent is not allowed to be.
func resultList(key string, records []*core.Record, fields []string) (*mcp.CallToolResult, error) {
	return resultJSON(map[string]any{key: toMapSlice(records, fields...)})
}

func RegisterMCPServer(app core.App) {
	mcpServer := New(app)

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// One endpoint, three methods: POST carries a request, GET opens the
		// stream a client listens on, DELETE ends a session. The transport
		// decides which is which; there is nothing to route here.
		serve := func(e *core.RequestEvent) error {
			mcpServer.Handler().ServeHTTP(e.Response, e.Request)
			return nil
		}

		se.Router.POST(MCPEndpoint, serve)
		se.Router.GET(MCPEndpoint, serve)
		se.Router.DELETE(MCPEndpoint, serve)

		return se.Next()
	})
}
