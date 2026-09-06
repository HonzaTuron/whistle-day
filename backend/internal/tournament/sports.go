package tournament

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
)

/*
What a sport implies about scoring.

Three points for a win with a draw possible is right for football and wrong
for every sport played in a hall, so the wizard asks what is being played
rather than asking for a points table: "volleyball" is a question somebody
holding a clipboard can answer, and "how many points for a win, and is a draw
possible" is one they can only answer by looking it up.

An agent creating a tournament over MCP is in exactly the same position and
was not being asked at all — `create_tournament` wrote a football table and no
sport, so a volleyball day came out allowing draws and treating a match as one
game rather than a best of three. That is the bug this file exists to close.

## Why the table is JSON and not Go

Because the wizard has the same table, in TypeScript, and two copies of it
would drift the way two copies of anything drift — quietly, and in the
direction that only shows up in a hall. This file is the one both read:
`sports.json` is embedded here, and `apps/web/src/lib/scoring.test.ts` reads
the same file off disk and fails if the wizard's chips have wandered away from
it.

The labels and hints are not here because they are i18n message keys, which
mean nothing to a server that never renders a word.
*/

//go:embed sports.json
var sportsJSON []byte

// SportPreset is one answer to "what is being played".
type SportPreset struct {
	ID string `json:"id"`
	// What goes in `tournaments.sport`. Empty for "other" — the projector
	// renders this field, and "Other" under a tournament name reads as a
	// mistake rather than as an answer.
	Sport   string        `json:"sport"`
	Scoring ScoringConfig `json:"scoring"`
}

var sports = func() []SportPreset {
	var parsed []SportPreset
	if err := json.Unmarshal(sportsJSON, &parsed); err != nil {
		// Embedded and parsed at startup, so this is a build that shipped a
		// broken table rather than anything a request can cause.
		panic("sports.json is not valid: " + err.Error())
	}
	return parsed
}()

// DefaultSport is the generic one, not the most popular one.
//
// A tournament quietly scored as volleyball because nobody said otherwise is
// worse than one scored as nothing in particular.
const DefaultSport = "other"

// Sports lists every preset, for anything that needs to offer a choice.
func Sports() []SportPreset { return sports }

// SportByID resolves a name to a preset, falling back to the generic one.
//
// Matching is case-insensitive because this is reached by an agent typing a
// word, and "Volleyball" meaning something different from "volleyball" would
// be a distinction nobody could see the point of.
func SportByID(id string) SportPreset {
	wanted := strings.ToLower(strings.TrimSpace(id))
	for _, preset := range sports {
		if preset.ID == wanted {
			return preset
		}
	}
	return fallbackSport()
}

// KnownSport reports whether a name is one of the presets, so a caller that
// asked for something that does not exist can be told rather than quietly
// given the generic table.
func KnownSport(id string) bool {
	wanted := strings.ToLower(strings.TrimSpace(id))
	for _, preset := range sports {
		if preset.ID == wanted {
			return true
		}
	}
	return false
}

// SportIDs is every name a caller may use, for an error message worth reading.
func SportIDs() string {
	names := make([]string, 0, len(sports))
	for _, preset := range sports {
		names = append(names, preset.ID)
	}
	return strings.Join(names, ", ")
}

func fallbackSport() SportPreset {
	for _, preset := range sports {
		if preset.ID == DefaultSport {
			return preset
		}
	}
	// Only reachable if sports.json lost its generic row, which the tests
	// would have caught first.
	panic(fmt.Sprintf("sports.json has no %q preset", DefaultSport))
}
