package oauth

import (
	"os"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/types"

	_ "whistleday/backend/migrations"
)

func oauthTestApp(t testing.TB) *tests.TestApp {
	t.Helper()
	dir, err := os.MkdirTemp("", "whistleday-oauth-test-*")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	app, err := tests.NewTestApp(dir)
	if err != nil {
		os.RemoveAll(dir)
		t.Fatalf("NewTestApp: %v", err)
	}
	return app
}

func testUser(t testing.TB, app core.App, email string) *core.Record {
	t.Helper()
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("users collection: %v", err)
	}
	u := core.NewRecord(users)
	u.Set("email", email)
	u.Set("password", "apassword123")
	u.Set("passwordConfirm", "apassword123")
	u.SetVerified(true)
	if err := app.Save(u); err != nil {
		t.Fatalf("save user: %v", err)
	}
	return u
}

func testClient(t testing.TB, app core.App) *core.Record {
	t.Helper()
	collection, err := app.FindCollectionByNameOrId("oauth_clients")
	if err != nil {
		t.Fatalf("oauth_clients collection: %v", err)
	}
	c := core.NewRecord(collection)
	c.Set("client_id", "wd_client_test")
	c.Set("client_name", "Test Client")
	c.Set("redirect_uris", []string{"http://127.0.0.1:9999/callback"})
	c.Set("token_endpoint_auth_method", "none")
	c.Set("grant_types", []string{"authorization_code", "refresh_token"})
	c.Set("response_types", []string{"code"})
	if err := app.Save(c); err != nil {
		t.Fatalf("save client: %v", err)
	}
	return c
}

func TestMintAndResolveAccessToken(t *testing.T) {
	app := oauthTestApp(t)
	defer app.Cleanup()
	user := testUser(t, app, "person@example.test")
	client := testClient(t, app)

	access, refresh, err := MintTokenPair(app, user, client, "tournaments", "")
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	if access == "" || refresh == "" || access == refresh {
		t.Fatalf("bad pair: access=%q refresh=%q", access, refresh)
	}

	resolved, err := ResolveAccessToken(app, access)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if resolved.Id != user.Id {
		t.Fatalf("resolved to %s, want %s", resolved.Id, user.Id)
	}
}

func TestResolveAccessTokenRejectsExpiredAndRevoked(t *testing.T) {
	app := oauthTestApp(t)
	defer app.Cleanup()
	user := testUser(t, app, "person@example.test")
	client := testClient(t, app)

	t.Run("wrong token entirely", func(t *testing.T) {
		if _, err := ResolveAccessToken(app, "not-a-real-token"); err == nil {
			t.Fatal("accepted a made-up token")
		}
	})

	t.Run("expired", func(t *testing.T) {
		access, _, err := MintTokenPair(app, user, client, "tournaments", "")
		if err != nil {
			t.Fatalf("mint: %v", err)
		}
		row, err := app.FindFirstRecordByFilter("oauth_tokens",
			"access_token_hash = {:h}", map[string]any{"h": hashToken(access)})
		if err != nil {
			t.Fatalf("find row: %v", err)
		}
		row.Set("access_expires", types.NowDateTime().Add(-time.Minute))
		if err := app.Save(row); err != nil {
			t.Fatalf("save: %v", err)
		}
		if _, err := ResolveAccessToken(app, access); err == nil {
			t.Fatal("an expired access token still resolved")
		}
	})

	t.Run("revoked", func(t *testing.T) {
		access, _, err := MintTokenPair(app, user, client, "tournaments", "")
		if err != nil {
			t.Fatalf("mint: %v", err)
		}
		row, err := app.FindFirstRecordByFilter("oauth_tokens",
			"access_token_hash = {:h}", map[string]any{"h": hashToken(access)})
		if err != nil {
			t.Fatalf("find row: %v", err)
		}
		row.Set("revoked", true)
		if err := app.Save(row); err != nil {
			t.Fatalf("save: %v", err)
		}
		if _, err := ResolveAccessToken(app, access); err == nil {
			t.Fatal("a revoked access token still resolved")
		}
	})
}

func TestRotateTokenPair(t *testing.T) {
	app := oauthTestApp(t)
	defer app.Cleanup()
	user := testUser(t, app, "person@example.test")
	client := testClient(t, app)

	_, refresh, err := MintTokenPair(app, user, client, "tournaments", "")
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	old, err := FindTokenByRefreshHash(app, refresh)
	if err != nil {
		t.Fatalf("find: %v", err)
	}

	newAccess, newRefresh, err := RotateTokenPair(app, old, user, client)
	if err != nil {
		t.Fatalf("rotate: %v", err)
	}
	if newRefresh == refresh {
		t.Fatal("rotation returned the same refresh token")
	}

	reloadedOld, err := app.FindRecordById("oauth_tokens", old.Id)
	if err != nil {
		t.Fatalf("reload old: %v", err)
	}
	if !reloadedOld.GetBool("revoked") {
		t.Fatal("the old token pair is still live after rotation")
	}

	if _, err := ResolveAccessToken(app, newAccess); err != nil {
		t.Fatalf("the new access token does not resolve: %v", err)
	}
}

// A refresh token redeemed twice is reuse, and OAuth 2.1's answer to reuse is
// to kill the whole chain — including the token that is, at this instant,
// the legitimate current one. This is the whole point of tracking `parent`.
func TestRefreshReuseRevokesFamily(t *testing.T) {
	app := oauthTestApp(t)
	defer app.Cleanup()
	user := testUser(t, app, "person@example.test")
	client := testClient(t, app)

	_, firstRefresh, err := MintTokenPair(app, user, client, "tournaments", "")
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	first, err := FindTokenByRefreshHash(app, firstRefresh)
	if err != nil {
		t.Fatalf("find first: %v", err)
	}

	secondAccess, _, err := RotateTokenPair(app, first, user, client)
	if err != nil {
		t.Fatalf("rotate: %v", err)
	}

	// Simulate the token endpoint noticing `first` is already revoked (it
	// is, by RotateTokenPair) and reacting to the replay.
	reloadedFirst, err := app.FindRecordById("oauth_tokens", first.Id)
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	if !reloadedFirst.GetBool("revoked") {
		t.Fatal("expected the spent refresh token to already be revoked")
	}
	if err := RevokeChain(app, reloadedFirst); err != nil {
		t.Fatalf("revoke chain: %v", err)
	}

	if _, err := ResolveAccessToken(app, secondAccess); err == nil {
		t.Fatal("the second, legitimately-rotated access token still works after a reuse was detected")
	}
}

func TestFindTokenByRefreshHashRejectsUnknown(t *testing.T) {
	app := oauthTestApp(t)
	defer app.Cleanup()
	if row, _ := FindTokenByRefreshHash(app, "nothing"); row != nil {
		t.Fatal("found a row for a token that was never minted")
	}
}
