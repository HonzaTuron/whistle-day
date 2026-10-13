// Package oauth makes this same PocketBase instance an OAuth 2.1
// authorization server, alongside its existing role as the resource server
// behind /api/mcp.
//
// # Why this exists
//
// The MCP server (backend/internal/mcp) already lets an agent build a
// tournament with no credential at all — create_tournament mints a fresh,
// throwaway "device account" scoped to just that one tournament, the same
// bargain the wizard makes for a person with a clipboard. That is the right
// default for "an agent is setting up today's tournament," but it means an
// agent can never reach a tournament a real, already-signed-in person owns —
// list_tournaments on a fresh device account is always empty.
//
// This package is the other option: sign in once, in a browser, and hand an
// agent a token scoped to that real account. It is additive. The
// session_token argument, the X-Whistle-Session header, and the fully
// anonymous create_tournament path all keep working exactly as before —
// see mcp/auth.go's caller(), which tries a Bearer token from here as one of
// three ways to identify a caller, not the only one.
//
// # Shape
//
// Two mint-preview-consume hops, chained — the same shape
// tournament.MintHandoff/the /claim/$token flow already uses once:
//
//	GET  /oauth/authorize        --mint-->  oauth_requests  -->  consent screen (the SPA)
//	POST /api/oauth/consent/{id} --consume-->  oauth_codes  --mint-->
//	POST /oauth/token (code)     --consume-->  oauth_tokens
//	POST /oauth/token (refresh)  --rotate-->   a new oauth_tokens row
//
// oauth_clients sits underneath all of it, filled by dynamic client
// registration (/oauth/register) — Claude, ChatGPT and anything else that
// connects to an arbitrary MCP server has no pre-shared client_id, so
// registration has to be self-service, the same way create_tournament is for
// tournaments.
//
// Access and refresh tokens are this package's own opaque, database-backed
// tokens (tokens.go) — not PocketBase's native auth JWTs, which have no
// per-token revocation, only "invalidate every session this user ever had at
// once". That is the wrong shape for a short-lived-access/rotating-refresh
// pattern.
//
// Every browser-facing hop stays in the existing TanStack Start SPA, same as
// the rest of this app: this package never renders HTML, only JSON and
// redirects to either the SPA's own /oauth/consent route or the MCP client's
// redirect_uri.
package oauth

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/tools/types"
)

// mcpResource is the URL of the resource this authorization server exists to
// protect. Hardcoded rather than imported from package mcp, which imports
// this package for ResolveAccessToken — importing the other way would be a
// cycle. Kept in sync with mcp.MCPEndpoint by hand; the two are documented
// next to each other for exactly that reason.
const mcpResource = "/api/mcp"

const (
	requestIDLength = 40
	codeLength      = 40
	requestLifetime = 10 * time.Minute
	codeLifetime    = 2 * time.Minute
)

func issuer(app core.App) string {
	return strings.TrimSuffix(app.Settings().Meta.AppURL, "/")
}

// canonicalResource is the one resource this authorization server exists to
// protect, per RFC 8707: what a client's `resource` parameter must name and
// what every token this server issues is bound to.
func canonicalResource(app core.App) string {
	return issuer(app) + mcpResource
}

// validResource reports whether a client-supplied `resource` parameter names
// this server, tolerant of a trailing slash the way the MCP spec's own
// canonical-URI examples are.
func validResource(app core.App, resource string) bool {
	return strings.TrimSuffix(resource, "/") == canonicalResource(app)
}

// RegisterOAuthServer wires the authorization-server routes onto the app.
func RegisterOAuthServer(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/.well-known/oauth-protected-resource", discoverResource)
		se.Router.GET("/.well-known/oauth-authorization-server", discoverServer)
		se.Router.POST("/oauth/register", registerClient)
		se.Router.GET("/oauth/authorize", authorize)
		se.Router.GET("/api/oauth/consent/{request_id}", previewConsent)
		se.Router.POST("/api/oauth/consent/{request_id}", consume).Bind(apis.RequireAuth())
		se.Router.POST("/oauth/token", token)
		return se.Next()
	})
}

// ---------------------------------------------------------------------------
// Discovery — RFC 9728 and RFC 8414.
// ---------------------------------------------------------------------------

func discoverResource(e *core.RequestEvent) error {
	base := issuer(e.App)
	return e.JSON(http.StatusOK, map[string]any{
		"resource":                 base + mcpResource,
		"authorization_servers":    []string{base},
		"scopes_supported":         []string{"tournaments"},
		"bearer_methods_supported": []string{"header"},
		"resource_documentation":   base + "/mcp",
	})
}

