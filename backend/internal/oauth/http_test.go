package oauth

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func bootedApp(t testing.TB) *tests.TestApp {
	app := oauthTestApp(t)
	RegisterOAuthServer(app)
	return app
}

func TestDiscoveryDocuments(t *testing.T) {
	resource := tests.ApiScenario{
		Name:            "protected resource metadata",
		Method:          http.MethodGet,
		URL:             "/.well-known/oauth-protected-resource",
		ExpectedStatus:  200,
		ExpectedContent: []string{`"resource"`, `/api/mcp`, `"authorization_servers"`},
		TestAppFactory:  bootedApp,
	}
	resource.Test(t)

	server := tests.ApiScenario{
		Name:           "authorization server metadata",
		Method:         http.MethodGet,
		URL:            "/.well-known/oauth-authorization-server",
		ExpectedStatus: 200,
		ExpectedContent: []string{
			`"authorization_endpoint"`, `"token_endpoint"`, `"registration_endpoint"`,
			`"code_challenge_methods_supported":["S256"]`,
			`"token_endpoint_auth_methods_supported":["none"]`,
		},
		TestAppFactory: bootedApp,
	}
	server.Test(t)
}

func TestRegisterClientValidatesRedirectURIs(t *testing.T) {
	noURIs := tests.ApiScenario{
		Name:            "no redirect_uris at all",
		Method:          http.MethodPost,
		URL:             "/oauth/register",
		Body:            strings.NewReader(`{"client_name":"Bad Client"}`),
		ExpectedStatus:  400,
		ExpectedContent: []string{`"invalid_redirect_uri"`},
		TestAppFactory:  bootedApp,
	}
	noURIs.Test(t)

	badHost := tests.ApiScenario{
		Name:            "a redirect_uri on an arbitrary http host",
		Method:          http.MethodPost,
		URL:             "/oauth/register",
		Body:            strings.NewReader(`{"redirect_uris":["http://example.com/callback"]}`),
		ExpectedStatus:  400,
		ExpectedContent: []string{`"invalid_redirect_uri"`},
		TestAppFactory:  bootedApp,
	}
	badHost.Test(t)

	wantsSecret := tests.ApiScenario{
		Name:   "asking for a client_secret is refused",
		Method: http.MethodPost,
		URL:    "/oauth/register",
		Body: strings.NewReader(
			`{"redirect_uris":["https://client.example/callback"],"token_endpoint_auth_method":"client_secret_post"}`),
		ExpectedStatus:  400,
		ExpectedContent: []string{`"invalid_client_metadata"`},
		TestAppFactory:  bootedApp,
	}
	wantsSecret.Test(t)

	wellFormed := tests.ApiScenario{
		Name:   "a well-formed registration succeeds and gets no secret",
		Method: http.MethodPost,
		URL:    "/oauth/register",
		Body: strings.NewReader(
			`{"redirect_uris":["https://client.example/callback"],"client_name":"Good Client"}`),
		ExpectedStatus: 201,
		ExpectedContent: []string{
			`"client_id"`, `"token_endpoint_auth_method":"none"`, `"Good Client"`,
		},
		NotExpectedContent: []string{`"client_secret"`},
		TestAppFactory:     bootedApp,
	}
	wellFormed.Test(t)
}

func TestAuthorizeRejectsUnknownClientOrRedirect(t *testing.T) {
	unknownClient := tests.ApiScenario{
		Name:            "no such client_id",
		Method:          http.MethodGet,
		URL:             "/oauth/authorize?client_id=nope&redirect_uri=https://x.example/cb&response_type=code&code_challenge=abc&code_challenge_method=S256",
		ExpectedStatus:  400,
		ExpectedContent: []string{"client_id"},
		TestAppFactory:  bootedApp,
	}
	unknownClient.Test(t)

	mismatchedRedirect := tests.ApiScenario{
		Name:   "redirect_uri does not match what was registered",
		Method: http.MethodGet,
		URL:    "/oauth/authorize?client_id=wd_client_test&redirect_uri=https://evil.example/cb&response_type=code&code_challenge=abc&code_challenge_method=S256",
		BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
			testClient(t, app)
		},
		ExpectedStatus:  400,
		ExpectedContent: []string{"does not match"},
		TestAppFactory:  bootedApp,
	}
	mismatchedRedirect.Test(t)

	// A registered client, wrong PKCE method: this one CAN redirect (client_id
	// and redirect_uri already checked out), and does — as an error, not a 400.
	plainPKCE := tests.ApiScenario{
		Name:   "plain PKCE is rejected by redirecting with an error, not accepted",
		Method: http.MethodGet,
		URL: "/oauth/authorize?client_id=wd_client_test&redirect_uri=" +
			url.QueryEscape("http://127.0.0.1:9999/callback") +
			"&response_type=code&code_challenge=abc&code_challenge_method=plain&state=xyz",
		BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
			testClient(t, app)
		},
		ExpectedStatus: 302,
		TestAppFactory: bootedApp,
		AfterTestFunc: func(t testing.TB, app *tests.TestApp, res *http.Response) {
			loc := res.Header.Get("Location")
			if !strings.Contains(loc, "error=invalid_request") || !strings.Contains(loc, "state=xyz") {
				t.Fatalf("expected an error redirect carrying state, got %q", loc)
			}
		},
	}
	plainPKCE.Test(t)
}

