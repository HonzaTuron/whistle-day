package tournament

import (
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/tests"

	_ "whistleday/backend/migrations"
)

func TestDeleteUserAccount(t *testing.T) {
	dir, err := os.MkdirTemp("", "whistleday-delete-test-*")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	defer os.RemoveAll(dir)

	app, err := tests.NewTestApp(dir)
	if err != nil {
		t.Fatalf("NewTestApp: %v", err)
	}
	defer app.Cleanup()

	user := makeUser(t, app, "delete-me@example.test")
	tournament1 := makeTournament(t, app, "Cup 1", "draft", user)
	tournament2 := makeTournament(t, app, "Cup 2", "live", user)

	if !exists(t, app, "users", user.Id) {
		t.Fatal("user was not created")
	}
	if !exists(t, app, "tournaments", tournament1.Id) || !exists(t, app, "tournaments", tournament2.Id) {
		t.Fatal("tournaments were not created")
	}

	if err := DeleteUserAccount(app, user.Id); err != nil {
		t.Fatalf("DeleteUserAccount failed: %v", err)
	}

	if exists(t, app, "users", user.Id) {
		t.Fatal("user still exists after deletion")
	}
	if exists(t, app, "tournaments", tournament1.Id) || exists(t, app, "tournaments", tournament2.Id) {
		t.Fatal("tournaments still exist after deletion")
	}
}

func TestDeleteUserAccountNotFound(t *testing.T) {
	dir, err := os.MkdirTemp("", "whistleday-delete-test-*")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	defer os.RemoveAll(dir)

	app, err := tests.NewTestApp(dir)
	if err != nil {
		t.Fatalf("NewTestApp: %v", err)
	}
	defer app.Cleanup()

	if err := DeleteUserAccount(app, "nonexistent-user-id"); err == nil {
		t.Fatal("expected error when deleting nonexistent user, got nil")
	}
}
