package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Whistle.day — initial schema.
//
// Core idea: a tournament is an ORDERED LIST OF STAGES. Each stage has its own
// format, so "groups then playoff" and "playoff then groups" are the same
// structure with a different position.
//
// Placeholders are first-class: a slot is a fillable position that may not know
// its participant yet ("Winner of QF1", "1st of Pool A"). That is what lets a
// full bracket be drawn and projected before a single ball is played.
//
// Naming note: group, order, match, index, key, rank and filter are all SQLite
// keywords and all natural in this domain. They are deliberately avoided at the
// storage layer — see docs/DATA-MODEL.md for the mapping.

// builder threads the first error through a long chain of schema calls so the
// migration body stays readable.
type builder struct {
	app core.App
	err error
}

func (b *builder) collectionID(name string) string {
	if b.err != nil {
		return ""
	}
	c, err := b.app.FindCollectionByNameOrId(name)
	if err != nil {
		b.err = err
		return ""
	}
	return c.Id
}

func (b *builder) rel(name, target string, required, cascade bool) *core.RelationField {
	return &core.RelationField{
		Name:          name,
		Required:      required,
		CascadeDelete: cascade,
		MaxSelect:     1,
		CollectionId:  b.collectionID(target),
	}
}

func (b *builder) save(c *core.Collection) {
	if b.err != nil {
		return
	}
	b.err = b.app.Save(c)
}

func txt(name string, required bool, max int) *core.TextField {
	return &core.TextField{Name: name, Required: required, Max: max}
}

// num builds an integer field.
//
// Careful with required: PocketBase validates a required number field as
// "not blank", and 0 counts as blank. Every zero-based ordering column here
// (stage/pool position, slot and fixture round/position) therefore has to be
// optional. The unique indexes are what actually protect ordering.
func num(name string, required bool) *core.NumberField {
	return &core.NumberField{Name: name, Required: required, OnlyInt: true}
}

func sel(name string, required bool, values ...string) *core.SelectField {
	return &core.SelectField{Name: name, Required: required, MaxSelect: 1, Values: values}
}

func jsn(name string) *core.JSONField { return &core.JSONField{Name: name, MaxSize: 200000} }
func bln(name string) *core.BoolField { return &core.BoolField{Name: name} }
func dt(name string) *core.DateField  { return &core.DateField{Name: name} }

func img(name string, maxSize int64) *core.FileField {
	return &core.FileField{
		Name:      name,
		MaxSelect: 1,
		MaxSize:   maxSize,
		MimeTypes: []string{"image/png", "image/jpeg", "image/svg+xml", "image/webp"},
	}
}

func stamps(c *core.Collection) {
	c.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
	c.Fields.Add(&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true})
}

// staffOnly builds a write rule. prefix is the relation path from the current
// collection to the owning tournament ("" when we ARE the tournament).
func staffOnly(prefix string) string {
	p := ""
	if prefix != "" {
		p = prefix + "."
	}
	return "@request.auth.id != '' && (" + p + "owner = @request.auth.id || " +
		p + "staff_via_tournament.user ?= @request.auth.id)"
}

func publicOrStaff(prefix string) string {
	p := ""
	if prefix != "" {
		p = prefix + "."
	}
	return p + "status != 'draft' || (" + staffOnly(prefix) + ")"
}

