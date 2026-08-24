package tournament

import (
	"github.com/pocketbase/pocketbase/core"
)

// The result log.
//
// It records what a person did, which is why it hangs off the request hooks
// rather than the model hooks: the resolver rewrites fixtures constantly —
// filling in a side, flipping one to "ready", settling a bye — and none of
// that is somebody changing a result. Only a write that arrived over the API
// has an author, and only those are worth keeping.

// outcome is the part of a fixture this log is about.
type outcome struct {
	Status string `json:"status"`
	Home   int    `json:"home_score"`
	Away   int    `json:"away_score"`
	Winner string `json:"winner"`
}

func outcomeOf(f *core.Record) outcome {
	if f == nil {
		return outcome{}
	}
	return outcome{
		Status: f.GetString("status"),
		Home:   f.GetInt("home_score"),
		Away:   f.GetInt("away_score"),
		Winner: f.GetString("winner"),
	}
}

// eventKind classifies a change, or reports that there is nothing to record.
//
// Scheduling is deliberately not history: putting a match on a court at ten
// past two is not a claim about what happened in it, and a log that fills up
// with them is one nobody reads.
func eventKind(before, after outcome) (string, bool) {
	if before == after {
		return "", false
	}

	wasSettled := isSettled(before.Status)
	isNow := isSettled(after.Status)

	switch {
	case !wasSettled && isNow:
		return "recorded", true
	case wasSettled && !isNow:
		return "cleared", true
	case wasSettled && isNow:
		return "corrected", true
	default:
		// ready -> live, pending -> ready, and the rest of the machinery.
		return "", false
	}
}

// RegisterHistory logs result changes that came from a person.
func RegisterHistory(app core.App) {
	app.OnRecordUpdateRequest("fixtures").BindFunc(func(e *core.RecordRequestEvent) error {
		before := outcomeOf(e.Record.Original())

		if err := e.Next(); err != nil {
			return err
		}

		kind, worth := eventKind(before, outcomeOf(e.Record))
		if !worth {
			return nil
		}

		// Only a users record goes in `actor`: it is a relation to that
		// collection, and a superuser id would be rejected by it. An admin
		// fixing something from the dashboard is still worth a row — with
		// nobody named, which is exactly what happened.
		actor := ""
		if e.Auth != nil && e.Auth.Collection().Name == "users" {
			actor = e.Auth.Id
		}

		if err := writeFixtureEvent(e.App, e.Record, kind, actor, before); err != nil {
			// The result is already saved and the response is on its way, so
			// there is nothing useful to return. Losing a log line silently is
			// how a log stops being trusted, so at least say so.
			e.App.Logger().Error(
				"could not record a result change",
				"fixture", e.Record.Id,
				"kind", kind,
				"error", err,
			)
		}
		return nil
	})
}

func writeFixtureEvent(
	app core.App,
	fixture *core.Record,
	kind, actor string,
	before outcome,
) error {
	collection, err := app.FindCollectionByNameOrId("fixture_events")
	if err != nil {
		// A server running an older schema should not start failing results.
		return nil
	}

	after := outcomeOf(fixture)
	event := core.NewRecord(collection)
	event.Set("fixture", fixture.Id)
	event.Set("actor", actor)
	event.Set("kind", kind)
	event.Set("status", after.Status)
	event.Set("home_score", after.Home)
	event.Set("away_score", after.Away)
	event.Set("winner", after.Winner)
	event.Set("previous", before)

	return app.Save(event)
}
