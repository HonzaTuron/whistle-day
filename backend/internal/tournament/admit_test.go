package tournament

import (
	"fmt"
	"testing"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// A tournament with `teams` entries and one generated stage, which is the
// state every late arrival walks into.
func lateCup(
	t *testing.T, app *tests.TestApp, format, config string, teams int,
) (*core.Record, *core.Record, []*core.Record) {
	t.Helper()

	owner := save(t, app, "users", map[string]any{
		"email": "owner@seedly.test", "password": "seedlytest1",
		"passwordConfirm": "seedlytest1",
	})
	cup := save(t, app, "tournaments", map[string]any{
		"name": "Late Cup", "slug": "late-cup", "status": "published",
		"owner": owner.Id, "scoring": `{"pointsWin":3,"pointsDraw":1}`,
	})

	entries := make([]*core.Record, 0, teams)
	for i := 1; i <= teams; i++ {
		entries = append(entries, save(t, app, "entries", map[string]any{
			"tournament": cup.Id, "name": fmt.Sprintf("T%d", i),
			"status": "active", "seed": i,
		}))
	}

	stage := save(t, app, "stages", map[string]any{
		"tournament": cup.Id, "position": 0, "name": "Stage",
		"format": format, "status": "draft", "config": config,
	})
	generate(t, app, stage)

	return cup, stage, entries
}

func generate(t *testing.T, app core.App, stage *core.Record) {
	t.Helper()
	plan, err := PlanStage(app, stage)
	if err != nil {
		t.Fatalf("PlanStage: %v", err)
	}
	if err := CommitPlan(app, stage, plan); err != nil {
		t.Fatalf("CommitPlan: %v", err)
	}
	if _, err := ResolveStage(app, stage.Id); err != nil {
		t.Fatalf("ResolveStage: %v", err)
	}
}

// arrive adds one more team and fits it in, which is what the endpoint does.
func arrive(t *testing.T, app core.App, cup *core.Record, name string) ([]Admission, error) {
	t.Helper()
	newcomer := save(t, app, "entries", map[string]any{
		"tournament": cup.Id, "name": name, "status": "active", "seed": 99,
	})
	return AdmitEntry(app, newcomer)
}

func stageFixtures(t *testing.T, app core.App, stage *core.Record) []*core.Record {
	t.Helper()
	fixtures, err := app.FindRecordsByFilter(
		"fixtures", "stage = {:s}", "round, position", 0, 0, dbx.Params{"s": stage.Id},
	)
	if err != nil {
		t.Fatalf("fixtures: %v", err)
	}
	return fixtures
}

func fixturesFor(fixtures []*core.Record, entryID string) []*core.Record {
	theirs := []*core.Record{}
	for _, f := range fixtures {
		if f.GetString("home_entry") == entryID || f.GetString("away_entry") == entryID {
			theirs = append(theirs, f)
		}
	}
	return theirs
}

func entryByName(t *testing.T, app core.App, cup *core.Record, name string) *core.Record {
	t.Helper()
	entry, err := app.FindFirstRecordByFilter(
		"entries", "tournament = {:t} && name = {:n}",
		dbx.Params{"t": cup.Id, "n": name},
	)
	if err != nil {
		t.Fatalf("entry %s: %v", name, err)
	}
	return entry
}

// The ordinary case: a team turns up while the groups are being played, and
// owes one match to everybody already in their pool.
func TestALateTeamPlaysEveryoneInTheirGroup(t *testing.T) {
	app := newScoringApp(t)
	cup, stage, _ := lateCup(t, app, "round_robin", `{"poolCount":1}`, 4)

	before := stageFixtures(t, app, stage)
	first := before[0]
	first.Set("status", "finished")
	first.Set("home_score", 2)
	first.Set("away_score", 0)
	if err := app.Save(first); err != nil {
		t.Fatalf("a result before the arrival: %v", err)
	}

	admitted, err := arrive(t, app, cup, "Late")
	if err != nil {
		t.Fatalf("AdmitEntry: %v", err)
	}
	if len(admitted) != 1 || admitted[0].Action != admitPool {
		t.Fatalf("admitted = %+v, want one pool admission", admitted)
	}
	if admitted[0].Fixtures != 4 {
		t.Fatalf("wrote %d matches, want one against each of the four", admitted[0].Fixtures)
	}

	late := entryByName(t, app, cup, "Late")
	after := stageFixtures(t, app, stage)
	if got := len(after) - len(before); got != 4 {
		t.Fatalf("the pool grew by %d matches, want 4", got)
	}
	if got := len(fixturesFor(after, late.Id)); got != 4 {
		t.Fatalf("the newcomer has %d matches, want 4", got)
	}

	// Nothing that was already played moved, and nothing that was already
	// drawn was redrawn.
	played, err := app.FindRecordById("fixtures", first.Id)
	if err != nil {
		t.Fatalf("the played match is gone: %v", err)
	}
	if played.GetString("status") != "finished" || played.GetInt("home_score") != 2 {
		t.Fatal("the result recorded before the arrival did not survive it")
	}

	// Each new match is a round of its own, appended after everything that was
	// already there: a newcomer owing four matches cannot play four at once.
	rounds := map[int]int{}
	for _, f := range fixturesFor(after, late.Id) {
		rounds[f.GetInt("round")]++
	}
	if len(rounds) != 4 {
		t.Fatalf("the new matches share rounds: %v", rounds)
	}

	// And they are in the table, on nothing.
	row, err := app.FindFirstRecordByFilter(
		"standings", "entry = {:e} && pool != ''", dbx.Params{"e": late.Id},
	)
	if err != nil {
		t.Fatalf("the newcomer has no table row: %v", err)
	}
	if row.GetInt("played") != 0 || row.GetInt("points") != 0 {
		t.Fatal("a team that has played nothing arrived with a record")
	}

	// The pool is no longer complete, which is what stops anything being
	// seeded off a table with four matches still to play in it.
	pool := after[0].GetString("pool")
	complete, err := PoolComplete(app, pool)
	if err != nil {
		t.Fatalf("PoolComplete: %v", err)
	}
	if complete {
		t.Fatal("a pool with unplayed matches in it called itself complete")
	}
}

// A league that plays everybody twice owes a newcomer two matches each, one
// at either end.
func TestALateTeamInATwoLegLeaguePlaysEverybodyTwice(t *testing.T) {
	app := newScoringApp(t)
	cup, stage, _ := lateCup(t, app, "round_robin", `{"poolCount":1,"legs":2}`, 4)

	if _, err := arrive(t, app, cup, "Late"); err != nil {
		t.Fatalf("AdmitEntry: %v", err)
	}

	late := entryByName(t, app, cup, "Late")
	theirs := fixturesFor(stageFixtures(t, app, stage), late.Id)
	if len(theirs) != 8 {
		t.Fatalf("the newcomer has %d matches, want 8 — four opponents, twice", len(theirs))
	}

	home := map[string]int{}
	for _, f := range theirs {
		if f.GetString("home_entry") == late.Id {
			home[f.GetString("away_entry")]++
		}
	}
	if len(home) != 4 {
		t.Fatalf("they are at home to %d of the four", len(home))
	}
	for opponent, count := range home {
		if count != 1 {
			t.Fatalf("at home to %s %d times, want once each way", opponent, count)
		}
	}
}

// Two groups, and the newcomer goes into the one with the least to catch up on.
func TestALateTeamJoinsTheSmallestGroup(t *testing.T) {
	app := newScoringApp(t)
	cup, stage, _ := lateCup(t, app, "round_robin", `{"poolCount":2}`, 5)

	admitted, err := arrive(t, app, cup, "Late")
	if err != nil {
		t.Fatalf("AdmitEntry: %v", err)
	}

	pool, err := app.FindRecordById("pools", admitted[0].Pool)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	if pool.GetString("name") != "B" {
		t.Fatalf("joined pool %s, want the smaller B", pool.GetString("name"))
	}

	late := entryByName(t, app, cup, "Late")
	if got := len(fixturesFor(stageFixtures(t, app, stage), late.Id)); got != 2 {
		t.Fatalf("the newcomer has %d matches, want 2 — the size of pool B", got)
	}
}

// Somebody who has gone home is not an opponent. Writing that fixture anyway
// would close it as a walkover the moment it was saved, crediting a newcomer
// with beating a team that was not there.
func TestALateTeamIsNotHandedAWalkoverBySomebodyWhoLeft(t *testing.T) {
	app := newScoringApp(t)
	cup, stage, entries := lateCup(t, app, "round_robin", `{"poolCount":1}`, 4)

	if err := WithdrawEntry(app, entries[0], "withdrawn", PolicyForfeit); err != nil {
		t.Fatalf("WithdrawEntry: %v", err)
	}
	if _, err := arrive(t, app, cup, "Late"); err != nil {
		t.Fatalf("AdmitEntry: %v", err)
	}

	late := entryByName(t, app, cup, "Late")
	theirs := fixturesFor(stageFixtures(t, app, stage), late.Id)
	if len(theirs) != 3 {
		t.Fatalf("the newcomer has %d matches, want 3 — the team that left is not one", len(theirs))
	}
	for _, f := range theirs {
		if isSettled(f.GetString("status")) {
			t.Fatal("a newcomer arrived with a result already on the sheet")
		}
	}
}

func TestAdmittingTheSameTeamTwiceAddsNothing(t *testing.T) {
	app := newScoringApp(t)
	cup, stage, _ := lateCup(t, app, "round_robin", `{"poolCount":1}`, 4)

	if _, err := arrive(t, app, cup, "Late"); err != nil {
		t.Fatalf("AdmitEntry: %v", err)
	}
	late := entryByName(t, app, cup, "Late")
	after := len(stageFixtures(t, app, stage))

	admitted, err := AdmitEntry(app, late)
	if err != nil {
		t.Fatalf("admitting twice: %v", err)
	}
	if admitted[0].Action != admitAlready {
		t.Fatalf("the second admission says %q", admitted[0].Action)
	}
	if got := len(stageFixtures(t, app, stage)); got != after {
		t.Fatalf("admitting twice wrote %d more matches", got-after)
	}
}

func TestALateTeamCannotBeSomebodyWhoWentHome(t *testing.T) {
	app := newScoringApp(t)
	_, _, entries := lateCup(t, app, "round_robin", `{"poolCount":1}`, 4)

	if err := WithdrawEntry(app, entries[0], "withdrawn", PolicyForfeit); err != nil {
		t.Fatalf("WithdrawEntry: %v", err)
	}
	if _, err := AdmitEntry(app, entries[0]); err == nil {
		t.Fatal("a withdrawn team was admitted as a newcomer")
	}
}

// A Swiss field takes a newcomer without a single fixture being written: the
// next round is drawn from the table, and they are now in it.
func TestALateTeamIsDrawnIntoTheNextSwissRound(t *testing.T) {
	app := newScoringApp(t)
	cup, stage, _ := lateCup(t, app, "swiss", `{"rounds":3}`, 4)

	for _, f := range stageFixtures(t, app, stage) {
		if f.GetInt("round") != 0 {
			continue
		}
		f.Set("status", "finished")
		f.Set("home_score", 2)
		f.Set("away_score", 0)
		if err := app.Save(f); err != nil {
			t.Fatalf("round one: %v", err)
		}
	}

	admitted, err := arrive(t, app, cup, "Late")
	if err != nil {
		t.Fatalf("AdmitEntry: %v", err)
	}
	if admitted[0].Action != admitField {
		t.Fatalf("admitted %q, want a seat in the field", admitted[0].Action)
	}

	late := entryByName(t, app, cup, "Late")
	drawn := []*core.Record{}
	for _, f := range stageFixtures(t, app, stage) {
		if f.GetInt("round") == 1 {
			drawn = append(drawn, f)
		}
	}
	if len(fixturesFor(drawn, late.Id)) != 1 {
		t.Fatal("the round drawn after they arrived does not include them")
	}
	// Five in the field, so somebody sits out — and it is not the newcomer,
	// who is bottom of a table they have not played in.
	if len(drawn) != 3 {
		t.Fatalf("round two has %d matches, want two and a bye", len(drawn))
	}
}

// A bracket has as many positions as it was drawn with. While nobody has
// played, the answer is to draw it again.
func TestAnUntouchedBracketIsDrawnAgain(t *testing.T) {
	app := newScoringApp(t)
	cup, stage, _ := lateCup(t, app, "single_elim", `{}`, 5)

	before := len(stageFixtures(t, app, stage))
	admitted, err := arrive(t, app, cup, "Late")
	if err != nil {
		t.Fatalf("AdmitEntry: %v", err)
	}
	if admitted[0].Action != admitRedrawn {
		t.Fatalf("admitted %q, want a redrawn bracket", admitted[0].Action)
	}

	late := entryByName(t, app, cup, "Late")
	after := stageFixtures(t, app, stage)
	if len(fixturesFor(after, late.Id)) == 0 {
		t.Fatal("the redrawn bracket does not have the newcomer in it")
	}
	if len(after) == 0 || before == 0 {
		t.Fatal("the bracket did not survive being redrawn")
	}
}

func TestABracketThatHasStartedRefusesALateTeam(t *testing.T) {
	app := newScoringApp(t)
	cup, stage, _ := lateCup(t, app, "single_elim", `{}`, 4)

	first := stageFixtures(t, app, stage)[0]
	first.Set("status", "finished")
	first.Set("home_score", 2)
	first.Set("away_score", 0)
	if err := app.Save(first); err != nil {
		t.Fatalf("a first-round result: %v", err)
	}

	newcomer := save(t, app, "entries", map[string]any{
		"tournament": cup.Id, "name": "Late", "status": "active", "seed": 99,
	})
	if _, err := AdmitEntry(app, newcomer); err == nil {
		t.Fatal("a bracket with a result in it took another team")
	}

	// Refused before anything was written: the entry exists, and nothing in
	// the tournament pretends it is playing.
	slots, err := app.FindRecordsByFilter(
		"slots", "entry = {:e}", "", 0, 0, dbx.Params{"e": newcomer.Id},
	)
	if err != nil {
		t.Fatalf("slots: %v", err)
	}
	if len(slots) != 0 {
		t.Fatal("a refused admission left a slot behind")
	}
}

// The usual shape of a tournament: groups being played, a playoff hanging off
// them. The groups take the newcomer; the playoff is not a place anybody is
// added to.
func TestAPlayoffSeededFromTheGroupsIsLeftAlone(t *testing.T) {
	app := newScoringApp(t)
	cup, groups, _ := lateCup(t, app, "round_robin", `{"poolCount":1,"advancePerPool":2}`, 4)

	playoff := save(t, app, "stages", map[string]any{
		"tournament": cup.Id, "position": 1, "name": "Playoff",
		"format": "single_elim", "status": "draft",
		"config": fmt.Sprintf(
			`{"seedFrom":{"stage":"%s","advancePerPool":2}}`, groups.Id),
	})
	generate(t, app, playoff)
	drawn := len(stageFixtures(t, app, playoff))

	admitted, err := arrive(t, app, cup, "Late")
	if err != nil {
		t.Fatalf("AdmitEntry: %v", err)
	}
	if len(admitted) != 2 {
		t.Fatalf("admitted %d stages, want both", len(admitted))
	}
	if admitted[0].Action != admitPool {
		t.Fatalf("the groups say %q", admitted[0].Action)
	}
	if admitted[1].Action != admitWaiting {
		t.Fatalf("the playoff says %q, want to be left alone", admitted[1].Action)
	}
	if got := len(stageFixtures(t, app, playoff)); got != drawn {
		t.Fatalf("the playoff was rewritten: %d matches, was %d", got, drawn)
	}
}

// A tournament that has not been drawn at all needs nothing done to it: the
// generator reads the entry list when it runs.
func TestALateTeamBeforeTheDrawIsJustAnEntry(t *testing.T) {
	app := newScoringApp(t)
	owner := save(t, app, "users", map[string]any{
		"email": "owner@seedly.test", "password": "seedlytest1",
		"passwordConfirm": "seedlytest1",
	})
	cup := save(t, app, "tournaments", map[string]any{
		"name": "Undrawn", "slug": "undrawn", "status": "published", "owner": owner.Id,
	})
	save(t, app, "stages", map[string]any{
		"tournament": cup.Id, "position": 0, "name": "Groups",
		"format": "round_robin", "status": "draft", "config": `{"poolCount":1}`,
	})

	admitted, err := arrive(t, app, cup, "Late")
	if err != nil {
		t.Fatalf("AdmitEntry: %v", err)
	}
	if admitted[0].Action != admitWaiting {
		t.Fatalf("an undrawn stage says %q", admitted[0].Action)
	}
}