// RFC 8707: a resource naming anything other than this one server is
// refused, whether at /oauth/authorize (as a redirected error, since
// client_id and redirect_uri already checked out by that point) or at
// /oauth/token (as a plain 400, matching every other token-endpoint error).
func TestResourceIndicatorMustNameThisServer(t *testing.T) {
	wrongAtAuthorize := tests.ApiScenario{
		Name:   "a resource naming somebody else's server is refused at authorize",
		Method: http.MethodGet,
		URL: "/oauth/authorize?client_id=wd_client_test&redirect_uri=" +
			url.QueryEscape("http://127.0.0.1:9999/callback") +
			"&response_type=code&code_challenge=abc&code_challenge_method=S256" +
			"&resource=" + url.QueryEscape("https://not-this-server.example/mcp"),
		BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
			testClient(t, app)
		},
		ExpectedStatus: 302,
		TestAppFactory: bootedApp,
		AfterTestFunc: func(t testing.TB, app *tests.TestApp, res *http.Response) {
			loc := res.Header.Get("Location")
			if !strings.Contains(loc, "error=invalid_target") {
				t.Fatalf("expected an invalid_target redirect, got %q", loc)
			}
		},
	}
	wrongAtAuthorize.Test(t)

	wrongAtToken := tests.ApiScenario{
		Name:   "a resource naming somebody else's server is refused at the token endpoint",
		Method: http.MethodPost,
		URL:    "/oauth/token",
		Body: strings.NewReader(url.Values{
			"grant_type":    {"authorization_code"},
			"code":          {"whatever"},
			"redirect_uri":  {"http://127.0.0.1:9999/callback"},
			"client_id":     {"wd_client_test"},
			"code_verifier": {"whatever"},
			"resource":      {"https://not-this-server.example/mcp"},
		}.Encode()),
		Headers:         map[string]string{"content-type": "application/x-www-form-urlencoded"},
		ExpectedStatus:  400,
		ExpectedContent: []string{`"invalid_target"`},
		TestAppFactory:  bootedApp,
	}
	wrongAtToken.Test(t)
}

