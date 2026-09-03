package tournament

import (
	"fmt"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// A team that turns up after the draw.
//
// The mirror of a withdrawal, and the harder half of it. Taking somebody out
// only has to close what they had left; putting somebody in has to invent the
// matches they are going to play, and what those are depends entirely on the
// format:
//
//   - A group is a list of opponents, so a newcomer gets one match against
//     each of the others and the pool is a team bigger than it was.
//   - A Swiss field is redrawn every round anyway, so a newcomer needs a place
//     in the table and nothing else — the next round draws them in.
//   - A bracket is the shape of the whole competition, decided before a ball
//     was thrown. There is no room in it, so the only honest answer is to draw
//     it again, and that is only possible while nobody has played.
//
// Nothing here is queued offline, for the same reason a withdrawal is not: who
// is in the field decides who gets drawn into the next round, and an arrival
// sitting in a queue for ten minutes is a round paired without them.

// Admission is what happened to one stage when a team arrived late.
type Admission struct {
	Stage string `json:"stage"`
	Name  string `json:"name"`
	// What was done about them, and it is worth saying out loud on the screen
	// that asked: "waiting" is not the same news as "3 matches to play".
	Action string `json:"action"`
	Pool   string `json:"pool,omitempty"`
	// How many matches the admission created. A redrawn bracket reports the
	// whole draw, because that is what it now is.
	Fixtures int `json:"fixtures"`
}

const (
	// admitWaiting: nothing to do here yet. The stage has not been drawn, or
	// it is a playoff fed by a table the newcomer can still qualify through.
	admitWaiting = "waiting"
	// admitAlready: they were already in this stage. Admitting twice is a
	// no-op rather than a second slot.
	admitAlready = "already"
	admitPool    = "pool"
	admitField   = "field"
	admitRedrawn = "redrawn"
)

// AdmitEntry fits a team into the stages that have already been drawn.
//
// Refuses before writing anything. A late arrival added to the groups and then
// refused by the playoff would leave a tournament half-changed, which is the
// one state worse than not having the feature at all.
func AdmitEntry(app core.App, entry *core.Record) ([]Admission, error) {
	if isOutStatus(entry.GetString("status")) {
		return nil, fmt.Errorf(
			"%s is out of this tournament; put them back rather than adding them again",
			entry.GetString("name"))
	}

	stages, err := app.FindRecordsByFilter(
		"stages", "tournament = {:t}", "position", 0, 0,
		dbx.Params{"t": entry.GetString("tournament")},
	)
	if err != nil {
		return nil, err
	}
	for _, stage := range stages {
		if err := lateEntryFault(app, stage); err != nil {
			return nil, err
		}
	}

	var admitted []Admission
	err = app.RunInTransaction(func(tx core.App) error {
		admitted = nil
		for _, stage := range stages {
			one, err := admitToStage(tx, stage, entry)
			if err != nil {
				return err
			}
			admitted = append(admitted, one)
		}
		// The same sweep a withdrawal ends on. A new team changes a pool
		// table, which changes who qualifies from it, which is a different
		// stage's problem — and a Swiss round waiting to be drawn is drawn
		// here, with the newcomer in the field.
		return recomputeTournament(tx, entry.GetString("tournament"))
	})
	if err != nil {
		return nil, err
	}
	return admitted, nil
}

// lateEntryFault reports why a stage cannot take another team.
//
// Only a knockout ever refuses, and only once it has started: the bracket is
// drawn, somebody has beaten somebody in it, and there is no way to add a
// ninth team to eight positions that were decided on Friday. That covers a
// playoff seeded from the groups too — its slots would be re-resolved when the
// groups finish again, which would mean rewriting a round that has been
// played.
//
// A bye is not a start. A bracket of six settles two of them the moment it is
// written, and refusing on that would refuse every draw that is not a power of
// two.
func lateEntryFault(app core.App, stage *core.Record) error {
	switch stage.GetString("format") {
	case "single_elim", "double_elim":
	default:
		return nil
	}

	fixtures, err := app.FindRecordsByFilter(
		"fixtures", "stage = {:stage}", "round, position", 0, 0,
		dbx.Params{"stage": stage.Id},
	)
	if err != nil {
		return err
	}
	for _, f := range fixtures {
		if isPlayed(f.GetString("status")) {
			return fmt.Errorf(
				"%s has already started, and a bracket cannot take another team once it has",
				stage.GetString("name"))
		}
	}
	return nil
}

// admitToStage puts one entry into one stage, whatever that means for its
// format.
func admitToStage(app core.App, stage, entry *core.Record) (Admission, error) {
	admission := Admission{
		Stage: stage.Id, Name: stage.GetString("name"), Action: admitWaiting,
	}

	pools, err := app.FindRecordsByFilter(
		"pools", "stage = {:stage}", "position", 0, 0,
		dbx.Params{"stage": stage.Id},
	)
	if err != nil {
		return admission, err
	}
	if len(pools) == 0 {
		// Not drawn yet, so there is nothing to fit them into: the generator
		// reads the entry list when it runs and they are in it.
		return admission, nil
	}

	held, err := app.FindRecordsByFilter(
		"slots", "stage = {:stage} && entry = {:entry}", "", 1, 0,
		dbx.Params{"stage": stage.Id, "entry": entry.Id},
	)
	if err != nil {
		return admission, err
	}
	if len(held) > 0 {
		admission.Action = admitAlready
		return admission, nil
	}

	switch stage.GetString("format") {
	case "round_robin":
		return admitToPool(app, stage, pools, entry)
	case "swiss":
		return admitToField(app, stage, pools[0], entry)
	case "single_elim", "double_elim":
		cfg, err := stageConfig(stage)
		if err != nil {
			return admission, err
		}
		if cfg.SeedFrom != nil {
			// A playoff is not a place anybody is added to. They qualify for
			// it out of the stage that feeds it, or they do not.
			return admission, nil
		}
		return redrawBracket(app, stage, entry)
	default:
		return admission, nil
	}
}

// admitToPool adds a team to a group and writes the matches they owe it.
//
// They go into the smallest group, which is where a late arrival costs the day
// least: a pool of four and a pool of three are already being compared over
// the same number of matches, and adding to the short one is what closes that
// gap rather than widening it.
//
// The new matches are appended one per round rather than dropped into the
// rounds that exist. A round is what can be played at the same time, and a
// newcomer owing four matches cannot play four at once — so they arrive as
// four catch-up rounds at the end of the pool, which is exactly how they will
// be played.
func admitToPool(
	app core.App, stage *core.Record, pools []*core.Record, entry *core.Record,
) (Admission, error) {
	admission := Admission{
		Stage: stage.Id, Name: stage.GetString("name"), Action: admitWaiting,
	}

	var pool *core.Record
	var members []*core.Record
	var position, smallest int

	for _, candidate := range pools {
		if candidate.GetString("kind") != "group" {
			continue
		}
		slots, err := poolSlots(app, candidate)
		if err != nil {
			return admission, err
		}
		filled := filledSlots(slots)
		// Past every slot the pool has, because the unique index on
		// (stage, pool, round, position) does not care that one of them may
		// hold nobody.
		next := 0
		for _, slot := range slots {
			if slot.GetInt("position") >= next {
				next = slot.GetInt("position") + 1
			}
		}
		if pool == nil || len(filled) < smallest {
			pool, members, position, smallest = candidate, filled, next, len(filled)
		}
	}
	if pool == nil {
		return admission, nil
	}

	slots, err := app.FindCollectionByNameOrId("slots")
	if err != nil {
		return admission, err
	}
	seat := core.NewRecord(slots)
	seat.Set("stage", stage.Id)
	seat.Set("pool", pool.Id)
	seat.Set("round", 0)
	seat.Set("position", position)
	seat.Set("entry", entry.Id)
	seat.Set("source_type", "direct")
	seat.Set("source_position", position+1)
	label := poolSeedLabel(pool.GetString("name"), position+1)
	seat.Set("label", label.Text)
	seat.Set("label_kind", label.Kind)
	seat.Set("label_args", label.Args)
	if err := app.Save(seat); err != nil {
		return admission, err
	}

	cfg, err := stageConfig(stage)
	if err != nil {
		return admission, err
	}
	legs := max(cfg.Legs, 1)

	round, err := lastRound(app, pool)
	if err != nil {
		return admission, err
	}

	fixtures, err := app.FindCollectionByNameOrId("fixtures")
	if err != nil {
		return admission, err
	}

	out, err := outEntries(app, stage.GetString("tournament"))
	if err != nil {
		return admission, err
	}

	written := 0
	for leg := 0; leg < legs; leg++ {
		for index, opponent := range members {
			opponentID := opponent.GetString("entry")
			// Somebody who has already gone home is not an opponent. Writing
			// the fixture anyway would have it closed as a walkover the moment
			// it was saved, crediting a newcomer with beating a team that was
			// not there to be beaten.
			if out[opponentID] {
				continue
			}

			round++
			match := core.NewRecord(fixtures)
			match.Set("tournament", stage.GetString("tournament"))
			match.Set("stage", stage.Id)
			match.Set("pool", pool.Id)
			match.Set("round", round)
			match.Set("position", 0)
			match.Set("code", fmt.Sprintf("%s%d.1", pool.GetString("name"), round+1))
			// Sides alternate down the list, and flip on the return leg — so a
			// team joining a pool of five is not at home five times running,
			// and a two-leg league still plays each pair once each way.
			if (leg+index)%2 == 0 {
				match.Set("home_slot", seat.Id)
				match.Set("home_entry", entry.Id)
				match.Set("away_slot", opponent.Id)
				match.Set("away_entry", opponentID)
			} else {
				match.Set("home_slot", opponent.Id)
				match.Set("home_entry", opponentID)
				match.Set("away_slot", seat.Id)
				match.Set("away_entry", entry.Id)
			}
			match.Set("status", "ready")
			if err := app.Save(match); err != nil {
				return admission, err
			}
			written++
		}
	}

	admission.Action = admitPool
	admission.Pool = pool.Id
	admission.Fixtures = written
	return admission, nil
}

// admitToField adds a team to a Swiss stage, which is a seat in the table and
// nothing else.
//
// No fixtures are written here. A Swiss round is a function of the table at
// the end of the round before it, so the next draw picks them up on its own —
// including a round that has been drawn and not yet played, which PairNextRound
// redraws whenever the field it was drawn from has changed.
//
// They start on nothing, which is the only defensible answer: a team that
// arrives in round three has not earned the points of the teams that played
// rounds one and two, and seeding them anywhere else would be inventing a
// result. In practice it means they meet the bottom of the table first, which
// is what a Swiss pairing is for.
func admitToField(
	app core.App, stage, pool *core.Record, entry *core.Record,
) (Admission, error) {
	admission := Admission{
		Stage: stage.Id, Name: stage.GetString("name"), Action: admitWaiting,
	}

	slots, err := poolSlots(app, pool)
	if err != nil {
		return admission, err
	}
	position := 0
	seats := 0
	for _, slot := range slots {
		if slot.GetInt("position") >= position {
			position = slot.GetInt("position") + 1
		}
		if slot.GetString("source_type") != "bye" {
			seats++
		}
	}

	collection, err := app.FindCollectionByNameOrId("slots")
	if err != nil {
		return admission, err
	}
	seat := core.NewRecord(collection)
	seat.Set("stage", stage.Id)
	seat.Set("pool", pool.Id)
	seat.Set("round", 0)
	seat.Set("position", position)
	seat.Set("entry", entry.Id)
	seat.Set("source_type", "direct")
	seat.Set("source_position", seats+1)
	label := swissSeedLabel(seats + 1)
	seat.Set("label", label.Text)
	seat.Set("label_kind", label.Kind)
	seat.Set("label_args", label.Args)
	if err := app.Save(seat); err != nil {
		return admission, err
	}

	admission.Action = admitField
	admission.Pool = pool.Id
	return admission, nil
}

// redrawBracket draws a knockout stage again with the newcomer in it.
//
// There is no other way in: a bracket has as many positions as it was drawn
// with, and the ninth team is not one of them. lateEntryFault has already
// established that nobody has played, so what is thrown away is a draw and a
// set of court assignments rather than a result — and the organiser asked for
// exactly this by adding a team to a tournament that has not started.
func redrawBracket(app core.App, stage, entry *core.Record) (Admission, error) {
	admission := Admission{
		Stage: stage.Id, Name: stage.GetString("name"), Action: admitWaiting,
	}

	plan, err := PlanStage(app, stage)
	if err != nil {
		return admission, err
	}
	if err := CommitPlan(app, stage, plan); err != nil {
		return admission, err
	}
	if _, err := ResolveStage(app, stage.Id); err != nil {
		return admission, err
	}

	admission.Action = admitRedrawn
	admission.Fixtures = len(plan.Fixtures)
	return admission, nil
}

// poolSlots is a pool's starting positions, in the order they were drawn.
func poolSlots(app core.App, pool *core.Record) ([]*core.Record, error) {
	return app.FindRecordsByFilter(
		"slots", "pool = {:pool} && round = 0", "position", 0, 0,
		dbx.Params{"pool": pool.Id},
	)
}

// filledSlots keeps the ones holding somebody: a bye is a chair, not a team.
func filledSlots(slots []*core.Record) []*core.Record {
	filled := make([]*core.Record, 0, len(slots))
	for _, slot := range slots {
		if slot.GetString("entry") != "" {
			filled = append(filled, slot)
		}
	}
	return filled
}

// lastRound is the highest round number a pool already holds, or -1 for a pool
// with no fixtures in it at all.
func lastRound(app core.App, pool *core.Record) (int, error) {
	fixtures, err := app.FindRecordsByFilter(
		"fixtures", "pool = {:pool}", "-round", 1, 0,
		dbx.Params{"pool": pool.Id},
	)
	if err != nil {
		return 0, err
	}
	if len(fixtures) == 0 {
		return -1, nil
	}
	return fixtures[0].GetInt("round"), nil
}
