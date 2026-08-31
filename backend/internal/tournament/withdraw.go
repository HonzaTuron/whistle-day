package tournament

import (
	"fmt"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Taking a team out of a tournament that is already under way.
//
// Two questions, and they are separate. Whether somebody is still *in* decides
// what happens next: who gets drawn into the next Swiss round, whose remaining
// fixtures are still going to be played. Whether their results *count* decides
// what the table says about everyone else. A forfeiting team is out of the
// first and still in the second; a voided team is out of both.
//
// Keeping them apart is what stops the obvious bug, which is a withdrawn team
// being quietly paired into round four because the code that drew it only knew
// about the ones whose results had been struck.

// WithdrawalPolicy is what a rulebook says to do with a team that has gone.
type WithdrawalPolicy string

const (
	// PolicyForfeit keeps what they played and hands the rest to their
	// opponents. The record so far was honestly earned, so it stands.
	PolicyForfeit WithdrawalPolicy = "forfeit"
	// PolicyVoid strikes every match they were ever in, on both sides of it.
	// Whoever already played them would otherwise be ranked against a
	// different set of opponents from whoever never got the chance.
	PolicyVoid WithdrawalPolicy = "void"
)

// outStatuses are the two ways of being out. They differ in why, not in what
// the draw and the tables have to do about it.
var outStatuses = []string{"withdrawn", "disqualified"}

func isOutStatus(status string) bool {
	for _, s := range outStatuses {
		if s == status {
			return true
		}
	}
	return false
}

// outEntries is everyone no longer taking part, whatever happens to their
// results. This is the set the Swiss pairing and the fixture list care about.
func outEntries(app core.App, tournamentID string) (map[string]bool, error) {
	return entrySet(app,
		"tournament = {:t} && (status = 'withdrawn' || status = 'disqualified')",
		tournamentID)
}

// voidedEntries is everyone whose results are struck. A subset of outEntries:
// this is the set the tables care about.
func voidedEntries(app core.App, tournamentID string) (map[string]bool, error) {
	return entrySet(app,
		"tournament = {:t} && withdrawal = 'void' && "+
			"(status = 'withdrawn' || status = 'disqualified')",
		tournamentID)
}

func entrySet(app core.App, filter, tournamentID string) (map[string]bool, error) {
	records, err := app.FindRecordsByFilter(
		"entries", filter, "", 0, 0, dbx.Params{"t": tournamentID},
	)
	if err != nil {
		return nil, err
	}
	set := make(map[string]bool, len(records))
	for _, r := range records {
		set[r.Id] = true
	}
	return set, nil
}

// voidedForStage is the void set for whichever tournament a stage belongs to.
// The tables are computed per stage and the withdrawals are recorded per
// tournament, so this is the join between them.
func voidedForStage(app core.App, stage *core.Record) (map[string]bool, error) {
	return voidedEntries(app, stage.GetString("tournament"))
}

// WithdrawEntry takes one entry out and settles what that does to the draw.
//
// Everything they have left is closed here and now rather than left for the
// organiser to tidy up one sheet at a time — which is the entire point, since
// doing it by hand across a group of six is five sheets and a chance to miss
// one. What "closed" means depends on the policy: a forfeit is a walkover to
// whoever was going to face them, a void is a match that is simply not going to
// happen.
//
// Fixtures whose other side is not known yet are left alone on purpose. They
// are not skipped: `settleWithdrawn` picks them up the moment propagation fills
// that side in, which is the same mechanism a declared bye already uses.
func WithdrawEntry(
	app core.App, entry *core.Record, status string, policy WithdrawalPolicy,
) error {
	if !isOutStatus(status) {
		return fmt.Errorf("%q is not a way of being out", status)
	}
	if policy != PolicyForfeit && policy != PolicyVoid {
		return fmt.Errorf("%q is not a withdrawal policy", policy)
	}

	return app.RunInTransaction(func(tx core.App) error {
		entry.Set("status", status)
		entry.Set("withdrawal", string(policy))
		if err := tx.Save(entry); err != nil {
			return err
		}

		fixtures, err := entryFixtures(tx, entry)
		if err != nil {
			return err
		}
		for _, f := range fixtures {
			if isSettled(f.GetString("status")) {
				continue // already played; the policy decides whether it counts
			}
			if _, err := closeForWithdrawal(tx, f, entry, policy); err != nil {
				return err
			}
		}

		return recomputeTournament(tx, entry.GetString("tournament"))
	})
}

// ReinstateEntry puts somebody back, and undoes exactly what taking them out
// did — no more.
//
// `forfeited_by` is what makes that possible. Reversing by shape instead —
// clearing every scoreless walkover involving them — would also wipe a walkover
// the organiser recorded deliberately before any of this, which is a real
// result being destroyed by an undo that was only asked to fix a mis-tap.
func ReinstateEntry(app core.App, entry *core.Record) error {
	return app.RunInTransaction(func(tx core.App) error {
		entry.Set("status", "active")
		entry.Set("withdrawal", "")
		if err := tx.Save(entry); err != nil {
			return err
		}

		closed, err := tx.FindRecordsByFilter(
			"fixtures", "forfeited_by = {:e}", "", 0, 0, dbx.Params{"e": entry.Id},
		)
		if err != nil {
			return err
		}
		for _, f := range closed {
			f.Set("status", readyOrPending(f))
			f.Set("winner", "")
			f.Set("loser", "")
			f.Set("home_score", 0)
			f.Set("away_score", 0)
			f.Set("finished_at", "")
			f.Set("forfeited_by", "")
			if err := tx.Save(f); err != nil {
				return err
			}
		}

		return recomputeTournament(tx, entry.GetString("tournament"))
	})
}

// closeForWithdrawal settles one unplayed fixture because a side of it has
// gone. It reports whether it did anything, so the propagation path can tell a
// fixture it has just closed from one it should leave alone.
func closeForWithdrawal(
	app core.App, f, entry *core.Record, policy WithdrawalPolicy,
) (bool, error) {
	home := f.GetString("home_entry")
	away := f.GetString("away_entry")

	opponent := ""
	switch entry.Id {
	case home:
		opponent = away
	case away:
		opponent = home
	default:
		return false, nil
	}

	// Voided, or both sides gone: nobody is going to play this and nobody is
	// going to be credited for it either.
	if policy == PolicyVoid || opponent == "" {
		f.Set("status", "cancelled")
		f.Set("winner", "")
		f.Set("loser", "")
		f.Set("forfeited_by", entry.Id)
		return true, app.Save(f)
	}

	f.Set("status", "walkover")
	f.Set("winner", opponent)
	f.Set("loser", entry.Id)
	f.Set("home_score", 0)
	f.Set("away_score", 0)
	f.Set("forfeited_by", entry.Id)
	return true, app.Save(f)
}

// settleWithdrawn closes a fixture whose opponent has already gone home.
//
// A bracket fixture is drawn before it knows who is in it, so a team can
// withdraw on Saturday morning and their quarter-final only learn who they were
// facing at lunchtime. Running this from propagation means the answer arrives
// with the participant rather than needing the organiser to notice.
func settleWithdrawn(app core.App, f *core.Record) (bool, error) {
	status := f.GetString("status")
	if status != "pending" && status != "ready" {
		return false, nil
	}

	home := f.GetString("home_entry")
	away := f.GetString("away_entry")
	if home == "" && away == "" {
		return false, nil
	}

	out, err := outEntries(app, f.GetString("tournament"))
	if err != nil || len(out) == 0 {
		return false, err
	}

	gone := ""
	switch {
	case out[home]:
		gone = home
	case out[away]:
		gone = away
	default:
		return false, nil
	}

	entry, err := app.FindRecordById("entries", gone)
	if err != nil {
		return false, err
	}
	policy := WithdrawalPolicy(entry.GetString("withdrawal"))
	if policy == "" {
		policy = PolicyForfeit
	}
	return closeForWithdrawal(app, f, entry, policy)
}

// readyOrPending is where a fixture goes when its result is taken off it: back
// to playable if both sides are known, back to waiting if one of them was only
// ever there because of a result upstream.
func readyOrPending(f *core.Record) string {
	if f.GetString("home_entry") != "" && f.GetString("away_entry") != "" {
		return "ready"
	}
	return "pending"
}

func entryFixtures(app core.App, entry *core.Record) ([]*core.Record, error) {
	return app.FindRecordsByFilter(
		"fixtures",
		"home_entry = {:e} || away_entry = {:e}",
		"round, position", 0, 0,
		dbx.Params{"e": entry.Id},
	)
}

// recomputeTournament rebuilds every stage of a tournament.
//
// Withdrawals are the one thing that reaches across stages at once: a voided
// team changes the group table, which changes who qualified, which changes the
// bracket that was seeded from it. Recomputing the stage they happened to be
// playing in would leave the rest disagreeing with it.
func recomputeTournament(app core.App, tournamentID string) error {
	stages, err := app.FindRecordsByFilter(
		"stages", "tournament = {:t}", "position", 0, 0,
		dbx.Params{"t": tournamentID},
	)
	if err != nil {
		return err
	}
	for _, stage := range stages {
		if err := ComputeStandings(app, stage.Id); err != nil {
			return err
		}
		if _, err := PairNextRound(app, stage.Id); err != nil {
			return err
		}
		if _, err := ResolvePoolRanks(app, stage.Id); err != nil {
			return err
		}
		if _, err := ResolveStageRanks(app, stage.Id); err != nil {
			return err
		}
	}
	return nil
}
