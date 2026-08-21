package tournament

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// newFixture builds an in-memory fixture record. The real collection uses
// relation fields, but deriveOutcome only ever reads and writes them as ids,
// so plain text fields are an adequate stand-in and need no database.
func newFixture(fields map[string]any) *core.Record {
	c := core.NewBaseCollection("fixtures")
	c.Fields.Add(
		&core.TextField{Name: "status"},
		&core.TextField{Name: "home_entry"},
		&core.TextField{Name: "away_entry"},
		&core.TextField{Name: "winner"},
		&core.TextField{Name: "loser"},
		&core.NumberField{Name: "home_score", OnlyInt: true},
		&core.NumberField{Name: "away_score", OnlyInt: true},
	)

	r := core.NewRecord(c)
	for k, v := range fields {
		r.Set(k, v)
	}
	return r
}

func TestDeriveOutcome(t *testing.T) {
	cases := []struct {
		name       string
		fields     map[string]any
		wantWinner string
		wantLoser  string
	}{
		{
			name: "home wins on score",
			fields: map[string]any{
				"status": "finished", "home_entry": "A", "away_entry": "B",
				"home_score": 2, "away_score": 0,
			},
			wantWinner: "A", wantLoser: "B",
		},
		{
			name: "away wins on score",
			fields: map[string]any{
				"status": "finished", "home_entry": "A", "away_entry": "B",
				"home_score": 1, "away_score": 3,
			},
			wantWinner: "B", wantLoser: "A",
		},
		{
			name: "a draw decides nothing",
			fields: map[string]any{
				"status": "finished", "home_entry": "A", "away_entry": "B",
				"home_score": 1, "away_score": 1,
			},
			wantWinner: "", wantLoser: "",
		},
		{
			name: "an unsettled fixture clears any stale outcome",
			fields: map[string]any{
				"status": "live", "home_entry": "A", "away_entry": "B",
				"home_score": 2, "away_score": 0, "winner": "A", "loser": "B",
			},
			wantWinner: "", wantLoser: "",
		},
		{
			// A walkover has no meaningful score, so the organiser's stated
			// winner must survive and only the loser is inferred.
			name: "walkover keeps the stated winner",
			fields: map[string]any{
				"status": "walkover", "home_entry": "A", "away_entry": "B",
				"winner": "B", "home_score": 0, "away_score": 0,
			},
			wantWinner: "B", wantLoser: "A",
		},
		{
			name: "bye keeps the stated winner",
			fields: map[string]any{
				"status": "bye", "home_entry": "A", "away_entry": "",
				"winner": "A",
			},
			wantWinner: "A", wantLoser: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(tc.fields)
			deriveOutcome(f)

			if got := f.GetString("winner"); got != tc.wantWinner {
				t.Errorf("winner = %q, want %q", got, tc.wantWinner)
			}
			if got := f.GetString("loser"); got != tc.wantLoser {
				t.Errorf("loser = %q, want %q", got, tc.wantLoser)
			}
		})
	}
}

func TestIsSettled(t *testing.T) {
	settled := []string{"finished", "walkover", "bye"}
	unsettled := []string{"pending", "ready", "live", "cancelled", ""}

	for _, s := range settled {
		if !isSettled(s) {
			t.Errorf("isSettled(%q) = false, want true", s)
		}
	}
	for _, s := range unsettled {
		if isSettled(s) {
			t.Errorf("isSettled(%q) = true, want false", s)
		}
	}
}
