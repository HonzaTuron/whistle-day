package mcp

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"

	"whistleday/backend/internal/oauth"
	"whistleday/backend/internal/tournament"
)

/*
An agent is a user.

The wizard has always created an account nobody asked for — a random address,
a random password, kept in one browser — so that somebody can run a whole
tournament without meeting a signup form. An agent is in exactly that
position: it turns up with a tournament to build and no account, and demanding
it go and get one first would be the same friction, moved.

So `create_tournament` needs no credential and mints one, and every other tool
requires the credential it handed back. That is the same bargain `/new` makes,
and it means the identity the tools authorise against is an ordinary `users`
record — which is what lets `tournament.IsOperator` do the deciding here, with
no second notion of who may touch what.

The credential travels as a tool argument rather than an `Authorization`
header. That looks wrong and is deliberate: the agent does not have a token
when it opens the connection, and a header is fixed for the life of one. A
token that only exists after the first call has to arrive with the second, and
an argument is the only place it fits.

What that costs is worth saying plainly. The token goes back through the
model's context, so it lands in a transcript and probably a log. Nothing here
can prevent that. What it can do is bound it: one account per tournament, so
what leaks is one tournament rather than a platform.

A caller that already has a real account can skip all of that: signing in
once in a browser (internal/oauth) and handing the resulting access token to
an agent as an `Authorization: Bearer` header identifies it as that real
user, with everything they own or crew reachable — the same account, not a
narrower one, because tournament.IsOperator is the only gate either way. See
caller() below for how the two identities and three channels (a
session_token argument, that header, and X-Whistle-Session for a gateway)
are tried in order.
*/

// Unambiguous, and the same alphabet the browser uses: these end up read off a
// wall or pasted between tools by something that is not looking closely.
const tokenAlphabet = "abcdefghijkmnpqrstuvwxyz23456789"

// sessionArg is what the credential is called in every tool that needs one.
// Not `token`, which `create_display` already uses for a screen's URL — two
// different secrets under one name is a mis-paste waiting to happen.
const sessionArg = "session_token"

var errNoSession = fmt.Errorf(
	"this tool needs the session_token that create_tournament returned")

// withSession adds the credential argument to a tool's schema.
func withSession() mcp.ToolOption {
	return mcp.WithString(sessionArg,
		mcp.Required(),
		mcp.Description("The session_token returned by create_tournament"),
	)
}

// SessionHeader is the other way in for the credential.
//
// The argument above is the canonical channel, for the reason set out at the
// top of this file: an agent has no token when it opens the connection. But a
// caller that already holds one — a person reconnecting through Smithery, whose
// gateway binds a config value at connect time and has nowhere to thread it
// afterwards — needs somewhere to put it, and a header is where a fixed
// credential fits. `withSessionHeader` copies it onto the request context;
// `caller` reads it back if no argument was sent.
const SessionHeader = "X-Whistle-Session"

type ctxKey int

const (
	sessionCtxKey ctxKey = iota
	bearerCtxKey
)

// withCredentials is wired into the HTTP transport in New(). mcp-go runs it
// once per request, before the tool handler, and takes exactly one such
// function — there is only one slot — so this lifts both header-borne
// credentials onto the context rather than there being two of these.
func withCredentials(ctx context.Context, r *http.Request) context.Context {
	if v := strings.TrimSpace(r.Header.Get(SessionHeader)); v != "" {
		ctx = context.WithValue(ctx, sessionCtxKey, v)
	}
	// RFC 6750's scheme, for a caller that completed the OAuth flow in
	// internal/oauth — see the doc comment above for how this and
	// X-Whistle-Session differ.
	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		ctx = context.WithValue(ctx, bearerCtxKey, strings.TrimSpace(strings.TrimPrefix(auth, "Bearer ")))
	}
	return ctx
}

func sessionFromContext(ctx context.Context) string {
	v, _ := ctx.Value(sessionCtxKey).(string)
	return v
}

func bearerFromContext(ctx context.Context) string {
	v, _ := ctx.Value(bearerCtxKey).(string)
	return v
}

