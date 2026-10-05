package tournament

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/subscriptions"
)

// ScreenTopic is what a screen subscribes to for the tournament it is showing.
//
// A screen learns the id from its first payload, which it can only get by
// holding the display token — but the topic carries no data of its own, so it
// would not be worth anything to somebody who guessed an id. That is the point
// of sending a nudge rather than the payload: the assembled screen has exactly
// one way out of this server, `GET /api/display/{token}`, with one set of
// rules, one ETag and one place for a bug to live.
func ScreenTopic(tournamentID string) string {
	return "tournament/" + tournamentID
}

// changed is the whole message. A screen that hears it re-reads the endpoint.
var changed = []byte(`{"changed":true}`)

// RegisterRealtime tells screens when something they are showing has changed.
//
// Polling every four seconds was fine when a screen changed once a match; it
// is not fine now that a point is entered per rally, because the hall watches
// the rally and then watches the wall not knowing about it. The nudge goes out
// on every write to anything a screen renders, which is more often than the
// screen needs — a result settles a fixture, rebuilds two tables and fills a
// slot, and each of those is a write. The client coalesces the burst; the
// alternative is this side trying to work out which write was the last one,
// and being wrong the day somebody adds a hook.
func RegisterRealtime(app core.App) {
	// Taken from the app the routes were registered on, once, rather than
	// from whichever app a hook is handed: the cache the endpoint reads and
	// the one a write empties have to be the same one.
	screens := screenCacheOf(app)

	notify := func(e *core.RecordEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		notifyScreens(e.App, screens, e.Record)
		return nil
	}

	app.OnRecordAfterCreateSuccess().BindFunc(notify)
	app.OnRecordAfterUpdateSuccess().BindFunc(notify)
	app.OnRecordAfterDeleteSuccess().BindFunc(notify)
}

// notifyScreens sends the nudge for whichever tournament this record belongs
// to. Nothing in here may fail the write that triggered it: a screen that
// misses a nudge is a screen that is a few seconds late, because it still
// polls slowly underneath. A screen that stops a result being saved is worse
// than any staleness.
func notifyScreens(app core.App, screens *screenCache, record *core.Record) {
	// An account is not on any screen, but what it is paying for is: sponsors
	// appear while the owner is subscribed. Working out which tournaments one
	// account owns costs more than rebuilding the few screens that are live,
	// and accounts change rarely, so every kept payload goes. No nudge — a
	// screen has never been told about this and finds out on its slow poll.
	if record.Collection().Name == "users" {
		screens.invalidateAll()
		return
	}

	tournamentID := tournamentOf(app, record)
	if tournamentID == "" {
		return
	}

	// Before the nudge, not after: the read a nudge causes has to find the
	// kept payload already gone, or it is told the old board is current.
	screens.invalidate(tournamentID)

	topic := ScreenTopic(tournamentID)
	message := subscriptions.Message{Name: topic, Data: changed}

	for _, chunk := range app.SubscriptionsBroker().ChunkedClients(300) {
		for _, client := range chunk {
			if client.HasSubscription(topic) {
				client.Send(message)
			}
		}
	}
}

// tournamentOf walks a changed record back to the tournament whose screens
// care about it, or returns "" for one no screen renders — a user, a staff
// row, an auth token. The walk is one lookup at most: everything a screen
// shows is either on a tournament directly or one relation away from it.
func tournamentOf(app core.App, record *core.Record) string {
	switch record.Collection().Name {
	case "fixtures", "entries", "courts", "stages", "displays", "tournaments":
		if record.Collection().Name == "tournaments" {
			return record.Id
		}
		return record.GetString("tournament")

	case "pools", "slots", "standings":
		return parentOf(app, "stages", record.GetString("stage"), "tournament")

	case "games":
		return parentOf(app, "fixtures", record.GetString("fixture"), "tournament")

	case "fixture_events":
		return parentOf(app, "fixtures", record.GetString("fixture"), "tournament")
	}

	return ""
}

func parentOf(app core.App, collection, id, field string) string {
	if id == "" {
		return ""
	}
	parent, err := app.FindRecordById(collection, id)
	if err != nil {
		return ""
	}
	return parent.GetString(field)
}
