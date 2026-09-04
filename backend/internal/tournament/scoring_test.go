package tournament

import (
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	_ "whistleday/backend/migrations"
)

// The draw guard is a hook, so the only honest way to ask whether it works is
// to write a fixture and see whether the write is refused. These tests carry a
// real database for that reason, where the rest of the package's do not.
func newScoringApp(t *testing.T) *tests.TestApp {
	t.Helper()
	dir, err := os.MkdirTemp("", "whistleday-scoring-test-*")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	app, err := tests.NewTestApp(dir)
	if err != nil {
		os.RemoveAll(dir)
		t.Fatalf("NewTestApp: %v", err)
	}
	t.Cleanup(func() {
		app.Cleanup()
		os.RemoveAll(dir)
	})
	RegisterHooks(app)
	return app
}

// save writes a record straight through, so a failure is the hook's and not a
// collection rule's.
func save(t *testing.T, app core.App, collection string, fields map[string]any) *core.Record {
	t.Helper()
	c, err := app.FindCollectionByNameOrId(collection)
	if err != nil {
		t.Fatalf("collection %s: %v", collection, err)
	}
	r := core.NewRecord(c)
	for k, v := range fields {
		r.Set(k, v)
	}
	if err := app.Save(r); err != nil {
		t.Fatalf("save %s: %v", collection, err)
	}
	return r
}

// scoringFixture builds a tournament of the given scoring and format, with two
// entries and one fixture between them, and hands back the fixture to finish.
func scoringFixture(t *testing.T, app core.App, scoring, format string) *core.Record {
	t.Helper()

	owner := save(t, app, "users", map[string]any{
		"email": "owner@whistleday.test", "password": "whistledaytest1",
		"passwordConfirm": "whistledaytest1",
	})
	cup := save(t, app, "tournaments", map[string]any{
		"name": "Scoring Cup", "slug": "scoring-cup", "status": "published",
		"owner": owner.Id, "scoring": scoring,
	})
	stage := save(t, app, "stages", map[string]any{
		"tournament": cup.Id, "name": "Stage", "format": format,
		"position": 0, "status": "seeded",
	})
	home := save(t, app, "entries", map[string]any{
		"tournament": cup.Id, "name": "Home", "status": "active", "seed": 1,
	})
	away := save(t, app, "entries", map[string]any{
		"tournament": cup.Id, "name": "Away", "status": "active", "seed": 2,
	})

	return save(t, app, "fixtures", map[string]any{
		"tournament": cup.Id, "stage": stage.Id, "round": 0, "position": 0,
		"code": "M1", "status": "ready", "home_entry": home.Id, "away_entry": away.Id,
	})
}

func TestLevelScoreIsRefusedWhenDrawsAreOff(t *testing.T) {
	cases := []struct {
		name    string
		scoring string
		format  string
		refused bool
	}{
		{
			// The football default, and what every tournament written before
			// the field existed means.
			name:    "draws unset, so a group draw stands",
			scoring: `{"pointsWin":3,"pointsDraw":1}`,
			format:  "round_robin",
			refused: false,
		},
		{
			name:    "draws on explicitly",
			scoring: `{"pointsWin":3,"pointsDraw":1,"drawsAllowed":true}`,
			format:  "round_robin",
			refused: false,
		},
		{
			name:    "draws off, which is what a volleyball day means",
			scoring: `{"pointsWin":2,"pointsLoss":0,"drawsAllowed":false}`,
			format:  "round_robin",
			refused: true,
		},
		{
			// A knockout has to produce somebody for the next round whatever
			// the rulebook says about the group stage.
			name:    "a knockout, even where draws are allowed",
			scoring: `{"pointsWin":3,"pointsDraw":1,"drawsAllowed":true}`,
			format:  "single_elim",
			refused: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := newScoringApp(t)
			f := scoringFixture(t, app, tc.scoring, tc.format)

			f.Set("status", "finished")
			f.Set("home_score", 1)
			f.Set("away_score", 1)
			err := app.Save(f)

			if tc.refused && err == nil {
				t.Fatal("a level score was stored where it cannot happen")
			}
			if !tc.refused && err != nil {
				t.Fatalf("a legal draw was refused: %v", err)
			}
		})
	}
}

// The guard is about level scores only. A tournament without draws still has
// to accept every ordinary result, and an unfinished fixture carries 0-0 all
// morning without that being a draw anybody is claiming.
func TestDrawGuardLeavesEverythingElseAlone(t *testing.T) {
	const noDraws = `{"pointsWin":2,"drawsAllowed":false}`

	t.Run("a decided score", func(t *testing.T) {
		app := newScoringApp(t)
		f := scoringFixture(t, app, noDraws, "round_robin")
		f.Set("status", "finished")
		f.Set("home_score", 2)
		f.Set("away_score", 1)
		if err := app.Save(f); err != nil {
			t.Fatalf("a 2-1 was refused: %v", err)
		}
	})

	t.Run("an unplayed fixture at 0-0", func(t *testing.T) {
		app := newScoringApp(t)
		f := scoringFixture(t, app, noDraws, "round_robin")
		f.Set("status", "live")
		if err := app.Save(f); err != nil {
			t.Fatalf("a live 0-0 was refused: %v", err)
		}
	})

	t.Run("a walkover, which has no score to be level", func(t *testing.T) {
		app := newScoringApp(t)
		f := scoringFixture(t, app, noDraws, "round_robin")
		f.Set("status", "walkover")
		f.Set("winner", f.GetString("home_entry"))
		if err := app.Save(f); err != nil {
			t.Fatalf("a walkover was refused: %v", err)
		}
	})
}

func TestDrawsAllowedOr(t *testing.T) {
	yes, no := true, false
	cases := []struct {
		name string
		cfg  ScoringConfig
		want bool
	}{
		{"unset means the football default", ScoringConfig{}, true},
		{"explicitly on", ScoringConfig{DrawsAllowed: &yes}, true},
		{"explicitly off", ScoringConfig{DrawsAllowed: &no}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.cfg.DrawsAllowedOr(); got != tc.want {
				t.Fatalf("DrawsAllowedOr() = %v, want %v", got, tc.want)
			}
		})
	}
}
