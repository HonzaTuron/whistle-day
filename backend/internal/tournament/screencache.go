package tournament

import (
	"errors"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

/*
The assembled screen, kept between the write that changed it and the next one.

A hall with a hundred phones on the results page asks for the same payload a
hundred times in the 200ms after a point is entered, and each of those used to
assemble it again from a dozen queries — about 15ms of CPU apiece, for a
hundred identical answers. An unchanged tournament was no better: the tag a
screen sends back could only be compared once the payload it names had been
rebuilt. Measured on the production box, that was the whole of two cores for
one tournament at a point every half second.

So the payload is built once and handed to everybody who asks until something
it shows is written. The thing that knows when that happens already exists:
`notifyScreens` runs after every write to anything a screen renders, and it
now drops the cached payload before it sends the nudge, so the read a nudge
causes always finds the cache empty for it.

Three things this has to get right, in the order they bite:

  - A build that began before a write must not be kept after it. The build and
    the write are separate requests; without a check the old payload would be
    stored a moment after it was invalidated and served until the next write.
    Every invalidation takes a new version number, and a payload is only kept
    — or shared with a reader — if its build started at or after the last
    invalidation of its tournament.

  - A hundred readers arriving together must cause one build, not a hundred
    that each then store the same thing. Readers join the build in flight.

  - Not everything a screen shows sends a nudge. Sponsors appear while the
    owner's subscription runs. Granting one is a write to the account, which
    empties the whole cache; but a subscription also lapses by the clock, with
    no write at all. Nothing is kept longer than screenCacheTTL, which bounds
    how long that can be wrong to less than the screen's own slow poll.

It lives in the app's own store rather than in a package variable, so two apps
in one process — which is every test run — do not serve each other's screens.
*/

const screenCacheTTL = 30 * time.Second

// screenCachePruneAt is how many tokens are remembered before the dead ones
// are swept. A token is 14kB or so; this is a ceiling on a slow leak from
// displays that were deleted or tournaments that ended, not a tuning knob.
const screenCachePruneAt = 512

const screenCacheStoreKey = "whistleday.screenCache"

// screen is one assembled payload, encoded and tagged.
type screen struct {
	tournament string
	body       []byte
	etag       string
}

type screenEntry struct {
	screen  *screen
	version uint64 // the cache version when its build started
	built   time.Time
}

type screenFlight struct {
	done    chan struct{}
	version uint64
	screen  *screen
	err     error
}

type screenCache struct {
	mu      sync.Mutex
	version uint64
	// invalidated is the version at which each tournament last changed.
	invalidated map[string]uint64
	// everything is the version at which all of them last changed at once.
	everything uint64
	// tournaments remembers which tournament a token shows, so a reader can
	// tell whether a build in flight started before that tournament changed.
	tournaments map[string]string
	entries     map[string]screenEntry
	flights     map[string]*screenFlight
	now         func() time.Time
}

func newScreenCache() *screenCache {
	return &screenCache{
		invalidated: map[string]uint64{},
		tournaments: map[string]string{},
		entries:     map[string]screenEntry{},
		flights:     map[string]*screenFlight{},
		now:         time.Now,
	}
}

// screenCacheOf returns the one cache this app has, making it on first use.
func screenCacheOf(app core.App) *screenCache {
	return app.Store().GetOrSet(screenCacheStoreKey, func() any {
		return newScreenCache()
	}).(*screenCache)
}

// current reports whether something built at this version still describes its
// tournament. Callers hold c.mu.
func (c *screenCache) current(tournament string, version uint64) bool {
	return version >= c.invalidated[tournament] && version >= c.everything
}

// get returns the screen for a token, building it if nothing current is held.
//
// An error is returned to everybody waiting on that build and is not kept: a
// token that does not exist is cheap to look up, and remembering "not found"
// would be a second thing to invalidate when the display is created.
func (c *screenCache) get(token string, build func() (*screen, error)) (*screen, error) {
	c.mu.Lock()

	if entry, ok := c.entries[token]; ok {
		if c.current(entry.screen.tournament, entry.version) && c.now().Sub(entry.built) < screenCacheTTL {
			c.mu.Unlock()
			return entry.screen, nil
		}
		delete(c.entries, token)
	}

	// Join a build already under way — unless the tournament has changed
	// since it started, in which case what it returns is the board from
	// before the write this reader was nudged about.
	if flight, ok := c.flights[token]; ok {
		tournament, known := c.tournaments[token]
		if !known || c.current(tournament, flight.version) {
			c.mu.Unlock()
			<-flight.done
			return flight.screen, flight.err
		}
	}

	flight := &screenFlight{done: make(chan struct{}), version: c.version}
	c.flights[token] = flight
	c.mu.Unlock()

	// Deferred so that a build that panics still lets go of everybody waiting
	// on it. They get the error; the panic carries on to whoever recovers it.
	flight.err = errScreenBuildAbandoned
	defer func() {
		c.mu.Lock()
		if c.flights[token] == flight {
			delete(c.flights, token)
		}
		if flight.err == nil {
			c.tournaments[token] = flight.screen.tournament
			if c.current(flight.screen.tournament, flight.version) {
				c.entries[token] = screenEntry{screen: flight.screen, version: flight.version, built: c.now()}
			}
			if len(c.tournaments) > screenCachePruneAt {
				c.prune()
			}
		}
		c.mu.Unlock()
		close(flight.done)
	}()

	flight.screen, flight.err = build()
	return flight.screen, flight.err
}

var errScreenBuildAbandoned = errors.New("screen build did not finish")

// errNoScreen is a token with nothing to show: switched off, or a draft.
var errNoScreen = errors.New("no screen at this token")

// invalidate drops every screen of a tournament. Called after a write, and
// before the nudge that tells screens to read again.
func (c *screenCache) invalidate(tournament string) {
	c.mu.Lock()
	c.version++
	c.invalidated[tournament] = c.version
	c.mu.Unlock()
}

// invalidateAll drops every screen of every tournament, for a change that
// cannot be pinned to one.
func (c *screenCache) invalidateAll() {
	c.mu.Lock()
	c.version++
	c.everything = c.version
	c.mu.Unlock()
}

// prune forgets tokens with nothing current behind them. Callers hold c.mu.
func (c *screenCache) prune() {
	for token, tournament := range c.tournaments {
		entry, ok := c.entries[token]
		if ok && c.current(tournament, entry.version) && c.now().Sub(entry.built) < screenCacheTTL {
			continue
		}
		delete(c.entries, token)
		if _, building := c.flights[token]; !building {
			delete(c.tournaments, token)
		}
	}
}