func init() {
	m.Register(func(app core.App) error {
		b := &builder{app: app}

		// ------------------------------------------------------------------
		// 1. tournaments
		//
		// Rules that reference the staff back-relation cannot be set yet:
		// PocketBase validates them on save, and `staff` does not exist. The
		// collection is created owner-only and patched in step 3.
		// ------------------------------------------------------------------
		tournaments := core.NewBaseCollection("tournaments")
		ownerOnly := "@request.auth.id != '' && owner = @request.auth.id"
		tournaments.ListRule = types.Pointer("status != 'draft' || (" + ownerOnly + ")")
		tournaments.ViewRule = types.Pointer("status != 'draft' || (" + ownerOnly + ")")
		tournaments.CreateRule = types.Pointer("@request.auth.id != ''")
		tournaments.UpdateRule = types.Pointer(ownerOnly)
		tournaments.DeleteRule = types.Pointer(ownerOnly)
		tournaments.Fields.Add(
			txt("name", true, 120),
			txt("slug", true, 60),
			txt("sport", false, 60),
			txt("location", false, 200),
			dt("starts_on"),
			dt("ends_on"),
			sel("status", true, "draft", "published", "live", "finished", "archived"),
			b.rel("owner", "users", true, false),
			img("logo", 5242880),
			// { bestOf, pointsPerSet, winBy, pointsWin, pointsDraw, pointsLoss,
			//   walkoverScore, drawsAllowed, tiebreakers }
			jsn("scoring"),
			// { timezone, public_results, allow_self_registration }
			jsn("settings"),
		)
		stamps(tournaments)
		tournaments.AddIndex("idx_tournaments_slug", true, "slug", "")
		tournaments.AddIndex("idx_tournaments_owner", false, "owner", "")
		b.save(tournaments)

		// ------------------------------------------------------------------
		// 2. staff — who may operate a tournament
		// ------------------------------------------------------------------
		staff := core.NewBaseCollection("staff")
		staffSelf := "@request.auth.id != '' && (tournament.owner = @request.auth.id || user = @request.auth.id)"
		staffOwner := "@request.auth.id != '' && tournament.owner = @request.auth.id"
		staff.ListRule = types.Pointer(staffSelf)
		staff.ViewRule = types.Pointer(staffSelf)
		staff.CreateRule = types.Pointer(staffOwner)
		staff.UpdateRule = types.Pointer(staffOwner)
		staff.DeleteRule = types.Pointer(staffOwner)
		staff.Fields.Add(
			b.rel("tournament", "tournaments", true, true),
			b.rel("user", "users", true, true),
			sel("role", true, "organizer", "referee", "scorer"),
		)
		stamps(staff)
		staff.AddIndex("idx_staff_unique", true, "tournament, user", "")
		b.save(staff)

		// ------------------------------------------------------------------
		// 3. now that `staff` exists, the back-relation resolves
		// ------------------------------------------------------------------
		if b.err == nil {
			tournaments, err := app.FindCollectionByNameOrId("tournaments")
			if err != nil {
				return err
			}
			tournaments.ListRule = types.Pointer(publicOrStaff(""))
			tournaments.ViewRule = types.Pointer(publicOrStaff(""))
			tournaments.UpdateRule = types.Pointer(staffOnly(""))
			b.save(tournaments)
		}

		// ------------------------------------------------------------------
		// 4. courts — physical playing areas, used by schedule + projector
		// ------------------------------------------------------------------
		courts := core.NewBaseCollection("courts")
		courts.ListRule = types.Pointer(publicOrStaff("tournament"))
		courts.ViewRule = types.Pointer(publicOrStaff("tournament"))
		courts.CreateRule = types.Pointer(staffOnly("tournament"))
		courts.UpdateRule = types.Pointer(staffOnly("tournament"))
		courts.DeleteRule = types.Pointer(staffOnly("tournament"))
		courts.Fields.Add(
			b.rel("tournament", "tournaments", true, true),
			txt("name", true, 60),
			num("position", false),
			bln("active"),
		)
		stamps(courts)
		courts.AddIndex("idx_courts_name", true, "tournament, name", "")
		b.save(courts)

		// ------------------------------------------------------------------
		// 5. entries — a participant (team OR solo player)
		// ------------------------------------------------------------------
		entries := core.NewBaseCollection("entries")
		entries.ListRule = types.Pointer(publicOrStaff("tournament"))
		entries.ViewRule = types.Pointer(publicOrStaff("tournament"))
		entries.CreateRule = types.Pointer(staffOnly("tournament"))
		entries.UpdateRule = types.Pointer(staffOnly("tournament"))
		entries.DeleteRule = types.Pointer(staffOnly("tournament"))
		entries.Fields.Add(
			b.rel("tournament", "tournaments", true, true),
			txt("name", true, 120),
			// short_name is what the projector renders — long names wreck layouts
			txt("short_name", false, 16),
			txt("club", false, 120),
			txt("contact", false, 200),
			num("seed", false),
			sel("status", true, "registered", "checked_in", "active", "withdrawn", "disqualified"),
			img("logo", 2097152),
			jsn("members"),
		)
		stamps(entries)
		entries.AddIndex("idx_entries_tournament", false, "tournament", "")
		entries.AddIndex("idx_entries_seed", false, "tournament, seed", "")
		b.save(entries)

		// ------------------------------------------------------------------
		// 6. stages — THE ordering primitive
		// ------------------------------------------------------------------
		stages := core.NewBaseCollection("stages")
		stages.ListRule = types.Pointer(publicOrStaff("tournament"))
		stages.ViewRule = types.Pointer(publicOrStaff("tournament"))
		stages.CreateRule = types.Pointer(staffOnly("tournament"))
		stages.UpdateRule = types.Pointer(staffOnly("tournament"))
		stages.DeleteRule = types.Pointer(staffOnly("tournament"))
		stages.Fields.Add(
			b.rel("tournament", "tournaments", true, true),
			num("position", false),
			txt("name", true, 80),
			sel("format", true, "round_robin", "single_elim", "double_elim", "swiss", "ladder"),
			sel("status", true, "draft", "seeded", "live", "finished"),
			// round_robin: { poolCount, legs, advancePerPool }
			// single_elim: { thirdPlace, legs, consolation }
			// swiss:       { rounds, pairing }
			jsn("config"),
		)
		stamps(stages)
		stages.AddIndex("idx_stages_position", true, "tournament, position", "")
		b.save(stages)

		// ------------------------------------------------------------------
		// 7. pools — a self-contained sub-competition inside a stage: one
		//    round-robin group, or one side of a double-elimination bracket.
		//    (Named "pool" because GROUP is a SQL keyword.)
		// ------------------------------------------------------------------
		pools := core.NewBaseCollection("pools")
		pools.ListRule = types.Pointer(publicOrStaff("stage.tournament"))
		pools.ViewRule = types.Pointer(publicOrStaff("stage.tournament"))
		pools.CreateRule = types.Pointer(staffOnly("stage.tournament"))
		pools.UpdateRule = types.Pointer(staffOnly("stage.tournament"))
		pools.DeleteRule = types.Pointer(staffOnly("stage.tournament"))
		pools.Fields.Add(
			b.rel("stage", "stages", true, true),
			txt("name", true, 60),
			num("position", false),
			sel("kind", true, "group", "winners", "losers", "final", "consolation"),
			num("advance_count", false),
		)
		stamps(pools)
		pools.AddIndex("idx_pools_name", true, "stage, name", "")
		b.save(pools)

		// ------------------------------------------------------------------
		// 8. slots — a fillable position. `entry` stays null until the source
		//    resolves. source_fixture is added in step 10, once fixtures exist.
		// ------------------------------------------------------------------
		slots := core.NewBaseCollection("slots")
		slots.ListRule = types.Pointer(publicOrStaff("stage.tournament"))
		slots.ViewRule = types.Pointer(publicOrStaff("stage.tournament"))
		slots.CreateRule = types.Pointer(staffOnly("stage.tournament"))
		slots.UpdateRule = types.Pointer(staffOnly("stage.tournament"))
		slots.DeleteRule = types.Pointer(staffOnly("stage.tournament"))
		slots.Fields.Add(
			b.rel("stage", "stages", true, true),
			b.rel("pool", "pools", false, true),
			num("round", false),
			num("position", false),
			// shown while unresolved: "Winner QF1", "1. A", "Bye"
			txt("label", false, 60),
			b.rel("entry", "entries", false, false),
			sel("source_type", true,
				"direct", "fixture_winner", "fixture_loser", "pool_rank", "stage_rank", "bye"),
			b.rel("source_pool", "pools", false, false),
			b.rel("source_stage", "stages", false, false),
			num("source_position", false),
		)
		stamps(slots)
		slots.AddIndex("idx_slots_position", true, "stage, COALESCE(pool, ''), round, position", "")
		slots.AddIndex("idx_slots_entry", false, "entry", "")
		b.save(slots)

		// ------------------------------------------------------------------
		// 9. fixtures — one match. home_entry/away_entry are denormalised from
		//    the slots so the projector reads everything in ONE request with a
		//    single level of expand. The slot is authoritative; these are cache.
		// ------------------------------------------------------------------
		fixtures := core.NewBaseCollection("fixtures")
		fixtures.ListRule = types.Pointer(publicOrStaff("tournament"))
		fixtures.ViewRule = types.Pointer(publicOrStaff("tournament"))
		fixtures.CreateRule = types.Pointer(staffOnly("tournament"))
		fixtures.UpdateRule = types.Pointer(staffOnly("tournament"))
		fixtures.DeleteRule = types.Pointer(staffOnly("tournament"))
		fixtures.Fields.Add(
			b.rel("tournament", "tournaments", true, true),
			b.rel("stage", "stages", true, true),
			b.rel("pool", "pools", false, true),
			num("round", false),
			num("position", false),
			// human handle shouted across the hall and printed on sheets
			txt("code", false, 16),
			b.rel("home_slot", "slots", false, false),
			b.rel("away_slot", "slots", false, false),
			b.rel("home_entry", "entries", false, false),
			b.rel("away_entry", "entries", false, false),
			sel("status", true,
				"pending", "ready", "live", "finished", "walkover", "bye", "cancelled"),
			num("home_score", false),
			num("away_score", false),
			b.rel("winner", "entries", false, false),
			b.rel("loser", "entries", false, false),
			b.rel("court", "courts", false, false),
			b.rel("referee", "users", false, false),
			dt("scheduled_at"),
			dt("started_at"),
			dt("finished_at"),
			// once true the engine refuses to overwrite the result
			bln("locked"),
			txt("notes", false, 500),
		)
		stamps(fixtures)
		// Pool must be part of the key: in a group stage, pool A and pool B both
		// have a fixture at round 0 position 0.
		fixtures.AddIndex("idx_fixtures_position", true, "stage, COALESCE(pool, ''), round, position", "")
		fixtures.AddIndex("idx_fixtures_board", false, "tournament, status", "")
		fixtures.AddIndex("idx_fixtures_schedule", false, "court, scheduled_at", "")
		b.save(fixtures)

		// ------------------------------------------------------------------
		// 10. close the slots <-> fixtures cycle
		// ------------------------------------------------------------------
		if b.err == nil {
			slots, err := app.FindCollectionByNameOrId("slots")
			if err != nil {
				return err
			}
			slots.Fields.Add(b.rel("source_fixture", "fixtures", false, false))
			slots.AddIndex("idx_slots_source_fixture", false, "source_fixture", "")
			b.save(slots)
		}

		// ------------------------------------------------------------------
		// 11. games — individual sets / legs / maps inside a fixture
		// ------------------------------------------------------------------
		games := core.NewBaseCollection("games")
		games.ListRule = types.Pointer(publicOrStaff("fixture.tournament"))
		games.ViewRule = types.Pointer(publicOrStaff("fixture.tournament"))
		games.CreateRule = types.Pointer(staffOnly("fixture.tournament"))
		games.UpdateRule = types.Pointer(staffOnly("fixture.tournament"))
		games.DeleteRule = types.Pointer(staffOnly("fixture.tournament"))
		games.Fields.Add(
			b.rel("fixture", "fixtures", true, true),
			num("number", true),
			num("home_score", false),
			num("away_score", false),
			bln("finished"),
		)
		stamps(games)
		games.AddIndex("idx_games_number", true, "fixture, number", "")
		b.save(games)

		// ------------------------------------------------------------------
		// 12. standings — MATERIALISED, not a SQL view. Head-to-head tiebreaks
		//     are not expressible in SQL, so the engine recomputes and writes.
		//     Write rules stay nil: only hooks and superusers may touch it.
		// ------------------------------------------------------------------
		standings := core.NewBaseCollection("standings")
		standings.ListRule = types.Pointer(publicOrStaff("stage.tournament"))
		standings.ViewRule = types.Pointer(publicOrStaff("stage.tournament"))
		standings.Fields.Add(
			b.rel("stage", "stages", true, true),
			b.rel("pool", "pools", false, true),
			b.rel("entry", "entries", true, true),
			num("position", true),
			num("played", false),
			num("won", false),
			num("drawn", false),
			num("lost", false),
			// sets (or goals)
			num("score_for", false),
			num("score_against", false),
			// points inside sets — the usual second-level tiebreak
			num("sub_for", false),
			num("sub_against", false),
			num("points", false),
			// audit trail: which criteria were applied, in order
			jsn("tiebreak"),
			bln("qualified"),
		)
		stamps(standings)
		standings.AddIndex("idx_standings_entry", true, "stage, COALESCE(pool, ''), entry", "")
		standings.AddIndex("idx_standings_position", false, "stage, position", "")
		b.save(standings)

		// ------------------------------------------------------------------
		// 13. displays — a projector screen. The unguessable URL token is the
		//     only credential, so it opens on any borrowed laptop.
		// ------------------------------------------------------------------
		displays := core.NewBaseCollection("displays")
		displays.ListRule = types.Pointer("active = true && token = @request.query.token")
		displays.ViewRule = types.Pointer("active = true && token = @request.query.token")
		displays.CreateRule = types.Pointer(staffOnly("tournament"))
		displays.UpdateRule = types.Pointer(staffOnly("tournament"))
		displays.DeleteRule = types.Pointer(staffOnly("tournament"))
		displays.Fields.Add(
			b.rel("tournament", "tournaments", true, true),
			txt("name", false, 60),
			txt("token", true, 64),
			sel("mode", true,
				"auto", "bracket", "standings", "schedule", "now_playing", "results"),
			num("rotate_seconds", false),
			// narrow what this screen shows: { stage, pool, court }
			jsn("scope"),
			// { accent, logo, sponsors: [] }
			jsn("theme"),
			bln("active"),
		)
		stamps(displays)
		displays.AddIndex("idx_displays_token", true, "token", "")
		b.save(displays)

		return b.err
	}, func(app core.App) error {
		// down — reverse dependency order
		names := []string{
			"displays", "standings", "games", "fixtures", "slots",
			"pools", "stages", "entries", "courts", "staff", "tournaments",
		}
		for _, name := range names {
			c, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				continue // already gone
			}
			if err := app.Delete(c); err != nil {
				return err
			}
		}
		return nil
	})
}
