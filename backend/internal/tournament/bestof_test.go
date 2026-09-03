package tournament

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// newRecordWith builds a record without saving it, for the writes that are
// meant to bounce — `save` fatals, which is right everywhere else.
func newRecordWith(collection *core.Collection, fields map[string]any) *core.Record {
	r := core.NewRecord(collection)
	for k, v := range fields {
		r.Set(k, v)
	}
	return r
}

// The arithmetic, without a database. Every one of these is a scoreline
// somebody could tap into the match sheet on a Saturday morning.
func TestBestOfFault(t *testing.T) {
	cases := []struct {
		name    string
		bestOf  int
		home    int
		away    int
		refused bool
	}{
		{"a single game is whatever it was", 1, 3, 0, false},
		{"an unset format is not a format", 0, 5, 2, false},
		{"best of three, in two", 3, 2, 0, false},
		{"best of three, in three", 3, 2, 1, false},
		{"best of three, the other way up", 3, 1, 2, false},
		{"best of three at one set is a match still on court", 3, 1, 0, true},
		{"best of three at nothing at all", 3, 0, 0, true},
		{"best of three cannot be won three-nil", 3, 3, 0, true},
		{"best of three cannot be level at two", 3, 2, 2, true},
		{"best of five, in five", 5, 3, 2, false},
		{"best of five is not over at two", 5, 2, 1, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fault := bestOfFault(tc.bestOf, tc.home, tc.away)
			if tc.refused && fault == "" {
				t.Fatalf("%d–%d was allowed to end a best-of-%d", tc.home, tc.away, tc.bestOf)
			}
			if !tc.refused && fault != "" {
				t.Fatalf("%d–%d was refused a best-of-%d: %s", tc.home, tc.away, tc.bestOf, fault)
			}
		})
	}
}

func TestSetsToWin(t *testing.T) {
	cases := []struct {
		bestOf int
		want   int
	}{{0, 0}, {1, 0}, {3, 2}, {5, 3}, {4, 3}}
	for _, tc := range cases {
		if got := (ScoringConfig{BestOf: tc.bestOf}).SetsToWin(); got != tc.want {
			t.Fatalf("best of %d: SetsToWin() = %d, want %d", tc.bestOf, got, tc.want)
		}
	}
}

// And through the hook, which is the only way to find out whether the rule is
// actually attached to the write.
func TestBestOfIsEnforcedOnTheWrite(t *testing.T) {
	const volleyball = `{"bestOf":3,"pointsWin":2,"drawsAllowed":false}`

	t.Run("a best-of-three result saves", func(t *testing.T) {
		app := newScoringApp(t)
		f := scoringFixture(t, app, volleyball, "round_robin")
		f.Set("status", "finished")
		f.Set("home_score", 2)
		f.Set("away_score", 1)
		if err := app.Save(f); err != nil {
			t.Fatalf("a 2-1 was refused: %v", err)
		}
	})

	t.Run("a match that is not over is refused", func(t *testing.T) {
		app := newScoringApp(t)
		f := scoringFixture(t, app, volleyball, "round_robin")
		f.Set("status", "finished")
		f.Set("home_score", 1)
		f.Set("away_score", 0)
		if err := app.Save(f); err == nil {
			t.Fatal("a best-of-three was finished after one set")
		}
	})

	t.Run("a match that went too far is refused", func(t *testing.T) {
		app := newScoringApp(t)
		f := scoringFixture(t, app, volleyball, "round_robin")
		f.Set("status", "finished")
		f.Set("home_score", 3)
		f.Set("away_score", 0)
		if err := app.Save(f); err == nil {
			t.Fatal("a best-of-three ended 3-0")
		}
	})

	// A walkover is an outcome without a scoreline, and a live match is a
	// score nobody is claiming is final.
	t.Run("a walkover is not asked to look like a series", func(t *testing.T) {
		app := newScoringApp(t)
		f := scoringFixture(t, app, volleyball, "round_robin")
		f.Set("status", "walkover")
		f.Set("winner", f.GetString("home_entry"))
		if err := app.Save(f); err != nil {
			t.Fatalf("a walkover was refused: %v", err)
		}
	})

	t.Run("a live match at one set is left alone", func(t *testing.T) {
		app := newScoringApp(t)
		f := scoringFixture(t, app, volleyball, "round_robin")
		f.Set("status", "live")
		f.Set("home_score", 1)
		if err := app.Save(f); err != nil {
			t.Fatalf("a live 1-0 was refused: %v", err)
		}
	})

	// The day this field went unread, which is every tournament before it.
	t.Run("a tournament that never said keeps every result it had", func(t *testing.T) {
		app := newScoringApp(t)
		f := scoringFixture(t, app, `{"pointsWin":3,"pointsDraw":1}`, "round_robin")
		f.Set("status", "finished")
		f.Set("home_score", 5)
		f.Set("away_score", 2)
		if err := app.Save(f); err != nil {
			t.Fatalf("a 5-2 was refused: %v", err)
		}
	})
}

func TestASetTheFormatDoesNotHaveIsRefused(t *testing.T) {
	app := newScoringApp(t)
	f := scoringFixture(t, app, `{"bestOf":3,"pointsWin":2}`, "round_robin")

	for number := 1; number <= 3; number++ {
		save(t, app, "games", map[string]any{
			"fixture": f.Id, "number": number, "home_score": 25, "away_score": 20,
		})
	}

	games, err := app.FindCollectionByNameOrId("games")
	if err != nil {
		t.Fatalf("collection games: %v", err)
	}
	fourth := newRecordWith(games, map[string]any{
		"fixture": f.Id, "number": 4, "home_score": 25, "away_score": 20,
	})
	if err := app.Save(fourth); err == nil {
		t.Fatal("a best-of-three was given a fourth set")
	}
}
