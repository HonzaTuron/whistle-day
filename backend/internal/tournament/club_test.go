package tournament

import (
	"errors"
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

func makeClub(t *testing.T, app core.App, name, slug string, owner *core.Record) *core.Record {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("clubs")
	if err != nil {
		t.Fatalf("clubs: %v", err)
	}
	r := core.NewRecord(col)
	r.Set("name", name)
	r.Set("slug", slug)
	r.Set("owner", owner.Id)
	if err := app.Save(r); err != nil {
		t.Fatalf("club %s: %v", name, err)
	}
	return r
}

func makeScreen(t *testing.T, app core.App, tournament *core.Record, token string, active bool) {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("displays")
	if err != nil {
		t.Fatalf("displays: %v", err)
	}
	r := core.NewRecord(col)
	r.Set("tournament", tournament.Id)
	r.Set("token", token)
	r.Set("mode", "auto")
	r.Set("active", active)
	if err := app.Save(r); err != nil {
		t.Fatalf("screen %s: %v", token, err)
	}
}

func listOn(t *testing.T, app core.App, tournament, club *core.Record) {
	t.Helper()
	tournament.Set("club", club.Id)
	if err := app.Save(tournament); err != nil {
		t.Fatalf("listing %s: %v", tournament.GetString("name"), err)
	}
}

func TestClubPageListsWhatWasPublished(t *testing.T) {
	app := sweepApp(t)
	defer app.Cleanup()

	owner := makeUser(t, app, "chair@example.test")
	club := makeClub(t, app, "TJ Sokol", "tj-sokol", owner)

	live := makeTournament(t, app, "April Cup", "live", owner)
	finished := makeTournament(t, app, "March Cup", "finished", owner)
	draft := makeTournament(t, app, "May Cup", "draft", owner)
	elsewhere := makeTournament(t, app, "Somebody's Open", "live", owner)

	listOn(t, app, live, club)
	listOn(t, app, finished, club)
	listOn(t, app, draft, club)

	// A screen that was switched off is not a way in, and neither is one
	// belonging to a tournament that was never listed.
	makeScreen(t, app, live, "live-off", false)
	makeScreen(t, app, live, "live-on", true)
	makeScreen(t, app, draft, "draft-on", true)
	makeScreen(t, app, elsewhere, "elsewhere-on", true)

	page, err := BuildClubPage(app, "tj-sokol")
	if err != nil {
		t.Fatalf("BuildClubPage: %v", err)
	}

	if page.Club.Name != "TJ Sokol" || page.Club.Slug != "tj-sokol" {
		t.Errorf("club = %+v", page.Club)
	}

	screens := map[string]string{}
	for _, tournament := range page.Tournaments {
		screens[tournament.ID] = tournament.Screen
		if tournament.Date == "" {
			t.Errorf("%s has no date", tournament.Name)
		}
	}
	if len(screens) != 2 {
		t.Fatalf("listed %d tournaments, want the live and the finished one: %+v", len(screens), page.Tournaments)
	}
	if got := screens[live.Id]; got != "live-on" {
		t.Errorf("the live tournament links to %q, want its active screen", got)
	}
	if got, listed := screens[finished.Id]; !listed || got != "" {
		t.Errorf("the finished tournament: listed=%v screen=%q, want listed with no screen", listed, got)
	}
	if _, listed := screens[draft.Id]; listed {
		t.Error("a draft is on the public page")
	}
}

func TestClubPageForAnUnknownSlug(t *testing.T) {
	app := sweepApp(t)
	defer app.Cleanup()

	if _, err := BuildClubPage(app, "nobody"); !errors.Is(err, errNoClub) {
		t.Fatalf("err = %v, want errNoClub", err)
	}
}

func TestOnlyTheOwnerOfBothListsATournament(t *testing.T) {
	app := sweepApp(t)
	defer app.Cleanup()

	owner := makeUser(t, app, "chair@example.test")
	referee := makeUser(t, app, "referee@example.test")
	stranger := makeUser(t, app, "stranger@example.test")

	mine := makeClub(t, app, "TJ Sokol", "tj-sokol", owner)
	theirs := makeClub(t, app, "Rivals", "rivals", stranger)
	cup := makeTournament(t, app, "April Cup", "live", owner)

	// What a request would hand the hook: the stored record with the body
	// applied on top.
	asked := func(club string) *core.Record {
		record, err := app.FindRecordById("tournaments", cup.Id)
		if err != nil {
			t.Fatalf("reload: %v", err)
		}
		record.Set("club", club)
		return record
	}

	if err := clubChangeFault(app, owner, asked(mine.Id)); err != nil {
		t.Errorf("the owner listing their own cup on their own club: %v", err)
	}
	if err := clubChangeFault(app, owner, asked(theirs.Id)); err == nil {
		t.Error("the owner listed their cup on somebody else's club")
	}
	if err := clubChangeFault(app, referee, asked(mine.Id)); err == nil {
		t.Error("somebody who does not own the cup listed it")
	}
	if err := clubChangeFault(app, stranger, asked(theirs.Id)); err == nil {
		t.Error("a club owner listed a cup that is not theirs")
	}
	if err := clubChangeFault(app, nil, asked(mine.Id)); err == nil {
		t.Error("nobody at all listed the cup")
	}

	// A write that leaves the club alone is none of this check's business,
	// whoever makes it: the crew renames and rescored tournaments all day.
	if err := clubChangeFault(app, referee, asked("")); err != nil {
		t.Errorf("a write that does not touch the club: %v", err)
	}

	listOn(t, app, cup, mine)
	if err := clubChangeFault(app, referee, asked(mine.Id)); err != nil {
		t.Errorf("a write that keeps the club it has: %v", err)
	}
	if err := clubChangeFault(app, referee, asked("")); err == nil {
		t.Error("somebody who does not own the cup took it off the page")
	}
	if err := clubChangeFault(app, owner, asked("")); err != nil {
		t.Errorf("the owner taking their cup off the page: %v", err)
	}
}

func TestClosingAClubKeepsItsTournaments(t *testing.T) {
	app := sweepApp(t)
	defer app.Cleanup()

	owner := makeUser(t, app, "chair@example.test")
	club := makeClub(t, app, "TJ Sokol", "tj-sokol", owner)
	cup := makeTournament(t, app, "April Cup", "finished", owner)
	listOn(t, app, cup, club)

	if err := app.Delete(club); err != nil {
		t.Fatalf("delete club: %v", err)
	}

	kept, err := app.FindRecordById("tournaments", cup.Id)
	if err != nil {
		t.Fatalf("the tournament went with its club: %v", err)
	}
	if got := kept.GetString("club"); got != "" {
		t.Errorf("club = %q, want it cleared", got)
	}
}

func TestDeletingAnAccountTakesItsClub(t *testing.T) {
	app := sweepApp(t)
	defer app.Cleanup()

	owner := makeUser(t, app, "chair@example.test")
	club := makeClub(t, app, "TJ Sokol", "tj-sokol", owner)
	listOn(t, app, makeTournament(t, app, "April Cup", "live", owner), club)

	if err := DeleteUserAccount(app, owner.Id); err != nil {
		t.Fatalf("DeleteUserAccount: %v", err)
	}
	if exists(t, app, "clubs", club.Id) {
		t.Error("the club outlived its owner")
	}
}
