import type { DisplayPayload } from "@seedly/engine";
import { useEffect, useRef, useState } from "react";

/**
 * How a screen keeps up.
 *
 * The server nudges: it opens a stream, subscribes to the tournament it is
 * showing, and re-reads the endpoint whenever the server says something
 * changed. A point tapped at the side of a court is on the wall in the time it
 * takes to ask for the payload, which is what a hall watching a rally expects
 * of a scoreboard.
 *
 * The nudge carries nothing but the fact that there is news. The assembled
 * screen keeps exactly one way out of the server — `GET /api/display/{token}`,
 * with one set of rules, one ETag and one place for a bug to live — and this
 * only replaces the timer that used to ask it.
 *
 * Underneath, the slow poll stays. A stream through a venue's wifi, a phone's
 * radio, or somebody's captive portal is not a thing to bet a tournament on,
 * and the failure it has is the quiet one: the socket looks open and no longer
 * delivers. A minute is far too slow to run a hall on and far too fast to
 * leave a wall wrong for the rest of the day.
 *
 * The server tags every payload; sending the tag back means an unchanged
 * tournament answers 304 with no body. On failure the last good payload stays
 * on screen — a blank projector in a sports hall is worse than a stale one.
 */
const POLL_INTERVAL_MS = 60_000;

/**
 * One result is a fixture, two tables and a slot — four writes and four
 * nudges. Waiting a moment for the burst to end means one read of a finished
 * state rather than four of a half-applied one.
 */
const COALESCE_MS = 200;

export interface DisplayState {
  payload: DisplayPayload | null;
  error: string | null;
  /** True once a request has failed since the last success. */
  stale: boolean;
  loading: boolean;
}

/**
 * A screen is not always newer than the server it polls — a projector left open
 * across a deploy, or pointed at an older instance, is handed a payload without
 * whatever that build did not send yet. Every list here is read with `.length`
 * somewhere, so one absent key throws and takes the whole wall black. Filling
 * them in costs a spread per poll and turns a missing feature into a missing
 * panel.
 */
function withEmptyLists(payload: DisplayPayload): DisplayPayload {
  return {
    ...payload,
    entries: payload.entries ?? {},
    courts: payload.courts ?? [],
    stages: payload.stages ?? [],
    now_playing: payload.now_playing ?? [],
    next_up: payload.next_up ?? [],
    recent: payload.recent ?? [],
    sponsors: payload.sponsors ?? [],
  };
}

export function useDisplayPayload(token: string): DisplayState {
  const [state, setState] = useState<DisplayState>({
    payload: null,
    error: null,
    stale: false,
    loading: true,
  });

  const etag = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let coalesce: ReturnType<typeof setTimeout> | null = null;
    let stream: EventSource | null = null;
    let watching = "";

    // Reset when the token changes, or a new screen briefly shows the old one.
    etag.current = null;
    setState({ payload: null, error: null, stale: false, loading: true });

    const read = async () => {
      try {
        const headers: HeadersInit = {};
        if (etag.current) headers["If-None-Match"] = etag.current;

        const response = await fetch(`/api/display/${encodeURIComponent(token)}`, {
          headers,
        });

        if (cancelled) return;

        if (response.status === 304) {
          setState((prev) => ({ ...prev, stale: false, loading: false }));
        } else if (response.status === 404) {
          setState({
            payload: null,
            error: "This screen link is not valid.",
            stale: false,
            loading: false,
          });
          stream?.close();
          stream = null;
          return; // a bad token will not fix itself; stop asking
        } else if (!response.ok) {
          throw new Error(`server returned ${response.status}`);
        } else {
          etag.current = response.headers.get("etag");
          const payload = withEmptyLists((await response.json()) as DisplayPayload);
          setState({ payload, error: null, stale: false, loading: false });
          // The screen learns which tournament it is showing from the payload,
          // so the stream can only be opened once there has been one.
          watch(payload.tournament.id);
        }
      } catch {
        if (cancelled) return;
        // Keep whatever is on screen; just mark it as possibly out of date.
        setState((prev) => ({
          ...prev,
          stale: prev.payload !== null,
          error: prev.payload ? null : "Cannot reach the scoring system.",
          loading: false,
        }));
      }
    };

    /** Read once the nudges stop arriving, not once per nudge. */
    const readSoon = () => {
      if (coalesce) clearTimeout(coalesce);
      coalesce = setTimeout(() => {
        coalesce = null;
        void read();
      }, COALESCE_MS);
    };

    const poll = () => {
      timer = setTimeout(() => {
        void read().finally(() => {
          if (!cancelled) poll();
        });
      }, POLL_INTERVAL_MS);
    };

    /**
     * Open the stream and say what this screen is showing.
     *
     * PocketBase hands out a client id on connect and takes subscriptions for
     * it over a separate request, so the subscribing happens on every
     * `PB_CONNECT` rather than once: the browser reopens a dropped EventSource
     * by itself, and what comes back is a new connection with a new id and no
     * subscriptions on it.
     */
    const watch = (tournamentId: string) => {
      if (!tournamentId || watching === tournamentId) return;
      watching = tournamentId;
      const topic = `tournament/${tournamentId}`;

      stream?.close();
      stream = new EventSource("/api/realtime");

      stream.addEventListener("PB_CONNECT", (event) => {
        if (cancelled) return;
        let clientId = "";
        try {
          clientId = (JSON.parse((event as MessageEvent<string>).data) as {
            clientId?: string;
          }).clientId ?? "";
        } catch {
          return;
        }
        if (!clientId) return;

        void fetch("/api/realtime", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clientId, subscriptions: [topic] }),
        }).catch(() => {
          // The poll is the floor. Nothing to do here but wait for it.
        });
      });

      stream.addEventListener(topic, () => {
        if (!cancelled) readSoon();
      });

      // EventSource retries on its own; there is nothing to reconnect by hand.
      // A screen that cannot hold a stream is a screen on the slow poll, which
      // is the state this whole hook is written to survive.
    };

    void read();
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (coalesce) clearTimeout(coalesce);
      stream?.close();
    };
  }, [token]);

  return state;
}
