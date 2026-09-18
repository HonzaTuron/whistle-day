package tournament

import (
	"os"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/types"

	_ "whistleday/backend/migrations"
)

func handoffApp(t *testing.T) *tests.TestApp {
	t.Helper()
	dir, err := os.MkdirTemp("", "whistleday-handoff-test-*")
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

// unclaimed makes the thing a handoff exists to give away: an account nobody
// owns, holding a tournament.
func unclaimed(t *testing.T, app core.App) (*core.Record, *core.Record) {
	t.Helper()

	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("users: %v", err)
	}
	owner := core.NewRecord(users)
	owner.Set("email", "agent-handoff"+DeviceAccountDomain)
	owner.Set("password", "agentpassword1")
	owner.Set("passwordConfirm", "agentpassword1")
	owner.SetVerified(true)
	if err := app.Save(owner); err != nil {
		t.Fatalf("owner: %v", err)
	}

	tournaments, err := app.FindCollectionByNameOrId("tournaments")
	if err != nil {
		t.Fatalf("tournaments: %v", err)
	}
	tournament := core.NewRecord(tournaments)
	tournament.Set("name", "Handoff Cup")
	tournament.Set("slug", "handoff-cup")
	tournament.Set("status", "draft")
	tournament.Set("owner", owner.Id)
	if err := app.Save(tournament); err != nil {
		t.Fatalf("tournament: %v", err)
	}

	return owner, tournament
}

func TestMintHandoff(t *testing.T) {
	app := handoffApp(t)
	defer app.Cleanup()
	owner, tournament := unclaimed(t, app)

	first, err := MintHandoff(app, owner, tournament)
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	if first.GetString("token") == "" {
		t.Fatal("no token")
	}
	if first.GetBool("used") {
		t.Fatal("minted already used")
	}

	// It has a clock on it, unlike every other token in this system.
	expires := first.GetDateTime("expires")
	if expires.IsZero() || expires.Time().Before(time.Now()) {
		t.Fatalf("expires = %v, want a time in the future", expires)
	}

	// A second link burns the first. Two live links means the one somebody was
	// sent quietly stops being the only way in.
	second, err := MintHandoff(app, owner, tournament)
	if err != nil {
		t.Fatalf("second mint: %v", err)
	}
	if second.GetString("token") == first.GetString("token") {
		t.Fatal("the same token twice")
	}

	if _, err := findHandoff(app, first.GetString("token")); err == nil {
		t.Fatal("the first link still works after a second was minted")
	}
	if _, err := findHandoff(app, second.GetString("token")); err != nil {
		t.Fatalf("the second link does not work: %v", err)
	}
}

func TestFindHandoffRefusals(t *testing.T) {
	app := handoffApp(t)
	defer app.Cleanup()
	owner, tournament := unclaimed(t, app)

	t.Run("a token that never existed", func(t *testing.T) {
		if _, err := findHandoff(app, "nothing"); err == nil {
			t.Fatal("accepted a made-up token")
		}
	})

	t.Run("no token at all", func(t *testing.T) {
		if _, err := findHandoff(app, ""); err == nil {
			t.Fatal("accepted an empty token")
		}
	})

	t.Run("one that has been used", func(t *testing.T) {
		handoff, err := MintHandoff(app, owner, tournament)
		if err != nil {
			t.Fatalf("mint: %v", err)
		}
		handoff.Set("used", true)
		if err := app.Save(handoff); err != nil {
			t.Fatalf("save: %v", err)
		}
		if _, err := findHandoff(app, handoff.GetString("token")); err == nil {
			t.Fatal("a spent link still works")
		}
	})

	t.Run("one that has expired", func(t *testing.T) {
		handoff, err := MintHandoff(app, owner, tournament)
		if err != nil {
			t.Fatalf("mint: %v", err)
		}
		handoff.Set("expires", types.NowDateTime().Add(-time.Minute))
		if err := app.Save(handoff); err != nil {
			t.Fatalf("save: %v", err)
		}
		if _, err := findHandoff(app, handoff.GetString("token")); err == nil {
			t.Fatal("an expired link still works")
		}
	})
}

