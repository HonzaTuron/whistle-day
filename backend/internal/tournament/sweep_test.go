package tournament

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	_ "whistleday/backend/migrations"
)

func sweepApp(t *testing.T) *tests.TestApp {
	t.Helper()
	dir, err := os.MkdirTemp("", "whistleday-sweep-test-*")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	app, err := tests.NewTestApp(dir)
	if err != nil {
		os.RemoveAll(dir)
		t.Fatalf("NewTestApp: %v", err)
	}
	RegisterHooks(app)
	return app
}

// aged backdates a record, because the whole feature is about time and a test
// that waits thirty days is not a test.
func aged(t *testing.T, app core.App, table, id string, days int) {
	t.Helper()
	when := time.Now().AddDate(0, 0, -days).UTC().Format("2006-01-02 15:04:05.000Z")
	if _, err := app.DB().NewQuery(
		fmt.Sprintf("UPDATE %s SET created = {:when} WHERE id = {:id}", table),
	).Bind(dbx.Params{"when": when, "id": id}).Execute(); err != nil {
		t.Fatalf("aging %s: %v", table, err)
	}
}

func makeUser(t *testing.T, app core.App, email string) *core.Record {
	t.Helper()
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("users: %v", err)
	}
	r := core.NewRecord(users)
	r.Set("email", email)
	r.Set("password", "apassword123")
	r.Set("passwordConfirm", "apassword123")
	r.SetVerified(true)
	if err := app.Save(r); err != nil {
		t.Fatalf("user %s: %v", email, err)
	}
	return r
}

func makeTournament(t *testing.T, app core.App, name, status string, owner *core.Record) *core.Record {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("tournaments")
	if err != nil {
		t.Fatalf("tournaments: %v", err)
	}
	r := core.NewRecord(col)
	r.Set("name", name)
	r.Set("slug", fmt.Sprintf("%s-%d", name, time.Now().UnixNano()))
	r.Set("status", status)
	r.Set("owner", owner.Id)
	if err := app.Save(r); err != nil {
		t.Fatalf("tournament %s: %v", name, err)
	}
	return r
}

func exists(t *testing.T, app core.App, table, id string) bool {
	t.Helper()
	_, err := app.FindRecordById(table, id)
	return err == nil
}

// The criteria sound similar to each other and are not, so each one that keeps
// a tournament alive gets its own case. Everything here is old enough to be
// swept; only the first one should be.
func TestSweepKeepsWhatItShould(t *testing.T) {
	app := sweepApp(t)
	defer app.Cleanup()

	device := makeUser(t, app, "organiser-old"+DeviceAccountDomain)
	claimed := makeUser(t, app, "someone@example.test")

	// 1. Never drawn, never published, unclaimed owner, old. Goes.
	abandoned := makeTournament(t, app, "Abandoned", "draft", device)

	// 2. Published, so somebody put it somewhere. Stays.
	published := makeTournament(t, app, "Published", "live", device)

	// 3. Owned by a real account. Stays whatever else is true.
	real := makeTournament(t, app, "Claimed", "draft", claimed)

	// 4. Still a draft on an unclaimed account — the wizard's ordinary state —
	//    but a draw was made. Somebody's work. Stays.
	drawn := makeTournament(t, app, "Drawn", "draft", device)
	stages, _ := app.FindCollectionByNameOrId("stages")
	stage := core.NewRecord(stages)
	stage.Set("tournament", drawn.Id)
	stage.Set("name", "Groups")
	stage.Set("format", "round_robin")
	stage.Set("status", "seeded")
	stage.Set("position", 0)
	if err := app.Save(stage); err != nil {
		t.Fatalf("stage: %v", err)
	}
	fixtures, _ := app.FindCollectionByNameOrId("fixtures")
	fixture := core.NewRecord(fixtures)
	fixture.Set("tournament", drawn.Id)
	fixture.Set("stage", stage.Id)
	fixture.Set("status", "pending")
	fixture.Set("round", 1)
	fixture.Set("position", 0)
	if err := app.Save(fixture); err != nil {
		t.Fatalf("fixture: %v", err)
	}

	for _, id := range []string{abandoned.Id, published.Id, real.Id, drawn.Id} {
		aged(t, app, "tournaments", id, 60)
	}
	aged(t, app, "users", device.Id, 60)
	aged(t, app, "users", claimed.Id, 60)

	result, err := SweepAbandoned(app, 30*24*time.Hour)
	if err != nil {
		t.Fatalf("sweep: %v", err)
	}

	if exists(t, app, "tournaments", abandoned.Id) {
		t.Error("a draft nobody ever drew, on an unclaimed account, survived")
	}
	if !exists(t, app, "tournaments", published.Id) {
		t.Error("a published tournament was swept — that is a wall going dark")
	}
	if !exists(t, app, "tournaments", real.Id) {
		t.Error("a tournament on somebody's real account was swept")
	}
	if !exists(t, app, "tournaments", drawn.Id) {
		t.Error("a tournament with a draw in it was swept")
	}
	if result.Tournaments != 1 {
		t.Errorf("swept %d tournaments, want exactly 1", result.Tournaments)
	}

	// The device account still owns two of the survivors, so it stays.
	if !exists(t, app, "users", device.Id) {
		t.Error("an account that still owns tournaments was swept")
	}
}