// The whole loop: register a client, start an authorize call, approve consent
// as a real signed-in user, exchange the code, and confirm the resulting
// access token resolves to that same real user — not a fresh device account.
// This is the payoff of the whole feature, in one test.
func TestFullAuthorizationCodeFlow(t *testing.T) {
	app := oauthTestApp(t)
	defer app.Cleanup()
	RegisterOAuthServer(app)

	// ApiScenario rebuilds the router (and re-triggers every OnServe hook,
	// including PocketBase's own base ones) on every .Test() call, which is
	// fine for one request per fresh app but panics on a route-registration
	// conflict the second time it runs against the SAME long-lived app. This
	// flow needs one app across many requests — the whole point is that
	// state persists from one step to the next — so it drives one mux built
	// once, the same way the real server builds one.
	baseRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatalf("new router: %v", err)
	}
	serveEvent := &core.ServeEvent{App: app, Router: baseRouter}
	var mux http.Handler
	if err := app.OnServe().Trigger(serveEvent, func(e *core.ServeEvent) error {
		built, err := e.Router.BuildMux()
		if err != nil {
			return err
		}
		mux = built
		return nil
	}); err != nil {
		t.Fatalf("serve: %v", err)
	}

	do := func(method, target string, body io.Reader, headers map[string]string) *http.Response {
		t.Helper()
		req := httptest.NewRequest(method, target, body)
		req.Header.Set("content-type", "application/json")
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec.Result()
	}

	decode := func(res *http.Response) map[string]any {
		t.Helper()
		var body map[string]any
		if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		return body
	}

	person := testUser(t, app, "person@example.test")
	personToken, err := person.NewAuthToken()
	if err != nil {
		t.Fatalf("mint session for the signed-in person: %v", err)
	}

	verifier := "a-verifier-at-least-forty-three-characters-long-enough"
	challenge := challengeFor(verifier)
	redirectURI := "http://127.0.0.1:9999/callback"

	// 1. Register a client.
	res := do(http.MethodPost, "/oauth/register",
		strings.NewReader(`{"redirect_uris":["`+redirectURI+`"],"client_name":"Flow Test Client"}`), nil)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("register: status %d", res.StatusCode)
	}
	clientID := decode(res)["client_id"].(string)

	// 2. Authorize redirects to the SPA's consent screen, carrying a
	// request id.
	res = do(http.MethodGet, "/oauth/authorize?response_type=code&client_id="+clientID+
		"&redirect_uri="+url.QueryEscape(redirectURI)+
		"&state=xyz&code_challenge="+challenge+"&code_challenge_method=S256", nil, nil)
	if res.StatusCode != http.StatusFound {
		t.Fatalf("authorize: status %d", res.StatusCode)
	}
	loc, err := url.Parse(res.Header.Get("Location"))
	if err != nil {
		t.Fatalf("bad redirect: %v", err)
	}
	requestID := loc.Query().Get("request")
	if requestID == "" {
		t.Fatalf("no request id in redirect %q", loc)
	}

	// 3. The consent preview names the client and nothing else.
	res = do(http.MethodGet, "/api/oauth/consent/"+requestID, nil, nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("preview: status %d", res.StatusCode)
	}
	if got := decode(res)["client_name"]; got != "Flow Test Client" {
		t.Fatalf("preview client_name = %v", got)
	}

	// 4. Approving, as the signed-in person, mints a code for their account.
	res = do(http.MethodPost, "/api/oauth/consent/"+requestID,
		strings.NewReader(`{"approve":true}`), map[string]string{"Authorization": personToken})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("consent: status %d", res.StatusCode)
	}
	redirectOut, err := url.Parse(decode(res)["redirect"].(string))
	if err != nil {
		t.Fatalf("bad consent redirect: %v", err)
	}
	code := redirectOut.Query().Get("code")
	if code == "" {
		t.Fatalf("no code in %q", redirectOut)
	}
	if redirectOut.Query().Get("state") != "xyz" {
		t.Fatalf("state was not echoed back: %q", redirectOut)
	}
	// RFC 9207: every redirect back to the client's own redirect_uri carries
	// iss, matching authorization_response_iss_parameter_supported.
	if redirectOut.Query().Get("iss") == "" {
		t.Fatalf("no iss in the authorization response: %q", redirectOut)
	}

	tokenForm := func(values url.Values) *http.Response {
		return do(http.MethodPost, "/oauth/token", strings.NewReader(values.Encode()),
			map[string]string{"content-type": "application/x-www-form-urlencoded"})
	}

	// 5. Exchange the code.
	res = tokenForm(url.Values{
		"grant_type": {"authorization_code"}, "code": {code},
		"redirect_uri": {redirectURI}, "client_id": {clientID}, "code_verifier": {verifier},
	})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("exchange: status %d", res.StatusCode)
	}
	tokens := decode(res)
	accessToken := tokens["access_token"].(string)
	refreshToken := tokens["refresh_token"].(string)

	// What actually matters: the token resolves to the real person, not a
	// fresh device account — the whole point of signing in first.
	resolved, err := ResolveAccessToken(app, accessToken)
	if err != nil {
		t.Fatalf("the minted access token does not resolve: %v", err)
	}
	if resolved.Id != person.Id {
		t.Fatalf("resolved to %s, want the signed-in person %s", resolved.Id, person.Id)
	}

	// 6. The code is single-use.
	res = tokenForm(url.Values{
		"grant_type": {"authorization_code"}, "code": {code},
		"redirect_uri": {redirectURI}, "client_id": {clientID}, "code_verifier": {verifier},
	})
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("replaying the code: status %d, want 400", res.StatusCode)
	}

	// 7. Refresh rotates the pair.
	res = tokenForm(url.Values{
		"grant_type": {"refresh_token"}, "refresh_token": {refreshToken}, "client_id": {clientID},
	})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("refresh: status %d", res.StatusCode)
	}
	rotated := decode(res)
	rotatedAccess := rotated["access_token"].(string)
	rotatedRefresh := rotated["refresh_token"].(string)
	if rotatedRefresh == refreshToken {
		t.Fatal("refresh returned the same refresh token")
	}

	// 8. Replaying the now-spent refresh token is reuse: it fails, and it
	// must kill the token that replaced it too, not just itself.
	res = tokenForm(url.Values{
		"grant_type": {"refresh_token"}, "refresh_token": {refreshToken}, "client_id": {clientID},
	})
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("replaying the spent refresh token: status %d, want 400", res.StatusCode)
	}

	if _, err := ResolveAccessToken(app, rotatedAccess); err == nil {
		t.Fatal("the currently-valid rotated access token still works after its predecessor was replayed")
	}
}
