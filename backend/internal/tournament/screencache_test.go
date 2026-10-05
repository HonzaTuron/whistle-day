package tournament

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// The cache sits between a write and a hall full of screens, and the ways it
// can be wrong are all the same way: a board that is not the current one,
// shown with no sign that anything is off. Each test here is one of those.

func board(tournament, body string) *screen {
	return &screen{tournament: tournament, body: []byte(body), etag: `"` + body + `"`}
}

func TestScreenCacheBuildsOnceForEverybodyAskingTogether(t *testing.T) {
	cache := newScreenCache()

	var builds atomic.Int32
	release := make(chan struct{})
	build := func() (*screen, error) {
		builds.Add(1)
		<-release
		return board("t1", "one"), nil
	}

	var wg sync.WaitGroup
	results := make([]*screen, 100)
	for i := range results {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results[i], _ = cache.get("hala-1", build)
		}()
	}

	// Let every reader reach the cache before the one build finishes.
	for builds.Load() == 0 {
		time.Sleep(time.Millisecond)
	}
	time.Sleep(20 * time.Millisecond)
	close(release)
	wg.Wait()

	if got := builds.Load(); got != 1 {
		t.Fatalf("100 readers caused %d builds, want 1", got)
	}
	for i, result := range results {
		if result == nil || string(result.body) != "one" {
			t.Fatalf("reader %d got %v", i, result)
		}
	}

	// And the next one to ask is answered without building at all.
	if _, err := cache.get("hala-1", func() (*screen, error) {
		t.Fatal("built again with a current payload held")
		return nil, nil
	}); err != nil {
		t.Fatal(err)
	}
}

func TestScreenCacheRebuildsAfterAWrite(t *testing.T) {
	cache := newScreenCache()
	cache.get("hala-1", func() (*screen, error) { return board("t1", "before"), nil })

	cache.invalidate("t1")

	got, _ := cache.get("hala-1", func() (*screen, error) { return board("t1", "after"), nil })
	if string(got.body) != "after" {
		t.Fatalf("served %q after a write, want the rebuilt board", got.body)
	}
}

func TestScreenCacheLeavesOtherTournamentsAlone(t *testing.T) {
	cache := newScreenCache()
	cache.get("hala-1", func() (*screen, error) { return board("t1", "ours"), nil })

	cache.invalidate("t2")

	cache.get("hala-1", func() (*screen, error) {
		t.Fatal("a write to another tournament rebuilt this one")
		return nil, nil
	})
}

// A subscription is granted on the account, not on a tournament, and it
// changes what every screen that account owns is allowed to show.
func TestScreenCacheCanDropEverything(t *testing.T) {
	cache := newScreenCache()
	cache.get("hala-1", func() (*screen, error) { return board("t1", "free"), nil })

	cache.invalidateAll()

	got, _ := cache.get("hala-1", func() (*screen, error) { return board("t1", "paid"), nil })
	if string(got.body) != "paid" {
		t.Fatalf("served %q after everything was dropped", got.body)
	}
}

// The build and the write are separate requests. A build that read the
// database before the write must not be stored after it, or the old board is
// served until something else happens to change.
func TestScreenCacheDoesNotKeepABuildThatAWriteOvertook(t *testing.T) {
	cache := newScreenCache()
	cache.get("hala-1", func() (*screen, error) { return board("t1", "first"), nil })
	cache.invalidate("t1")

	started := make(chan struct{})
	release := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		cache.get("hala-1", func() (*screen, error) {
			close(started)
			<-release
			return board("t1", "read before the write"), nil
		})
	}()

	<-started
	cache.invalidate("t1")

	// A reader nudged by that write must not be handed the build in flight.
	got, _ := cache.get("hala-1", func() (*screen, error) { return board("t1", "current"), nil })
	if string(got.body) != "current" {
		t.Fatalf("a reader after the write was given %q", got.body)
	}

	close(release)
	<-done

	got, _ = cache.get("hala-1", func() (*screen, error) { return board("t1", "current"), nil })
	if string(got.body) != "current" {
		t.Fatalf("the overtaken build was kept: serving %q", got.body)
	}
}

// Sponsors come and go with a subscription, which lapses by the clock and
// sends no nudge. Nothing may be kept past the TTL.
func TestScreenCacheExpires(t *testing.T) {
	cache := newScreenCache()
	now := time.Now()
	cache.now = func() time.Time { return now }

	cache.get("hala-1", func() (*screen, error) { return board("t1", "old"), nil })

	now = now.Add(screenCacheTTL - time.Second)
	cache.get("hala-1", func() (*screen, error) {
		t.Fatal("rebuilt inside the TTL")
		return nil, nil
	})

	now = now.Add(2 * time.Second)
	got, _ := cache.get("hala-1", func() (*screen, error) { return board("t1", "new"), nil })
	if string(got.body) != "new" {
		t.Fatalf("served %q past the TTL", got.body)
	}
}

func TestScreenCacheDoesNotRememberAFailure(t *testing.T) {
	cache := newScreenCache()

	if _, err := cache.get("nope", func() (*screen, error) { return nil, errNoScreen }); !errors.Is(err, errNoScreen) {
		t.Fatalf("err = %v, want errNoScreen", err)
	}

	// The display is created a moment later; the token has to work at once.
	got, err := cache.get("nope", func() (*screen, error) { return board("t1", "there now"), nil })
	if err != nil || string(got.body) != "there now" {
		t.Fatalf("got %v, %v", got, err)
	}
}

func TestScreenCacheLetsGoOfWaitersWhenABuildPanics(t *testing.T) {
	cache := newScreenCache()

	started := make(chan struct{})
	release := make(chan struct{})
	go func() {
		defer func() { recover() }()
		cache.get("hala-1", func() (*screen, error) {
			close(started)
			<-release
			panic("boom")
		})
	}()
	<-started

	waited := make(chan error, 1)
	go func() {
		_, err := cache.get("hala-1", func() (*screen, error) { return board("t1", "unused"), nil })
		waited <- err
	}()
	time.Sleep(20 * time.Millisecond)
	close(release)

	select {
	case err := <-waited:
		if err == nil {
			t.Fatal("a waiter on a panicked build was told it succeeded")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("a waiter on a panicked build was never released")
	}
}