// The wizard's ordinary case: a tournament set up on a phone weeks before the
// day it is played. Unclaimed and undrawn is exactly what that looks like, and
// it must survive until the window has actually passed.
func TestSweepLeavesRecentDraftsAlone(t *testing.T) {
	app := sweepApp(t)
	defer app.Cleanup()

	device := makeUser(t, app, "organiser-recent"+DeviceAccountDomain)
	soon := makeTournament(t, app, "Next Month", "draft", device)
	aged(t, app, "tournaments", soon.Id, 10)
	aged(t, app, "users", device.Id, 10)

	result, err := SweepAbandoned(app, 30*24*time.Hour)
	if err != nil {
		t.Fatalf("sweep: %v", err)
	}
	if !exists(t, app, "tournaments", soon.Id) {
		t.Fatal("a ten-day-old draft was swept under a thirty-day window")
	}
	if result.Tournaments != 0 || result.Accounts != 0 {
		t.Fatalf("swept %+v, want nothing", result)
	}
}

// The account an agent made and then abandoned, and the one left behind when
// its tournament goes.
func TestSweepRemovesOrphanedAccounts(t *testing.T) {
	app := sweepApp(t)
	defer app.Cleanup()

	orphan := makeUser(t, app, "agent-orphan"+DeviceAccountDomain)
	crewOnly := makeUser(t, app, "referee-somewhere"+DeviceAccountDomain)
	person := makeUser(t, app, "real@example.test")

	// The crew member owns nothing but is on somebody's tournament, and the
	// staff row carries the name shown in the crew list.
	host := makeTournament(t, app, "Hosted", "live", person)
	staff, _ := app.FindCollectionByNameOrId("staff")
	row := core.NewRecord(staff)
	row.Set("tournament", host.Id)
	row.Set("user", crewOnly.Id)
	row.Set("role", "referee")
	row.Set("name", "Jana")
	if err := app.Save(row); err != nil {
		t.Fatalf("staff: %v", err)
	}

	for _, id := range []string{orphan.Id, crewOnly.Id, person.Id} {
		aged(t, app, "users", id, 60)
	}
	aged(t, app, "tournaments", host.Id, 60)

	result, err := SweepAbandoned(app, 30*24*time.Hour)
	if err != nil {
		t.Fatalf("sweep: %v", err)
	}

	if exists(t, app, "users", orphan.Id) {
		t.Error("an account owning nothing and crewing nothing survived")
	}
	if !exists(t, app, "users", crewOnly.Id) {
		t.Error("a referee's account was swept, taking their name off a crew list")
	}
	if !exists(t, app, "users", person.Id) {
		t.Error("a real account was swept")
	}
	if result.Accounts != 1 {
		t.Errorf("swept %d accounts, want exactly 1", result.Accounts)
	}
}
