package mcp

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"

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

const sessionCtxKey ctxKey = iota

// withSessionHeader is wired into the HTTP transport in New(). mcp-go runs it
// once per request, before the tool handler.
func withSessionHeader(ctx context.Context, r *http.Request) context.Context {
	if v := strings.TrimSpace(r.Header.Get(SessionHeader)); v != "" {
		return context.WithValue(ctx, sessionCtxKey, v)
	}
	return ctx
}

func sessionFromContext(ctx context.Context) string {
	v, _ := ctx.Value(sessionCtxKey).(string)
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
// Argument first, then the X-Whistle-Session header. A call that carries both
// is a call that carries the argument.
func (s *WhistleMCP) caller(ctx context.Context, req mcp.CallToolRequest) (*core.Record, error) {
	token, _ := req.GetArguments()[sessionArg].(string)
	if token == "" {
		token = sessionFromContext(ctx)
	}
	if token == "" {
		return nil, errNoSession
	}

	user, err := s.app.FindAuthRecordByToken(token, core.TokenTypeAuth)
	if err != nil || user == nil {
		// One sentence for expired, revoked and never-existed alike. The
		// difference is only useful to somebody guessing.
		return nil, fmt.Errorf("that session_token is not valid any more")
	}
	return user, nil
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