// newOrganiser mints an account for an agent and the token to act as it.
//
// Mirrors `signUp()` in `apps/web/src/api/organiser.ts`, including the address
// it writes: an agent's account is a device account, unclaimed and on the same
// suffix, because that is precisely what it is — an account created by
// something that is not a person, for a person to take over later. Writing it
// on a suffix of its own would only mean `/api/organiser/claim` refusing to
// hand it to anybody.
func (s *WhistleMCP) newOrganiser() (*core.Record, string, error) {
	users, err := s.app.FindCollectionByNameOrId("users")
	if err != nil {
		return nil, "", err
	}

	password := security.RandomString(24)

	r := core.NewRecord(users)
	r.Set("email", "agent-"+security.RandomStringWithAlphabet(12, tokenAlphabet)+
		tournament.DeviceAccountDomain)
	r.Set("password", password)
	r.Set("passwordConfirm", password)
	r.Set("name", "Agent")
	// Nobody is going to open a link sent to an address that does not exist.
	r.SetVerified(true)

	if err := s.app.Save(r); err != nil {
		return nil, "", err
	}

	token, err := r.NewAuthToken()
	if err != nil {
		return nil, "", err
	}
	return r, token, nil
}

// caller resolves the credential on a tool call to the account that holds it.
//
// Three channels, tried in this order, each failing closed: a channel that
// carries something invalid errors immediately rather than falling through
// to the next one, which matters most for the Bearer case — a caller whose
// access token just expired should hear that, not silently end up as a new
// anonymous account.
//
//  1. The session_token argument — a device account create_tournament minted.
//  2. Authorization: Bearer — a real account, via internal/oauth.
//  3. X-Whistle-Session — the same session_token, for a gateway that binds
//     config at connect time and has nowhere to put a per-call argument.
func (s *WhistleMCP) caller(ctx context.Context, req mcp.CallToolRequest) (*core.Record, error) {
	if token, _ := req.GetArguments()[sessionArg].(string); token != "" {
		return resolveSessionToken(s.app, token)
	}
	if bearer := bearerFromContext(ctx); bearer != "" {
		return oauth.ResolveAccessToken(s.app, bearer)
	}
	if header := sessionFromContext(ctx); header != "" {
		return resolveSessionToken(s.app, header)
	}
	return nil, errNoSession
}

func resolveSessionToken(app core.App, token string) (*core.Record, error) {
	user, err := app.FindAuthRecordByToken(token, core.TokenTypeAuth)
	if err != nil || user == nil {
		// One sentence for expired, revoked and never-existed alike. The
		// difference is only useful to somebody guessing.
		return nil, fmt.Errorf("that session_token is not valid any more")
	}
	return user, nil
}

// callerOrNil is caller() with "nothing was presented at all" turned into a
// nil, nil result instead of errNoSession.
//
// create_tournament is the one tool that needs to tell those apart: nothing
// presented means fall back to minting a fresh device account, same as
// always, but something presented that did not check out — an expired
// Bearer token, most likely — should surface as an error rather than
// quietly producing a throwaway account nobody meant to make.
func (s *WhistleMCP) callerOrNil(ctx context.Context, req mcp.CallToolRequest) (*core.Record, error) {
	user, err := s.caller(ctx, req)
	if err == errNoSession {
		return nil, nil
	}
	return user, err
}

// operator resolves the caller and checks it may operate this tournament.
//
// The error is deliberately the same whether the tournament is somebody
// else's or not there at all, so the tools cannot be used to find out which
// tournaments exist.
func (s *WhistleMCP) operator(ctx context.Context, req mcp.CallToolRequest, tournamentID string) (*core.Record, error) {
	user, err := s.caller(ctx, req)
	if err != nil {
		return nil, err
	}
	if tournamentID == "" {
		return nil, fmt.Errorf("no tournament to act on")
	}

	allowed, err := tournament.IsOperator(s.app, user.Id, tournamentID)
	if err != nil || !allowed {
		return nil, fmt.Errorf("no tournament %s that this session can act on", tournamentID)
	}
	return user, nil
}

// ---------------------------------------------------------------------------
// Finding the tournament a thing belongs to.
//
// Most tools are handed a stage, a fixture or a pool rather than a tournament,
// and the check above needs the tournament. Each of these reads one indexed
// row and is the first thing its tool does, before anything is written.
// ---------------------------------------------------------------------------

func (s *WhistleMCP) tournamentOfStage(stageID string) (string, error) {
	r, err := s.app.FindRecordById("stages", stageID)
	if err != nil {
		return "", fmt.Errorf("no stage %s", stageID)
	}
	return r.GetString("tournament"), nil
}

func (s *WhistleMCP) tournamentOfFixture(fixtureID string) (string, error) {
	r, err := s.app.FindRecordById("fixtures", fixtureID)
	if err != nil {
		return "", fmt.Errorf("no fixture %s", fixtureID)
	}
	return r.GetString("tournament"), nil
}

func (s *WhistleMCP) tournamentOfPool(poolID string) (string, error) {
	r, err := s.app.FindRecordById("pools", poolID)
	if err != nil {
		return "", fmt.Errorf("no pool %s", poolID)
	}
	return s.tournamentOfStage(r.GetString("stage"))
}