func discoverServer(e *core.RequestEvent) error {
	base := issuer(e.App)
	return e.JSON(http.StatusOK, map[string]any{
		"issuer":                                base,
		"authorization_endpoint":                base + "/oauth/authorize",
		"token_endpoint":                        base + "/oauth/token",
		"registration_endpoint":                 base + "/oauth/register",
		"response_types_supported":              []string{"code"},
		"grant_types_supported":                 []string{"authorization_code", "refresh_token"},
		"code_challenge_methods_supported":      []string{"S256"},
		"token_endpoint_auth_methods_supported": []string{"none"},
		"scopes_supported":                      []string{"tournaments"},
		// RFC 9207: this server sets `iss` on every authorize redirect (see
		// errorRedirect and consume() below), so it advertises that plainly
		// rather than leaving a client to find out by receiving one.
		"authorization_response_iss_parameter_supported": true,
	})
}

// ---------------------------------------------------------------------------
// Dynamic client registration — RFC 7591.
// ---------------------------------------------------------------------------

type registerRequest struct {
	RedirectURIs            []string `json:"redirect_uris"`
	ClientName              string   `json:"client_name"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	Scope                   string   `json:"scope"`
	SoftwareID              string   `json:"software_id"`
	SoftwareVersion         string   `json:"software_version"`
}

func registerClient(e *core.RequestEvent) error {
	var data registerRequest
	if err := e.BindBody(&data); err != nil {
		return dcrError(e, "invalid_client_metadata", "could not read the request")
	}

	if len(data.RedirectURIs) == 0 {
		return dcrError(e, "invalid_redirect_uri", "at least one redirect_uri is required")
	}
	for _, raw := range data.RedirectURIs {
		if !validRedirectURI(raw) {
			return dcrError(e, "invalid_redirect_uri",
				fmt.Sprintf("%q is not an allowed redirect_uri", raw))
		}
	}

	// This server only ever mints public clients: none of the MCP clients it
	// is built for — Claude, ChatGPT, anything running as somebody's agent —
	// can hold a secret safely, and a secret that cannot be held safely is
	// not worth issuing.
	if data.TokenEndpointAuthMethod != "" && data.TokenEndpointAuthMethod != "none" {
		return dcrError(e, "invalid_client_metadata",
			`only token_endpoint_auth_method "none" (a public client) is supported`)
	}

	grantTypes := data.GrantTypes
	if len(grantTypes) == 0 {
		grantTypes = []string{"authorization_code", "refresh_token"}
	}
	for _, g := range grantTypes {
		if g != "authorization_code" && g != "refresh_token" {
			return dcrError(e, "invalid_client_metadata",
				"only authorization_code and refresh_token grants are supported")
		}
	}

	responseTypes := data.ResponseTypes
	if len(responseTypes) == 0 {
		responseTypes = []string{"code"}
	}
	for _, r := range responseTypes {
		if r != "code" {
			return dcrError(e, "invalid_client_metadata", `only the "code" response type is supported`)
		}
	}

	collection, err := e.App.FindCollectionByNameOrId("oauth_clients")
	if err != nil {
		return e.InternalServerError("could not register the client", err)
	}

	r := core.NewRecord(collection)
	r.Set("client_id", "wd_client_"+security.RandomString(24))
	r.Set("client_name", data.ClientName)
	r.Set("redirect_uris", data.RedirectURIs)
	r.Set("token_endpoint_auth_method", "none")
	r.Set("grant_types", grantTypes)
	r.Set("response_types", responseTypes)
	r.Set("scope", data.Scope)
	r.Set("software_id", data.SoftwareID)
	r.Set("software_version", data.SoftwareVersion)

	if err := e.App.Save(r); err != nil {
		return e.InternalServerError("could not register the client", err)
	}

	return e.JSON(http.StatusCreated, map[string]any{
		"client_id":                  r.GetString("client_id"),
		"client_name":                r.GetString("client_name"),
		"redirect_uris":              r.GetStringSlice("redirect_uris"),
		"token_endpoint_auth_method": "none",
		"grant_types":                grantTypes,
		"response_types":             responseTypes,
	})
}

func dcrError(e *core.RequestEvent, code, description string) error {
	return e.JSON(http.StatusBadRequest, map[string]any{
		"error": code, "error_description": description,
	})
}

// validRedirectURI allows what a real MCP client needs and nothing looser:
// https anywhere, http only on a loopback address (the OAuth 2.1 native-app
// exception), or a private-use custom scheme for a desktop connector.
func validRedirectURI(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	switch u.Scheme {
	case "https":
		return u.Host != ""
	case "http":
		host := u.Hostname()
		return host == "127.0.0.1" || host == "localhost" || host == "::1"
	case "":
		return false
	default:
		return u.Opaque != "" || u.Host != ""
	}
}

// ---------------------------------------------------------------------------
// Authorize — the browser hop.
// ---------------------------------------------------------------------------

func authorize(e *core.RequestEvent) error {
	q := e.Request.URL.Query()
	clientID := q.Get("client_id")
	redirectURI := q.Get("redirect_uri")
	responseType := q.Get("response_type")
	state := q.Get("state")
	scope := q.Get("scope")
	resource := q.Get("resource")
	challenge := q.Get("code_challenge")
	method := q.Get("code_challenge_method")

	client, err := e.App.FindFirstRecordByFilter("oauth_clients",
		"client_id = {:id}", map[string]any{"id": clientID})
	if err != nil || client == nil {
		return e.BadRequestError("unknown client_id", nil)
	}
	if !containsString(client.GetStringSlice("redirect_uris"), redirectURI) {
		return e.BadRequestError("redirect_uri does not match what this client registered", nil)
	}

	// Everything past this point can report failure by redirecting back to
	// the now-verified redirect_uri (RFC 6749 §4.1.2.1). A bad client_id or a
	// mismatched redirect_uri, above, can never be reported that way — that
	// is the open-redirect mistake mandatory PKCE exists partly to close off,
	// and it stays a plain 400.
	fail := func(code, description string) error {
		return e.Redirect(http.StatusFound, errorRedirect(e.App, redirectURI, state, code, description))
	}

	if responseType != "code" {
		return fail("unsupported_response_type", "only response_type=code is supported")
	}
	if method != "S256" {
		return fail("invalid_request", "code_challenge_method must be S256")
	}
	if challenge == "" {
		return fail("invalid_request", "code_challenge is required")
	}
	// RFC 8707: the one resource this server protects, or none named at all
	// — accepted for a client that predates sending it, but never a
	// mismatched one, since a token bound to the wrong audience is exactly
	// what resource indicators exist to prevent.
	if resource != "" && !validResource(e.App, resource) {
		return fail("invalid_target", "resource must be this MCP server's own URL: "+canonicalResource(e.App))
	}

	collection, err := e.App.FindCollectionByNameOrId("oauth_requests")
	if err != nil {
		return e.InternalServerError("could not start signing in", err)
	}

	r := core.NewRecord(collection)
	r.Set("request_id", security.RandomString(requestIDLength))
	r.Set("client", client.Id)
	r.Set("redirect_uri", redirectURI)
	r.Set("state", state)
	r.Set("scope", scope)
	// Normalised to the one value it can validly be, whether or not the
	// client sent it — every token this server issues is bound to its own
	// resource regardless, so what matters is that a *wrong* one was refused
	// above, not preserving whatever form a right one arrived in.
	r.Set("resource", canonicalResource(e.App))
	r.Set("code_challenge", challenge)
	r.Set("code_challenge_method", method)
	r.Set("expires", types.NowDateTime().Add(requestLifetime))
	r.Set("used", false)

	if err := e.App.Save(r); err != nil {
		return e.InternalServerError("could not start signing in", err)
	}

	consentURL := issuer(e.App) + "/oauth/consent?request=" + url.QueryEscape(r.GetString("request_id"))
	return e.Redirect(http.StatusFound, consentURL)
}

// errorRedirect builds an OAuth error redirect, with `iss` set per RFC 9207
// so a client that recorded the issuer at authorize time can tell this
// response apart from one a mix-up attack forged from a different
// authorization server — see discoverServer's
// authorization_response_iss_parameter_supported, which promises this.
func errorRedirect(app core.App, redirectURI, state, code, description string) string {
	u, err := url.Parse(redirectURI)
	if err != nil {
		return redirectURI
	}
	q := u.Query()
	q.Set("error", code)
	if description != "" {
		q.Set("error_description", description)
	}
	if state != "" {
		q.Set("state", state)
	}
	q.Set("iss", issuer(app))
	u.RawQuery = q.Encode()
	return u.String()
}

func containsString(list []string, want string) bool {
	for _, v := range list {
		if v == want {
			return true
		}
	}
	return false
}

// findRequest resolves a request_id to a live, unconsumed authorize call.
//
// Expired, used and never-existed are one answer, matching findHandoff's
// reasoning: the difference is only ever useful to somebody guessing.
func findRequest(app core.App, requestID string) (*core.Record, error) {
	if requestID == "" {
		return nil, fmt.Errorf("no request")
	}
	r, err := app.FindFirstRecordByFilter("oauth_requests",
		"request_id = {:id} && used = false", map[string]any{"id": requestID})
	if err != nil || r == nil {
		return nil, fmt.Errorf("no such request")
	}
	expires := r.GetDateTime("expires")
	if !expires.IsZero() && expires.Time().Before(time.Now()) {
		return nil, fmt.Errorf("expired")
	}
	return r, nil
}

// ---------------------------------------------------------------------------
// Consent — what the SPA's /oauth/consent route reads and posts to.
// ---------------------------------------------------------------------------

func previewConsent(e *core.RequestEvent) error {
	req, err := findRequest(e.App, e.Request.PathValue("request_id"))
	if err != nil {
		return e.NotFoundError("this link is not valid any more", err)
	}
	client, err := e.App.FindRecordById("oauth_clients", req.GetString("client"))
	if err != nil {
		return e.NotFoundError("this link is not valid any more", err)
	}
	return e.JSON(http.StatusOK, map[string]any{
		"client_name": client.GetString("client_name"),
		"scope":       req.GetString("scope"),
		"resource":    req.GetString("resource"),
	})
}

type consentBody struct {
	Approve bool `json:"approve"`
}

func consume(e *core.RequestEvent) error {
	req, err := findRequest(e.App, e.Request.PathValue("request_id"))
	if err != nil {
		return e.NotFoundError("this link is not valid any more", err)
	}

	var data consentBody
	if err := e.BindBody(&data); err != nil {
		return e.BadRequestError("could not read the request", err)
	}

	redirectURI := req.GetString("redirect_uri")
	state := req.GetString("state")

	if !data.Approve {
		req.Set("used", true)
		if err := e.App.Save(req); err != nil {
			return e.InternalServerError("could not record that decision", err)
		}
		return e.JSON(http.StatusOK, map[string]any{
			"redirect": errorRedirect(e.App, redirectURI, state, "access_denied", ""),
		})
	}

	collection, err := e.App.FindCollectionByNameOrId("oauth_codes")
	if err != nil {
		return e.InternalServerError("could not finish signing in", err)
	}

	code := core.NewRecord(collection)
	code.Set("code", security.RandomString(codeLength))
	code.Set("client", req.GetString("client"))
	code.Set("user", e.Auth.Id)
	code.Set("redirect_uri", redirectURI)
	code.Set("code_challenge", req.GetString("code_challenge"))
	code.Set("code_challenge_method", req.GetString("code_challenge_method"))
	code.Set("scope", req.GetString("scope"))
	code.Set("resource", req.GetString("resource"))
	code.Set("expires", types.NowDateTime().Add(codeLifetime))
	code.Set("used", false)

	err = e.App.RunInTransaction(func(tx core.App) error {
		if err := tx.Save(code); err != nil {
			return err
		}
		req.Set("used", true)
		return tx.Save(req)
	})
	if err != nil {
		return e.InternalServerError("could not finish signing in", err)
	}

	redirect := redirectURI + querySep(redirectURI) + "code=" + url.QueryEscape(code.GetString("code")) +
		"&iss=" + url.QueryEscape(issuer(e.App))
	if state != "" {
		redirect += "&state=" + url.QueryEscape(state)
	}
	return e.JSON(http.StatusOK, map[string]any{"redirect": redirect})
}

func querySep(u string) string {
	if strings.Contains(u, "?") {
		return "&"
	}
	return "?"
}

// ---------------------------------------------------------------------------
// Token — the one form-encoded endpoint in this codebase, deliberately.
//
// Virtually every OAuth client library posts application/x-www-form-urlencoded
// here per RFC 6749, and fighting that convention for the sake of house style
// would cost real interop with exactly the clients (Claude, ChatGPT) this
// feature exists for.
// ---------------------------------------------------------------------------

func token(e *core.RequestEvent) error {
	if err := e.Request.ParseForm(); err != nil {
		return oauthError(e, "invalid_request", "could not read the request")
	}
	form := e.Request.PostForm

	switch form.Get("grant_type") {
	case "authorization_code":
		return exchangeCode(e, form)
	case "refresh_token":
		return refreshGrant(e, form)
	default:
		return oauthError(e, "unsupported_grant_type",
			"grant_type must be authorization_code or refresh_token")
	}
}

func oauthError(e *core.RequestEvent, code, description string) error {
	return e.JSON(http.StatusBadRequest, map[string]any{
		"error": code, "error_description": description,
	})
}

func exchangeCode(e *core.RequestEvent, form url.Values) error {
	codeValue := form.Get("code")
	redirectURI := form.Get("redirect_uri")
	clientID := form.Get("client_id")
	verifier := form.Get("code_verifier")

	// RFC 8707 asks a client to send `resource` at the token endpoint too,
	// not only at authorize — accepted if absent, refused if it names
	// anything other than this one server.
	if resource := form.Get("resource"); resource != "" && !validResource(e.App, resource) {
		return oauthError(e, "invalid_target", "resource must be this MCP server's own URL")
	}

	row, err := e.App.FindFirstRecordByFilter("oauth_codes",
		"code = {:c} && used = false", map[string]any{"c": codeValue})
	if err != nil || row == nil {
		return oauthError(e, "invalid_grant", "that code is not valid any more")
	}
	if expires := row.GetDateTime("expires"); !expires.IsZero() && expires.Time().Before(time.Now()) {
		return oauthError(e, "invalid_grant", "that code is not valid any more")
	}

	client, err := e.App.FindFirstRecordByFilter("oauth_clients",
		"client_id = {:id}", map[string]any{"id": clientID})
	if err != nil || client == nil || client.Id != row.GetString("client") {
		return oauthError(e, "invalid_grant", "client_id does not match")
	}
	if row.GetString("redirect_uri") != redirectURI {
		return oauthError(e, "invalid_grant", "redirect_uri does not match")
	}
	if !VerifyS256(verifier, row.GetString("code_challenge")) {
		return oauthError(e, "invalid_grant", "code_verifier does not match")
	}

	user, err := e.App.FindRecordById("users", row.GetString("user"))
	if err != nil {
		return oauthError(e, "invalid_grant", "that code is not valid any more")
	}

	var access, refreshTok string
	err = e.App.RunInTransaction(func(tx core.App) error {
		row.Set("used", true)
		if err := tx.Save(row); err != nil {
			return err
		}
		a, r, mintErr := MintTokenPair(tx, user, client, row.GetString("scope"))
		if mintErr != nil {
			return mintErr
		}
		access, refreshTok = a, r
		return nil
	})
	if err != nil {
		return e.InternalServerError("could not issue a token", err)
	}

	return e.JSON(http.StatusOK, map[string]any{
		"access_token":  access,
		"token_type":    "Bearer",
		"expires_in":    int(AccessTokenLifetime.Seconds()),
		"refresh_token": refreshTok,
		"scope":         row.GetString("scope"),
	})
}

func refreshGrant(e *core.RequestEvent, form url.Values) error {
	raw := form.Get("refresh_token")
	clientID := form.Get("client_id")

	if resource := form.Get("resource"); resource != "" && !validResource(e.App, resource) {
		return oauthError(e, "invalid_target", "resource must be this MCP server's own URL")
	}

	row, err := FindTokenByRefreshHash(e.App, raw)
	if err != nil || row == nil {
		return oauthError(e, "invalid_grant", "that refresh token is not valid any more")
	}

	client, err := e.App.FindRecordById("oauth_clients", row.GetString("client"))
	if err != nil || client.GetString("client_id") != clientID {
		return oauthError(e, "invalid_grant", "client_id does not match")
	}

	if expires := row.GetDateTime("refresh_expires"); !expires.IsZero() && expires.Time().Before(time.Now()) {
		return oauthError(e, "invalid_grant", "that refresh token is not valid any more")
	}

	if row.GetBool("revoked") {
		// Already redeemed once. The two ordinary explanations — a client
		// retrying a call it thought had failed, or a token that is now in
		// two places — cannot be told apart from here, so OAuth 2.1 says to
		// treat both as theft: kill every token descended from the same
		// original grant, not just this one, and make the honest side
		// reconnect from scratch.
		_ = RevokeChain(e.App, row)
		return oauthError(e, "invalid_grant", "that refresh token has already been used")
	}

	user, err := e.App.FindRecordById("users", row.GetString("user"))
	if err != nil {
		return oauthError(e, "invalid_grant", "that refresh token is not valid any more")
	}

	access, newRefresh, err := RotateTokenPair(e.App, row, user, client)
	if err != nil {
		return e.InternalServerError("could not refresh the token", err)
	}

	return e.JSON(http.StatusOK, map[string]any{
		"access_token":  access,
		"token_type":    "Bearer",
		"expires_in":    int(AccessTokenLifetime.Seconds()),
		"refresh_token": newRefresh,
		"scope":         row.GetString("scope"),
	})
}
