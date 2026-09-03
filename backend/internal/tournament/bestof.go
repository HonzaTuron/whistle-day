package tournament

import (
	"fmt"
	"net/http"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// A match played to sets is over when somebody has won enough of them, and
// until now nothing here knew that. `scoring.bestOf` was written by the sport
// presets and read by nobody, so a volleyball match could be saved at 1–0 with
// the third set still to come, or at 3–0 in a format that has three sets in it
// — and both of those went into the table as finished results.
//
// What is enforced is the shape of the score, not the presence of the points
// underneath it. Plenty of days are run on sets alone: the organiser types 2–1
// and never opens the per-set entry, and that is a complete result. So the
// rule is "2–1 is a best-of-three and 1–0 is not", which is true whether or
// not anybody wrote down what happened inside those sets.

// bestOfFault says what is wrong with a match score under a best-of-N format,
// and "" when nothing is.
//
// Pure, and the only place the arithmetic lives: the guard below and the match
// sheet's own copy in the browser have to agree about what a legal score is,
// or an organiser is told the result saved and then told it did not.
func bestOfFault(bestOf, home, away int) string {
	need := ScoringConfig{BestOf: bestOf}.SetsToWin()
	if need == 0 {
		return "" // a single game: the score is whatever the score was
	}

	high, low := home, away
	if low > high {
		high, low = low, high
	}

	switch {
	case high < need:
		return fmt.Sprintf(
			"A best-of-%d match is won by the first side to %d sets, so %d–%d is not over yet.",
			bestOf, need, home, away)
	case high > need || high+low > bestOf:
		return fmt.Sprintf(
			"A best-of-%d match is over at %d sets, so it cannot end %d–%d.",
			bestOf, need, home, away)
	}
	return ""
}

// guardBestOf refuses to store a finished fixture whose score is not a result
// its format can end on.
//
// It reads the tournament for every finished write, which is one indexed
// lookup on the path that already writes a fixture, recomputes a table and
// resolves a bracket. Deriving it from the stage instead would save nothing:
// the scoring lives on the tournament and the stage would have to be read to
// reach it.
//
// A walkover and a bye are outcomes without a scoreline, so neither is asked
// to look like one.
func guardBestOf(app core.App, f *core.Record) error {
	if f.GetString("status") != "finished" {
		return nil
	}

	tournament, err := app.FindRecordById("tournaments", f.GetString("tournament"))
	if err != nil {
		return err
	}
	fault := bestOfFault(
		scoringConfig(tournament).BestOf,
		f.GetInt("home_score"),
		f.GetInt("away_score"),
	)
	if fault == "" {
		return nil
	}
	return apis.NewApiError(http.StatusBadRequest, fault, nil)
}

// guardSetNumber refuses a set the format does not have — a fourth set in a
// best-of-three.
//
// Create only. `number` is what identifies a set, and the sheet matches its
// rows by it rather than renumbering them, so a set that was legal when it was
// written stays legal; what changes on an update is the points inside it,
// which is the write that happens once per rally and is not worth two reads.
func guardSetNumber(app core.App, g *core.Record) error {
	number := g.GetInt("number")
	if number <= 1 {
		return nil // the first set exists in every format, including "no sets"
	}

	fixture, err := app.FindRecordById("fixtures", g.GetString("fixture"))
	if err != nil {
		return err
	}
	tournament, err := app.FindRecordById("tournaments", fixture.GetString("tournament"))
	if err != nil {
		return err
	}

	bestOf := scoringConfig(tournament).BestOf
	if bestOf < 2 || number <= bestOf {
		return nil
	}
	return apis.NewApiError(http.StatusBadRequest, fmt.Sprintf(
		"A best-of-%d match has %d sets in it, so there is no set %d.",
		bestOf, bestOf, number), nil)
}
