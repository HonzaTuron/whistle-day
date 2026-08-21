/// <reference path="../pb_data/types.d.ts" />

/**
 * Seedly — initial schema.
 *
 * Core idea: a tournament is an ORDERED LIST OF STAGES. Each stage has its own
 * format (round robin / single elim / ...), so "groups then playoff" and
 * "playoff then groups" are the same structure with a different `position`.
 *
 * Placeholders are first-class: a `slot` is a fillable position that may not
 * know its participant yet ("Winner of QF1", "1st of Pool A"). That is what
 * lets you draw and project a full bracket before a single ball is played.
 *
 * Naming note: several obvious names (group, order, match, index, key, rank,
 * filter) are SQLite keywords. They are deliberately avoided at the storage
 * layer -- see docs/DATA-MODEL.md.
 */
migrate(
  function (app) {
    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------
    function rel(name, target, opts) {
      opts = opts || {};
      return {
        type: "relation",
        name: name,
        required: !!opts.required,
        cascadeDelete: !!opts.cascade,
        maxSelect: 1,
        collectionId: app.findCollectionByNameOrId(target).id,
      };
    }
    function txt(name, opts) {
      opts = opts || {};
      return {
        type: "text",
        name: name,
        required: !!opts.required,
        max: opts.max || 255,
      };
    }
    function num(name, opts) {
      opts = opts || {};
      return {
        type: "number",
        name: name,
        required: !!opts.required,
        onlyInt: true,
      };
    }
    function sel(name, values, opts) {
      opts = opts || {};
      return {
        type: "select",
        name: name,
        required: !!opts.required,
        maxSelect: 1,
        values: values,
      };
    }
    function jsn(name) {
      return { type: "json", name: name, maxSize: 200000 };
    }
    function bln(name) {
      return { type: "bool", name: name };
    }
    function dt(name) {
      return { type: "date", name: name };
    }
    function stamps() {
      return [
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ];
    }
    function fields() {
      var out = [];
      for (var i = 0; i < arguments.length; i++) {
        var a = arguments[i];
        if (Object.prototype.toString.call(a) === "[object Array]") {
          for (var j = 0; j < a.length; j++) out.push(a[j]);
        } else {
          out.push(a);
        }
      }
      return out;
    }

    // Rule fragments. `prefix` is the relation path from this collection to
    // the owning tournament ("" when we ARE the tournament).
    function staffOnly(prefix) {
      var p = prefix ? prefix + "." : "";
      return (
        "@request.auth.id != '' && (" +
        p +
        "owner = @request.auth.id || " +
        p +
        "staff_via_tournament.user ?= @request.auth.id)"
      );
    }
    function publicOrStaff(prefix) {
      var p = prefix ? prefix + "." : "";
      return p + "status != 'draft' || (" + staffOnly(prefix) + ")";
    }

    // ------------------------------------------------------------------
    // 1. tournaments
    // ------------------------------------------------------------------
    app.save(
      new Collection({
        type: "base",
        name: "tournaments",
        listRule: publicOrStaff(""),
        viewRule: publicOrStaff(""),
        createRule: "@request.auth.id != ''",
        updateRule: staffOnly(""),
        deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
        fields: fields(
          txt("name", { required: true, max: 120 }),
          txt("slug", { required: true, max: 60 }),
          txt("sport", { max: 60 }),
          txt("location", { max: 200 }),
          dt("starts_on"),
          dt("ends_on"),
          sel("status", ["draft", "published", "live", "finished", "archived"], {
            required: true,
          }),
          rel("owner", "users", { required: true }),
          { type: "file", name: "logo", maxSelect: 1, maxSize: 5242880,
            mimeTypes: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] },
          // { best_of, points_per_set, win_by, points_win, points_draw, points_loss }
          jsn("scoring"),
          // { timezone, public_results, allow_self_registration }
          jsn("settings"),
          stamps()
        ),
        indexes: [
          "CREATE UNIQUE INDEX idx_tournaments_slug ON tournaments (slug)",
          "CREATE INDEX idx_tournaments_owner ON tournaments (owner)",
        ],
      })
    );

    // ------------------------------------------------------------------
    // 2. staff -- who may operate a tournament
    // ------------------------------------------------------------------
    app.save(
      new Collection({
        type: "base",
        name: "staff",
        listRule:
          "@request.auth.id != '' && (tournament.owner = @request.auth.id || user = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && (tournament.owner = @request.auth.id || user = @request.auth.id)",
        createRule: "@request.auth.id != '' && tournament.owner = @request.auth.id",
        updateRule: "@request.auth.id != '' && tournament.owner = @request.auth.id",
        deleteRule: "@request.auth.id != '' && tournament.owner = @request.auth.id",
        fields: fields(
          rel("tournament", "tournaments", { required: true, cascade: true }),
          rel("user", "users", { required: true, cascade: true }),
          sel("role", ["organizer", "referee", "scorer"], { required: true }),
          stamps()
        ),
        indexes: [
          "CREATE UNIQUE INDEX idx_staff_unique ON staff (tournament, user)",
        ],
      })
    );

    // ------------------------------------------------------------------
    // 3. courts -- physical playing areas, used by the schedule + projector
    // ------------------------------------------------------------------
    app.save(
      new Collection({
        type: "base",
        name: "courts",
        listRule: publicOrStaff("tournament"),
        viewRule: publicOrStaff("tournament"),
        createRule: staffOnly("tournament"),
        updateRule: staffOnly("tournament"),
        deleteRule: staffOnly("tournament"),
        fields: fields(
          rel("tournament", "tournaments", { required: true, cascade: true }),
          txt("name", { required: true, max: 60 }),
          num("position"),
          bln("active"),
          stamps()
        ),
        indexes: [
          "CREATE UNIQUE INDEX idx_courts_name ON courts (tournament, name)",
        ],
      })
    );

    // ------------------------------------------------------------------
    // 4. entries -- a participant (team OR solo player) in a tournament
    // ------------------------------------------------------------------
    app.save(
      new Collection({
        type: "base",
        name: "entries",
        listRule: publicOrStaff("tournament"),
        viewRule: publicOrStaff("tournament"),
        createRule: staffOnly("tournament"),
        updateRule: staffOnly("tournament"),
        deleteRule: staffOnly("tournament"),
        fields: fields(
          rel("tournament", "tournaments", { required: true, cascade: true }),
          txt("name", { required: true, max: 120 }),
          // short_name is what the projector shows -- long names wreck layouts
          txt("short_name", { max: 16 }),
          txt("club", { max: 120 }),
          txt("contact", { max: 200 }),
          num("seed"),
          sel(
            "status",
            ["registered", "checked_in", "active", "withdrawn", "disqualified"],
            { required: true }
          ),
          { type: "file", name: "logo", maxSelect: 1, maxSize: 2097152,
            mimeTypes: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] },
          jsn("members"),
          stamps()
        ),
        indexes: [
          "CREATE INDEX idx_entries_tournament ON entries (tournament)",
          "CREATE INDEX idx_entries_seed ON entries (tournament, seed)",
        ],
      })
    );

    // ------------------------------------------------------------------
    // 5. stages -- THE ordering primitive. Groups-first vs playoff-first is
    //    nothing more than a different `position`.
    // ------------------------------------------------------------------
    app.save(
      new Collection({
        type: "base",
        name: "stages",
        listRule: publicOrStaff("tournament"),
        viewRule: publicOrStaff("tournament"),
        createRule: staffOnly("tournament"),
        updateRule: staffOnly("tournament"),
        deleteRule: staffOnly("tournament"),
        fields: fields(
          rel("tournament", "tournaments", { required: true, cascade: true }),
          num("position", { required: true }),
          txt("name", { required: true, max: 80 }),
          sel(
            "format",
            ["round_robin", "single_elim", "double_elim", "swiss", "ladder"],
            { required: true }
          ),
          sel("status", ["draft", "seeded", "live", "finished"], { required: true }),
          // format-specific knobs, e.g.
          //   round_robin:  { pool_count, legs, advance_per_pool }
          //   single_elim:  { third_place, legs, consolation }
          //   swiss:        { rounds, pairing }
          jsn("config"),
          stamps()
        ),
        indexes: [
          "CREATE UNIQUE INDEX idx_stages_position ON stages (tournament, position)",
        ],
      })
    );

    // ------------------------------------------------------------------
    // 6. pools -- a self-contained sub-competition inside a stage: one
    //    round-robin group, or one side of a double-elimination bracket.
    //    (Named "pool" not "group" because GROUP is a SQL keyword.)
    // ------------------------------------------------------------------
    app.save(
      new Collection({
        type: "base",
        name: "pools",
        listRule: publicOrStaff("stage.tournament"),
        viewRule: publicOrStaff("stage.tournament"),
        createRule: staffOnly("stage.tournament"),
        updateRule: staffOnly("stage.tournament"),
        deleteRule: staffOnly("stage.tournament"),
        fields: fields(
          rel("stage", "stages", { required: true, cascade: true }),
          txt("name", { required: true, max: 60 }),
          num("position", { required: true }),
          sel("kind", ["group", "winners", "losers", "final", "consolation"], {
            required: true,
          }),
          num("advance_count"),
          stamps()
        ),
        indexes: [
          "CREATE UNIQUE INDEX idx_pools_name ON pools (stage, name)",
        ],
      })
    );

    // ------------------------------------------------------------------
    // 7. slots -- a fillable position. `entry` is null until the source
    //    resolves. This is the table that makes empty brackets projectable.
    //    (source_fixture is added below, once `fixtures` exists.)
    // ------------------------------------------------------------------
    app.save(
      new Collection({
        type: "base",
        name: "slots",
        listRule: publicOrStaff("stage.tournament"),
        viewRule: publicOrStaff("stage.tournament"),
        createRule: staffOnly("stage.tournament"),
        updateRule: staffOnly("stage.tournament"),
        deleteRule: staffOnly("stage.tournament"),
        fields: fields(
          rel("stage", "stages", { required: true, cascade: true }),
          rel("pool", "pools", { cascade: true }),
          num("round", { required: true }),
          num("position", { required: true }),
          // shown while unresolved: "Winner QF1", "1. A", "Bye"
          txt("label", { max: 60 }),
          rel("entry", "entries"),
          sel(
            "source_type",
            ["direct", "fixture_winner", "fixture_loser", "pool_rank", "stage_rank", "bye"],
            { required: true }
          ),
          rel("source_pool", "pools"),
          rel("source_stage", "stages"),
          num("source_position"),
          stamps()
        ),
        indexes: [
          "CREATE UNIQUE INDEX idx_slots_position ON slots (stage, COALESCE(pool, ''), round, position)",
          "CREATE INDEX idx_slots_entry ON slots (entry)",
        ],
      })
    );

    // ------------------------------------------------------------------
    // 8. fixtures -- one match. home_entry/away_entry are denormalised from
    //    the slots so the projector can read everything in ONE request with
    //    a single level of expand.
    // ------------------------------------------------------------------
    app.save(
      new Collection({
        type: "base",
        name: "fixtures",
        listRule: publicOrStaff("tournament"),
        viewRule: publicOrStaff("tournament"),
        createRule: staffOnly("tournament"),
        updateRule: staffOnly("tournament"),
        deleteRule: staffOnly("tournament"),
        fields: fields(
          rel("tournament", "tournaments", { required: true, cascade: true }),
          rel("stage", "stages", { required: true, cascade: true }),
          rel("pool", "pools", { cascade: true }),
          num("round", { required: true }),
          num("position", { required: true }),
          // human handle shown on the projector and on printed sheets
          txt("code", { max: 16 }),
          rel("home_slot", "slots"),
          rel("away_slot", "slots"),
          rel("home_entry", "entries"),
          rel("away_entry", "entries"),
          sel(
            "status",
            ["pending", "ready", "live", "finished", "walkover", "bye", "cancelled"],
            { required: true }
          ),
          num("home_score"),
          num("away_score"),
          rel("winner", "entries"),
          rel("loser", "entries"),
          rel("court", "courts"),
          rel("referee", "users"),
          dt("scheduled_at"),
          dt("started_at"),
          dt("finished_at"),
          // once true the engine refuses to overwrite the result
          bln("locked"),
          txt("notes", { max: 500 }),
          stamps()
        ),
        indexes: [
          "CREATE UNIQUE INDEX idx_fixtures_position ON fixtures (stage, round, position)",
          "CREATE INDEX idx_fixtures_board ON fixtures (tournament, status)",
          "CREATE INDEX idx_fixtures_schedule ON fixtures (court, scheduled_at)",
        ],
      })
    );

    // ---- close the slots <-> fixtures cycle ----
    var slots = app.findCollectionByNameOrId("slots");
    slots.fields.add(
      new RelationField({
        name: "source_fixture",
        collectionId: app.findCollectionByNameOrId("fixtures").id,
        maxSelect: 1,
        required: false,
        cascadeDelete: false,
      })
    );
    app.save(slots);

    // ------------------------------------------------------------------
    // 9. games -- individual sets / legs / maps inside a fixture
    // ------------------------------------------------------------------
    app.save(
      new Collection({
        type: "base",
        name: "games",
        listRule: publicOrStaff("fixture.tournament"),
        viewRule: publicOrStaff("fixture.tournament"),
        createRule: staffOnly("fixture.tournament"),
        updateRule: staffOnly("fixture.tournament"),
        deleteRule: staffOnly("fixture.tournament"),
        fields: fields(
          rel("fixture", "fixtures", { required: true, cascade: true }),
          num("number", { required: true }),
          num("home_score"),
          num("away_score"),
          bln("finished"),
          stamps()
        ),
        indexes: [
          "CREATE UNIQUE INDEX idx_games_number ON games (fixture, number)",
        ],
      })
    );

    // ------------------------------------------------------------------
    // 10. standings -- MATERIALISED, not a SQL view. Head-to-head tiebreaks
    //     are not expressible in SQL, so the engine recomputes and writes.
    //     Write rules are null: only hooks/superusers may touch it.
    // ------------------------------------------------------------------
    app.save(
      new Collection({
        type: "base",
        name: "standings",
        listRule: publicOrStaff("stage.tournament"),
        viewRule: publicOrStaff("stage.tournament"),
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: fields(
          rel("stage", "stages", { required: true, cascade: true }),
          rel("pool", "pools", { cascade: true }),
          rel("entry", "entries", { required: true, cascade: true }),
          num("position", { required: true }),
          num("played"),
          num("won"),
          num("drawn"),
          num("lost"),
          // sets (or goals)
          num("score_for"),
          num("score_against"),
          // points inside sets -- the usual second-level tiebreak
          num("sub_for"),
          num("sub_against"),
          num("points"),
          // audit trail: which criteria were applied, in order
          jsn("tiebreak"),
          bln("qualified"),
          stamps()
        ),
        indexes: [
          "CREATE UNIQUE INDEX idx_standings_entry ON standings (stage, COALESCE(pool, ''), entry)",
          "CREATE INDEX idx_standings_position ON standings (stage, position)",
        ],
      })
    );

    // ------------------------------------------------------------------
    // 11. displays -- a projector screen. Auth is the unguessable token in
    //     the URL, so this can be opened on any borrowed laptop.
    // ------------------------------------------------------------------
    app.save(
      new Collection({
        type: "base",
        name: "displays",
        listRule: "active = true && token = @request.query.token",
        viewRule: "active = true && token = @request.query.token",
        createRule: staffOnly("tournament"),
        updateRule: staffOnly("tournament"),
        deleteRule: staffOnly("tournament"),
        fields: fields(
          rel("tournament", "tournaments", { required: true, cascade: true }),
          txt("name", { max: 60 }),
          txt("token", { required: true, max: 64 }),
          sel(
            "mode",
            ["auto", "bracket", "standings", "schedule", "now_playing", "results"],
            { required: true }
          ),
          num("rotate_seconds"),
          // narrow what this screen shows: { stage, pool, court }
          jsn("scope"),
          // { accent, logo, sponsors: [] }
          jsn("theme"),
          bln("active"),
          stamps()
        ),
        indexes: [
          "CREATE UNIQUE INDEX idx_displays_token ON displays (token)",
        ],
      })
    );
  },

  // ---------------------------------------------------------------------
  // down
  // ---------------------------------------------------------------------
  function (app) {
    var names = [
      "displays",
      "standings",
      "games",
      "fixtures",
      "slots",
      "pools",
      "stages",
      "entries",
      "courts",
      "staff",
      "tournaments",
    ];
    for (var i = 0; i < names.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(names[i]));
      } catch (err) {
        // already gone
      }
    }
  }
);
