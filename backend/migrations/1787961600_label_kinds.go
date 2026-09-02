package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Saying "Winner QF1" in a language other than the one it was written in.
//
// A bracket is drawn before it is played, and the empty half of it is drawn
// from `slots.label` — "Winner QF1", "Loser SF2", "1. A", "Bye". Those strings
// are composed in Go at the moment a stage is generated and stored as English
// prose, which was fine while there was one language and is a dead end the
// moment there are two: the projector in the hall cannot translate a sentence,
// only look one up.
//
// So the wording moves to the client and what is stored becomes the facts it
// is composed from.
//
//   - **slots.label_kind** is which sentence this is — `winner_of`, `loser_of`,
//     `pool_rank`, `best_of_rank`, `bye`. A short, closed vocabulary; the
//     catalogue on the other end has one entry per value.
//   - **slots.label_args** is what goes in the gaps: `{"code": "QF1"}`,
//     `{"rank": 1, "pool": "A"}`. JSON rather than columns because the
//     arguments differ per kind and there are only ever one or two.
//
// `label` stays, and stays first. It is what a tournament generated before
// today still has, what a screen falls back to when it meets a kind it does
// not know, and what anything reading the database directly — an export, a
// support query — can still read without a lookup table.
//
// **pools.name_kind** and **stages.name_kind** are the same move for the two
// other names the app writes on somebody's behalf. A pool called "Winners" and
// a stage called "Groups" were never the organiser's words; a pool called "A"
// is the same in every language and carries no kind at all, and neither does a
// tournament, team or court name, which are typed by a person and are not ours
// to translate.
func init() {
	m.Register(func(app core.App) error {
		slots, err := app.FindCollectionByNameOrId("slots")
		if err != nil {
			return err
		}
		slots.Fields.Add(
			// Optional: every slot written before today has a label and no
			// kind, and that is a slot that renders from its label.
			&core.TextField{Name: "label_kind", Max: 40},
			&core.JSONField{Name: "label_args", MaxSize: 512},
		)
		if err := app.Save(slots); err != nil {
			return err
		}

		pools, err := app.FindCollectionByNameOrId("pools")
		if err != nil {
			return err
		}
		pools.Fields.Add(&core.TextField{Name: "name_kind", Max: 40})
		if err := app.Save(pools); err != nil {
			return err
		}

		stages, err := app.FindCollectionByNameOrId("stages")
		if err != nil {
			return err
		}
		stages.Fields.Add(&core.TextField{Name: "name_kind", Max: 40})
		return app.Save(stages)
	}, func(app core.App) error {
		if slots, err := app.FindCollectionByNameOrId("slots"); err == nil {
			slots.Fields.RemoveByName("label_kind")
			slots.Fields.RemoveByName("label_args")
			if err := app.Save(slots); err != nil {
				return err
			}
		}
		if pools, err := app.FindCollectionByNameOrId("pools"); err == nil {
			pools.Fields.RemoveByName("name_kind")
			if err := app.Save(pools); err != nil {
				return err
			}
		}
		if stages, err := app.FindCollectionByNameOrId("stages"); err == nil {
			stages.Fields.RemoveByName("name_kind")
			return app.Save(stages)
		}
		return nil
	})
}
