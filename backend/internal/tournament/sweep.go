package tournament

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

/*
Clearing up after agents that wandered off.

`create_tournament` needs no credential, so anything that can reach `/api/mcp`
can make a tournament and an account to own it. Most of those are somebody
trying the thing out, and they are never touched again. Left alone they are
not merely clutter: `bun run stats` reads "how far tournaments got" straight
out of these tables, and a thousand abandoned drafts turn the one number that
tells you whether the product works into noise.

## What this will not delete

This is the part worth being paranoid about, because the criteria sound
similar and are not.

**Not "unclaimed".** Every tournament the wizard makes is owned by an
unclaimed device account — that is the whole point of the wizard. An organiser
who set a tournament up on their phone in October and is running it in
November has an unclaimed account and a live tournament, and deleting it would
be the worst bug this system could have.

So a tournament has to fail *all* of these to be swept:

  - still `draft`, so nobody published it or put it on a wall;
  - no fixtures at all, so no stage was ever generated, so no draw was ever
    made and nothing was ever played;
  - owned by an account that never claimed an email;
  - older than the window, which is thirty days by default.

A tournament somebody is going to run in three weeks does not match, because
they will have drawn it. One somebody drew and abandoned does not match
either, and stays — deleting a real draw is not worth the disk.

**Not accounts that own anything.** The second pass removes device accounts
with no tournaments and no crew membership, which after the first pass is
mostly the accounts whose tournaments just went. An account that owns a
tournament is never touched, whatever its age.
*/

// SweepWindow is how long something has to have been ignored.
//
// Thirty days rather than a day or two, because the cost of being wrong is
// asymmetric: sweeping too late costs some rows, and sweeping too early costs
// somebody the tournament they are running on Saturday.
const defaultSweepDays = 30

// RegisterSweep runs the cleanup once a day.
//
// Set WHISTLEDAY_SWEEP=off to turn it off entirely, or
// WHISTLEDAY_SWEEP_DAYS to change the window.
func RegisterSweep(app core.App) {
	if strings.EqualFold(os.Getenv("WHISTLEDAY_SWEEP"), "off") {
		return
	}

	// 04:10 rather than midnight: nothing else here runs on a schedule, but
	// the small hours are when a backup or a certificate renewal would, and
	// there is no reason to share a minute with them.
	app.Cron().MustAdd("sweep-abandoned", "10 4 * * *", func() {
		if _, err := SweepAbandoned(app, sweepWindow()); err != nil {
			app.Logger().Error("sweep failed", "error", err)
		}
	})
}

func sweepWindow() time.Duration {
	days := defaultSweepDays
	if raw := os.Getenv("WHISTLEDAY_SWEEP_DAYS"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			days = parsed
		}
	}
	return time.Duration(days) * 24 * time.Hour
}

// SweepResult is what a run did, for the log and for the tests.
type SweepResult struct {
	Tournaments int
	Accounts    int
}

// SweepAbandoned removes drafts nobody ever drew and the accounts left behind.
//
// Exported and taking its window as an argument so a test can ask for the same
// work over a different period, and so it can be run by hand.
func SweepAbandoned(app core.App, window time.Duration) (SweepResult, error) {
	result := SweepResult{}
	cutoff := time.Now().Add(-window).UTC().Format("2006-01-02 15:04:05.000Z")

	// ------------------------------------------------------------------
	// Drafts that were never drawn.
	//
	// The fixtures check is the one that makes this safe, and it is a
	// subquery rather than a status column because "was anything ever
	// generated" is a fact about the fixtures table, not something a
	// tournament remembers about itself.
	// ------------------------------------------------------------------
	abandoned, err := app.FindRecordsByFilter(
		"tournaments",
		"status = 'draft' && created < {:cutoff}",
		"created", 0, 0,
		dbx.Params{"cutoff": cutoff},
	)
	if err != nil {
		return result, err
	}

	for _, tournament := range abandoned {
		owner, err := app.FindRecordById("users", tournament.GetString("owner"))
		if err != nil {
			continue // an owner we cannot read is not one we should act on
		}
		// Somebody's real account. Leave it alone whatever else is true.
		if !IsDeviceAccount(owner.Email()) {
			continue
		}

		fixtures, err := app.CountRecords("fixtures",
			dbx.HashExp{"tournament": tournament.Id})
		if err != nil {
			return result, err
		}
		if fixtures > 0 {
			continue // a draw was made here; that is somebody's work
		}

		app.Logger().Info("sweeping an abandoned draft",
			"tournament", tournament.Id,
			"name", tournament.GetString("name"),
			"created", tournament.GetString("created"))

		if err := app.Delete(tournament); err != nil {
			return result, err
		}
		result.Tournaments++
	}

	// ------------------------------------------------------------------
	// Accounts with nothing left to own.
	//
	// Mostly the owners of what just went, but also the account an agent made
	// and then never used — `create_tournament` makes both in one call, and a
	// failure between them leaves the account behind.
	// ------------------------------------------------------------------
	orphans, err := app.FindRecordsByFilter(
		"users",
		"created < {:cutoff}",
		"created", 0, 0,
		dbx.Params{"cutoff": cutoff},
	)
	if err != nil {
		return result, err
	}

	for _, user := range orphans {
		if !IsDeviceAccount(user.Email()) {
			continue
		}

		owns, err := app.CountRecords("tournaments", dbx.HashExp{"owner": user.Id})
		if err != nil {
			return result, err
		}
		if owns > 0 {
			continue
		}

		// Crew on somebody else's tournament is a reason to exist too: the
		// staff row carries the name shown in the crew list, and deleting the
		// account would take it with them.
		crew, err := app.CountRecords("staff", dbx.HashExp{"user": user.Id})
		if err != nil {
			return result, err
		}
		if crew > 0 {
			continue
		}

		app.Logger().Info("sweeping an account that owns nothing",
			"user", user.Id, "created", user.GetString("created"))

		if err := app.Delete(user); err != nil {
			return result, err
		}
		result.Accounts++
	}

	if result.Tournaments > 0 || result.Accounts > 0 {
		app.Logger().Info("sweep done",
			"tournaments", result.Tournaments, "accounts", result.Accounts)
	}
	return result, nil
}
