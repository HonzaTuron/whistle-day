package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

/*
What a tool does to the world, said in the three booleans a client reads.

mcp-go fills these in when a tool says nothing: not read-only, destructive,
open-world. That is the cautious answer and, for eleven of these tools, the
wrong one — a client that asks before every destructive call was asking
before `list_courts`. A directory that reviews a server (ChatGPT's does)
checks each hint against what the tool actually does, so they are decided
here, in one table, rather than left to a default.
*/
type effect int

const (
	// reads looks something up and changes nothing.
	reads effect = iota
	// adds writes a new row and leaves every existing one alone.
	adds
	// overwrites replaces something that was there, or cannot be taken back:
	// a score, a draw, the credential a handoff retires.
	overwrites
	// publishes is an additive write whose result is visible to anybody with
	// the link rather than only to the account that made it.
	publishes
)

func (e effect) annotation() mcp.ToolAnnotation {
	return mcp.ToolAnnotation{
		ReadOnlyHint:    mcp.ToBoolPtr(e == reads),
		DestructiveHint: mcp.ToBoolPtr(e == overwrites),
		IdempotentHint:  mcp.ToBoolPtr(e == reads),
		OpenWorldHint:   mcp.ToBoolPtr(e == publishes),
	}
}

// oauthScope is the one scope internal/oauth issues. Kept in step with
// `scopes_supported` there by hand, for the same import-cycle reason
// mcpResource is.
const oauthScope = "tournaments"

// securitySchemes says how a tool may be called: with nothing, or signed in.
// Both, on every tool, because both are true — `create_tournament` works with
// no credential and the rest act as the account it made on that connection —
// and a client that reads this (ChatGPT) offers sign-in without requiring it.
//
// It lives in `_meta` because mcp-go's Tool has no field for it; the Apps SDK
// reads the mirror there.
func securitySchemes() *mcp.Meta {
	return mcp.NewMetaFromMap(map[string]any{
		"securitySchemes": []map[string]any{
			{"type": "noauth"},
			{"type": "oauth2", "scopes": []string{oauthScope}},
		},
	})
}

// add registers a tool with its hints, and turns "no credential at all" into
// something a client can act on.
func (s *WhistleMCP) add(tool mcp.Tool, e effect, handler server.ToolHandlerFunc) {
	tool.Annotations = e.annotation()
	tool.Meta = securitySchemes()

	s.mcp.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		result, err := handler(ctx, req)
		if err == errNoSession {
			return s.signInChallenge(), nil
		}
		return result, err
	})
}

// signInChallenge is errNoSession as a result rather than an error.
//
// The transport never answers 401 — `create_tournament` has to work with no
// credential — so a client cannot learn from a status code that signing in
// would help. `mcp/www_authenticate` is the same challenge a 401 would have
// carried, on the one call that needed it.
func (s *WhistleMCP) signInChallenge() *mcp.CallToolResult {
	base := strings.TrimSuffix(s.app.Settings().Meta.AppURL, "/")

	result := mcp.NewToolResultError(
		"Sign in to Whistle.day to continue, or start a new tournament with create_tournament.")
	result.Meta = mcp.NewMetaFromMap(map[string]any{
		"mcp/www_authenticate": []string{fmt.Sprintf(
			`Bearer resource_metadata="%s/.well-known/oauth-protected-resource", `+
				`error="invalid_token", error_description="Sign in to Whistle.day to continue"`,
			base,
		)},
	})
	return result
}
