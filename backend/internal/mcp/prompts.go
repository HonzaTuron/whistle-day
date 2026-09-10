package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"

	"whistleday/backend/internal/tournament"
)

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
//
// A client that speaks prompts asks `prompts/list` on connect. A server that
// never declared the capability answers "method not found", which the client
// writes to its log as `Failed to list prompts`. Declaring the capability and
// registering nothing would silence that; registering the two flows an agent
// actually runs against these tools is the reason to bother.
//
// Prompts here render to message text and nothing else. They take no
// session_token and read no database — `plan_a_tournament` writes out the tool
// sequence in order, `enter_the_results` writes out how to find what still
// needs a score.

func (s *WhistleMCP) registerPrompts() {
	s.mcp.AddPrompt(planTournamentPrompt(), s.planTournament)
	s.mcp.AddPrompt(enterResultsPrompt(), s.enterResults)
}

func planTournamentPrompt() mcp.Prompt {
	return mcp.NewPrompt("plan_a_tournament",
		mcp.WithPromptDescription(
			"Build a whole tournament with the tools, in order: an account, "+
				"the teams, the courts, a stage, its draw, and a link to hand over.",
		),
		mcp.WithArgument("name",
			mcp.RequiredArgument(),
			mcp.ArgumentDescription("What the tournament is called"),
		),
		mcp.WithArgument("sport",
			mcp.ArgumentDescription("What is being played: "+tournament.SportIDs()),
		),
		mcp.WithArgument("teams",
			mcp.ArgumentDescription("The teams, one per line or comma-separated"),
		),
		mcp.WithArgument("format",
			mcp.ArgumentDescription("round_robin, single_elim, double_elim or swiss"),
		),
	)
}

func (s *WhistleMCP) planTournament(ctx context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	args := req.Params.Arguments

	name := strings.TrimSpace(args["name"])
	if name == "" {
		name = "the tournament"
	}
	sport := strings.TrimSpace(args["sport"])
	if sport == "" {
		sport = tournament.DefaultSport
	}
	format := strings.TrimSpace(args["format"])
	if format == "" {
		format = "round_robin"
	}
	stageName := "Group"
	if format != "round_robin" {
		stageName = "Playoff"
	}

	teams := splitList(args["teams"])
	who := "the teams you were given"
	if len(teams) > 0 {
		who = fmt.Sprintf("%d teams (%s)", len(teams), strings.Join(teams, ", "))
	}

	text := fmt.Sprintf(`Set up "%s" as a %s tournament for %s.

Work through the Whistle.day tools in this order:

1. create_tournament {name: %q, sport: %q}. It needs no session_token and
   returns one — keep it, every later call takes it, and it is the only way
   back to this tournament.
2. add_entry once per team, seed 1..N in the order given.
3. add_court for each court, pitch or table the day is played on.
4. create_stage {name: %q, format: %q, position: 0}. Add further stages at
   position 1, 2, ... if the day has them.
5. generate_stage {dry_run: true} to preview the draw, then again without
   dry_run to commit it.
6. publish_tournament, then create_display for the projector.
7. create_handoff when it is ready for a person to take over — that link
   retires the session_token, so leave it until last.

Then enter results with update_fixture as they come in.`,
		name, format, who, name, sport, stageName, format)

	return mcp.NewGetPromptResult(
		fmt.Sprintf("A build plan for %q", name),
		[]mcp.PromptMessage{
			mcp.NewPromptMessage(mcp.RoleUser, mcp.NewTextContent(text)),
		},
	), nil
}

func enterResultsPrompt() mcp.Prompt {
	return mcp.NewPrompt("enter_the_results",
		mcp.WithPromptDescription(
			"Find the matches that still need a score and settle them.",
		),
		mcp.WithArgument("stage_id",
			mcp.ArgumentDescription("The stage to work through (optional)"),
		),
	)
}

func (s *WhistleMCP) enterResults(ctx context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	stage := strings.TrimSpace(req.Params.Arguments["stage_id"])
	where := "each stage"
	if stage != "" {
		where = fmt.Sprintf("stage %s", stage)
	}

	text := fmt.Sprintf(`Enter results for %s.

1. list_stages to find the stage id, if you do not already have it.
2. list_fixtures {stage_id, status: "live"}, then again with status "ready",
   to see what is on court now and what is next. Each fixture has a code, the
   two entries, and a court.
3. For a played match: update_fixture {id, status: "finished", home_score,
   away_score}. For a no-show: {id, status: "walkover", winner: <entry id>}.
4. After correcting a score already entered, resolve_stage {stage_id} to push
   the change through the tables and anything seeded from them.
5. get_stage_table {stage_id} reads the cross-pool standings once the pools
   are done.

Every call takes the session_token that create_tournament returned.`, where)

	return mcp.NewGetPromptResult(
		"How to enter results",
		[]mcp.PromptMessage{
			mcp.NewPromptMessage(mcp.RoleUser, mcp.NewTextContent(text)),
		},
	), nil
}

// splitList breaks a newline-, comma- or semicolon-separated argument into
// trimmed, non-empty items. An agent that pasted a team list should not have
// to care which separator it used.
func splitList(raw string) []string {
	fields := strings.FieldsFunc(raw, func(r rune) bool {
		return r == '\n' || r == ',' || r == ';'
	})
	out := make([]string, 0, len(fields))
	for _, f := range fields {
		if f = strings.TrimSpace(f); f != "" {
			out = append(out, f)
		}
	}
	return out
}