// The two-step Google/Facebook claim: /oauth-session hands out a token for
// the still-anonymous account, and /finish is what actually spends the
// handoff — minus the HTTP, the same way TestHandoffTransfersTheAccount tests
// the password path.
func TestHandoffOAuthSession(t *testing.T) {
	app := handoffApp(t)
	defer app.Cleanup()
	owner, tournament := unclaimed(t, app)

	handoff, err := MintHandoff(app, owner, tournament)
	if err != nil {
		t.Fatalf("mint: %v", err)
	}

	// What /oauth-session does: a token for the account the link names,
	// nothing about the account changed yet.
	sessionToken, err := owner.NewAuthToken()
	if err != nil {
		t.Fatalf("oauth-session token: %v", err)
	}
	if live, err := findHandoff(app, handoff.GetString("token")); err != nil || live.GetBool("used") {
		t.Fatal("minting a session token spent the handoff")
	}

	resolved, err := app.FindAuthRecordByToken(sessionToken, core.TokenTypeAuth)
	if err != nil || resolved.Id != owner.Id {
		t.Fatalf("the minted token does not authenticate as the handoff's account: %v", err)
	}

	// What /finish does once the browser has linked a provider through that
	// session: the real email lands on the account, the handoff is spent, and
	// the old device password and every token minted before this point stop
	// working — including the one /oauth-session just handed out.
	owner.SetEmail("organiser@example.test")
	owner.SetVerified(true)
	owner.SetRandomPassword()
	owner.RefreshTokenKey()
	if err := app.Save(owner); err != nil {
		t.Fatalf("finish: %v", err)
	}
	handoff.Set("used", true)
	if err := app.Save(handoff); err != nil {
		t.Fatalf("burn: %v", err)
	}
	finishToken, err := owner.NewAuthToken()
	if err != nil {
		t.Fatalf("finish token: %v", err)
	}

	if _, err := findHandoff(app, handoff.GetString("token")); err == nil {
		t.Fatal("a spent handoff still works")
	}
	if _, err := app.FindAuthRecordByToken(sessionToken, core.TokenTypeAuth); err == nil {
		t.Fatal("the pre-finish session token still authenticates after RefreshTokenKey")
	}
	resolved, err = app.FindAuthRecordByToken(finishToken, core.TokenTypeAuth)
	if err != nil || resolved.Id != owner.Id {
		t.Fatalf("the token /finish hands back does not authenticate as the account: %v", err)
	}

	reloaded, err := app.FindRecordById("users", owner.Id)
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	if IsDeviceAccount(reloaded.Email()) {
		t.Fatalf("still a device account: %q", reloaded.Email())
	}
	if !reloaded.Verified() {
		t.Fatal("not marked verified")
	}
}

// The tournament survives being given away, and the account that held it stops
// being anonymous. This is the whole feature in one assertion.
func TestHandoffTransfersTheAccount(t *testing.T) {
	app := handoffApp(t)
	defer app.Cleanup()
	owner, tournament := unclaimed(t, app)

	handoff, err := MintHandoff(app, owner, tournament)
	if err != nil {
		t.Fatalf("mint: %v", err)
	}

	before := owner.GetString("tokenKey")

	// What the route does, minus the HTTP.
	owner.SetEmail("organiser@example.test")
	owner.SetPassword("apassword123")
	owner.SetVerified(true)
	owner.RefreshTokenKey()
	if err := app.Save(owner); err != nil {
		t.Fatalf("claim: %v", err)
	}
	handoff.Set("used", true)
	if err := app.Save(handoff); err != nil {
		t.Fatalf("burn: %v", err)
	}

	reloaded, err := app.FindRecordById("users", owner.Id)
	if err != nil {
		t.Fatalf("reload: %v", err)
	}

	if IsDeviceAccount(reloaded.Email()) {
		t.Fatalf("still a device account: %q", reloaded.Email())
	}
	if reloaded.GetString("tokenKey") == before {
		t.Fatal("the token key did not change, so the agent still has a way in")
	}

	// The tournament did not move — it is the account underneath it that did.
	stillThere, err := app.FindRecordById("tournaments", tournament.Id)
	if err != nil {
		t.Fatalf("tournament gone: %v", err)
	}
	if stillThere.GetString("owner") != owner.Id {
		t.Fatal("the tournament changed hands, when only the account should have")
	}

	// And the operator check still says yes, for the same account and a new
	// person.
	ok, err := IsOperator(app, owner.Id, tournament.Id)
	if err != nil || !ok {
		t.Fatalf("the new owner cannot operate their own tournament: %v", err)
	}
}
