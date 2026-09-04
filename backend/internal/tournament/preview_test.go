package tournament

import (
	"strings"
	"testing"
)

// A preview has to produce the same shape a real stage would, because the
// whole argument for the endpoint is that there is one generator rather than
// two. These lean on assertPlanIsConsistent from generate_test.go for the
// wiring and check what is specific to being previewed.

func TestPreviewNumbersTheFieldWhenGivenNoNames(t *testing.T) {
	plan, err := PreviewPlan(PreviewRequest{Format: "single_elim", Teams: 8})
	if err != nil {
		t.Fatalf("preview failed: %v", err)
	}
	assertPlanIsConsistent(t, plan)

	labels := map[string]bool{}
	for _, slot := range plan.Slots {
		if slot.SourceType == "direct" {
			labels[slot.Label] = true
		}
	}
	for _, want := range []string{"Team 1", "Team 8"} {
		if !labels[want] {
			t.Errorf("expected a slot labelled %q; got %v", want, labels)
		}
	}
}

func TestPreviewUsesTheNamesItIsGiven(t *testing.T) {
	plan, err := PreviewPlan(PreviewRequest{
		Format: "single_elim",
		Names:  []string{"Sokol", "Bears", "Lokomotiva", "Slavia"},
	})
	if err != nil {
		t.Fatalf("preview failed: %v", err)
	}
	assertPlanIsConsistent(t, plan)

	found := false
	for _, slot := range plan.Slots {
		if slot.Label == "Lokomotiva" {
			found = true
		}
	}
	if !found {
		t.Error("a named field should put its names on the direct slots")
	}
}

// playableFixtures counts the matches somebody actually turns up for.
//
// A bracket holds a power of two, so a field of 12 is drawn into 16 and the
// four spare positions become bye slots. The fixtures against them are still
// written — they settle themselves the moment the other side is known — so
// counting rows would say 16 where an organiser would say 12.
func playableFixtures(plan *StagePlan) int {
	bye := map[string]bool{}
	for _, slot := range plan.Slots {
		if slot.SourceType == "bye" {
			bye[slot.Key] = true
		}
	}

	played := 0
	for _, f := range plan.Fixtures {
		if !bye[f.HomeSlotKey] && !bye[f.AwaySlotKey] {
			played++
		}
	}
	return played
}

// The match count a marketing page prints is arithmetic done in the browser;
// the bracket it draws next to that number comes from here. A page saying "12
// matches" above a sheet with a different number of lines on it is lying in
// one half of itself, so the two are pinned against each other.
//
// The wants below are knockoutMatches() and combinations() from
// apps/web/src/lib/presets.ts, evaluated by hand. If this test starts failing,
// one of the two moved and the other has to follow.
func TestPreviewMatchCountsAgreeWithThePages(t *testing.T) {
	cases := []struct {
		format string
		teams  int
		cfg    StageConfig
		want   int
	}{
		// One match per eliminated team, plus the third-place match.
		{"single_elim", 8, StageConfig{ThirdPlace: true}, 8},
		{"single_elim", 8, StageConfig{}, 7},
		// 12 in a bracket of 16: four byes, and a bye is not played.
		{"single_elim", 12, StageConfig{ThirdPlace: true}, 12},
		{"single_elim", 5, StageConfig{ThirdPlace: true}, 5},
		// Every pair once, however the field divides.
		{"round_robin", 6, StageConfig{PoolCount: 1}, 15},
		{"round_robin", 5, StageConfig{PoolCount: 1}, 10},
	}

	for _, c := range cases {
		plan, err := PreviewPlan(PreviewRequest{
			Format: c.format, Teams: c.teams, Config: c.cfg,
		})
		if err != nil {
			t.Fatalf("%s/%d: %v", c.format, c.teams, err)
		}
		if got := playableFixtures(plan); got != c.want {
			t.Errorf("%s with %d teams: %d matches played, want %d",
				c.format, c.teams, got, c.want)
		}
	}
}

func TestPreviewRefusesWhatItCannotDraw(t *testing.T) {
	cases := []struct {
		name string
		req  PreviewRequest
		says string
	}{
		{"too few", PreviewRequest{Format: "single_elim", Teams: 1}, "at least 2"},
		{"too many", PreviewRequest{Format: "round_robin", Teams: PreviewLimit + 1}, "at most"},
		{"unknown format", PreviewRequest{Format: "battle_royale", Teams: 8}, "unknown format"},
		{"ladder", PreviewRequest{Format: "ladder", Teams: 8}, "not generated yet"},
		{
			"seedFrom",
			PreviewRequest{
				Format: "single_elim",
				Teams:  8,
				Config: StageConfig{SeedFrom: &SeedSource{Stage: "abc", AdvancePerPool: 2}},
			},
			"real stage",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := PreviewPlan(c.req)
			if err == nil {
				t.Fatal("expected an error")
			}
			if !strings.Contains(err.Error(), c.says) {
				t.Errorf("error %q should mention %q", err, c.says)
			}
		})
	}
}

// The cap is the only thing standing between an unauthenticated endpoint and a
// quadratic generator, so it is checked at the boundary rather than near it.
func TestPreviewAcceptsExactlyTheLimit(t *testing.T) {
	plan, err := PreviewPlan(PreviewRequest{Format: "single_elim", Teams: PreviewLimit})
	if err != nil {
		t.Fatalf("%d teams should be allowed: %v", PreviewLimit, err)
	}
	assertPlanIsConsistent(t, plan)
}

func TestPreviewNamesAreCappedToo(t *testing.T) {
	names := make([]string, PreviewLimit+1)
	for i := range names {
		names[i] = "Team"
	}
	if _, err := PreviewPlan(PreviewRequest{Format: "round_robin", Names: names}); err == nil {
		t.Error("a long name list should be refused the same as a large count")
	}
}
