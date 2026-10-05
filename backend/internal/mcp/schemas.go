package mcp

import (
	"encoding/json"

	"github.com/mark3labs/mcp-go/mcp"
)

/*
What a tool gives back, said as a JSON Schema a client can read before it
calls.

Without one a client learns the shape of a result by calling the tool and
looking, which for a model means a round trip spent finding out that
`home_entry` is an id and not a name. With one, `structuredContent` is
something a client can check and a directory review can hold the server to.

The field lists below are used twice — by the schema and by the handler that
builds the result — so a field added to one is added to the other.
*/

var (
	tournamentSummaryFields = []string{"id", "name", "sport", "location", "status", "created"}
	tournamentFields        = []string{
		"id", "name", "sport", "location", "status",
		"scoring", "description", "created", "updated",
	}
	createdTournamentFields   = []string{"id", "name", "sport", "status"}
	publishedTournamentFields = []string{"id", "name", "status"}

	stageSummaryFields = []string{"id", "name", "format", "status", "position", "config"}
	stageFields        = []string{
		"id", "name", "format", "status", "position", "config",
		"tournament", "created", "updated",
	}

	poolFields = []string{"id", "name", "kind", "position", "advance_count"}

	fixtureSummaryFields = []string{
		"id", "code", "status", "round", "position",
		"home_entry", "away_entry", "home_score", "away_score",
		"winner", "court", "stage", "pool",
	}
	fixtureFields = []string{
		"id", "code", "status", "round", "position",
		"home_entry", "away_entry", "home_score", "away_score",
		"winner", "loser", "court", "scheduled_at",
		"stage", "pool", "home_slot", "away_slot",
	}
	updatedFixtureFields = []string{"id", "code", "status", "home_score", "away_score", "winner"}
	gameFields           = []string{"id", "number", "home_score", "away_score"}

	entryFields        = []string{"id", "name", "short_name", "club", "seed", "status"}
	createdEntryFields = []string{"id", "name", "seed", "status"}

	standingFields = []string{
		"id", "position", "entry", "played", "won", "drawn", "lost",
		"score_for", "score_against", "points", "qualified",
	}
	stageTableFields = []string{
		"id", "position", "entry", "played", "won", "drawn", "lost",
		"score_for", "score_against", "points",
	}

	courtFields = []string{"id", "name", "position", "active"}
)

// fieldSchemas is every record field a tool hands back and what it holds. One
// table rather than a schema per tool, because a field means the same thing
// wherever it turns up.
//
// A relation is the other record's id, and the empty string while there is
// none — a fixture nobody has won has `"winner": ""`, not a missing key.
var fieldSchemas = map[string]map[string]any{
	"id":      str("Record ID"),
	"name":    str("Name"),
	"created": str("When it was created, UTC"),
	"updated": str("When it was last changed, UTC"),
	"status":  str("Status"),

	"sport":       str("Sport preset the tournament is scored by"),
	"location":    str("Where it is played"),
	"description": nullable("string", "Free-text description"),
	"scoring":     nullable("object", "Scoring rules: points for a win, draw and loss, sets, tiebreakers"),

	"tournament": str("Tournament ID"),
	"format":     str("round_robin, single_elim, double_elim, swiss or ladder"),
	"config":     nullable("object", "Format-specific settings, e.g. poolCount"),
	"position":   integer("Order, 0-based; in a table, the rank"),

	"kind":          str("group, winners, losers, final or consolation"),
	"advance_count": integer("How many entries go through from this pool"),

	"stage":        str("Stage ID"),
	"pool":         str("Pool ID, empty when the stage has no pools"),
	"code":         str("Short handle for the match, e.g. A1 or QF2"),
	"round":        integer("Round, 0-based"),
	"home_entry":   str("Entry ID of the home side, empty until it is known"),
	"away_entry":   str("Entry ID of the away side, empty until it is known"),
	"home_slot":    str("Slot ID the home side is drawn from"),
	"away_slot":    str("Slot ID the away side is drawn from"),
	"home_score":   integer("Home score: sets, or goals"),
	"away_score":   integer("Away score: sets, or goals"),
	"winner":       str("Entry ID of the winner, empty until decided"),
	"loser":        str("Entry ID of the loser, empty until decided"),
	"court":        str("Court ID, empty when unassigned"),
	"scheduled_at": str("Scheduled start, UTC, empty when unscheduled"),
	"number":       integer("Set or game number, 1-based"),

	"short_name": str("Short name the projector shows"),
	"club":       str("Club"),
	"seed":       integer("Seed"),

	"entry":         str("Entry ID"),
	"played":        integer("Matches played"),
	"won":           integer("Matches won"),
	"drawn":         integer("Matches drawn"),
	"lost":          integer("Matches lost"),
	"score_for":     integer("Sets or goals scored"),
	"score_against": integer("Sets or goals conceded"),
	"points":        integer("Table points"),
	"qualified":     boolean("Whether this place goes through to the next stage"),

	"active": boolean("Whether it is in use"),
}

func str(about string) map[string]any {
	return map[string]any{"type": "string", "description": about}
}

func integer(about string) map[string]any {
	return map[string]any{"type": "integer", "description": about}
}

func boolean(about string) map[string]any {
	return map[string]any{"type": "boolean", "description": about}
}

// nullable is for a field that can be unset in the database, which reads back
// as null rather than as an empty value.
func nullable(kind, about string) map[string]any {
	return map[string]any{"type": []string{kind, "null"}, "description": about}
}

func arrayOf(items map[string]any) map[string]any {
	return map[string]any{"type": "array", "items": items}
}

func objectSchema(props map[string]any, required ...string) map[string]any {
	return map[string]any{"type": "object", "properties": props, "required": required}
}

// recordSchema is the schema of recordToMap(r, fields...). A field with no
// entry in fieldSchemas is a mistake in this package, found the first time
// the server starts rather than the first time a client trips over it.
func recordSchema(fields []string, extra ...map[string]any) map[string]any {
	props := map[string]any{}
	required := append([]string{}, fields...)
	for _, f := range fields {
		schema, ok := fieldSchemas[f]
		if !ok {
			panic("mcp: no output schema for field " + f)
		}
		props[f] = schema
	}
	for _, more := range extra {
		for name, schema := range more {
			props[name] = schema
			required = append(required, name)
		}
	}
	return objectSchema(props, required...)
}

// returns states a tool's result.
func returns(schema map[string]any) mcp.ToolOption {
	raw, err := json.Marshal(schema)
	if err != nil {
		panic("mcp: output schema: " + err.Error())
	}
	return mcp.WithRawOutputSchema(raw)
}

// returnsRecord is a tool that answers with one record.
func returnsRecord(fields []string, extra ...map[string]any) mcp.ToolOption {
	return returns(recordSchema(fields, extra...))
}

// returnsList is a tool that answers with rows, under a name: the protocol
// wants structuredContent to be an object, so a list cannot be the top level.
func returnsList(key string, fields []string) mcp.ToolOption {
	return returns(objectSchema(map[string]any{key: arrayOf(recordSchema(fields))}, key))
}
