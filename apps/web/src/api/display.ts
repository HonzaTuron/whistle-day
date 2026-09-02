import type { DisplayPayload } from "@seedly/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT, type MessageKey } from "../lib/i18n";
import { forgetDisplay, readDisplay, writeDisplay } from "./cache";

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

/**
 * How old a cached payload may be before a screen would rather show nothing.
 *
 * The cache is for the reload in the middle of the day: a projector nudged at
 * eleven o'clock comes back to the eleven o'clock board rather than to a black
 * wall, marked as reconnecting until the server confirms it. It is not for the
 * morning after. A screen switched on at nine with no signal must not put
 * yesterday's finals up as though the day had started, so anything older than
 * a tournament day is left where it is and the screen says it cannot reach the
 * scoring system, which is the truth.
 */
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface DisplayState {
  payload: DisplayPayload | null;
  error: string | null;
  /**
   * What is on screen has not been confirmed by the server: either a request
   * has failed since the last success, or this is the cached payload the
   * screen came up on and the first read has not answered yet.
   */
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

/**
 * The same state, with the failure still a key rather than a sentence.
 *
 * Held this way because a screen is left running: a projector that lost the
 * network at eleven is still saying so at noon, and if the sentence were
 * settled when the read failed then switching the language would leave the one
 * line on the wall in the language before it. The wording happens on the way
 * out of the hook, every render, so it follows the switch like everything
 * else.
 */
interface InternalState extends Omit<DisplayState, "error"> {
  error: MessageKey | null;
}

export function useDisplayPayload(token: string): DisplayState {
  const t = useT();
  const [state, setState] = useState<InternalState>({
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

    // Set once the server has answered at all, so a slow disk cannot put the
    // cached payload up over a fresher one that has already arrived.
    let answered = false;

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
        answered = true;

        if (response.status === 304) {
          setState((prev) => ({ ...prev, stale: false, loading: false }));
          // Nothing new to draw, but a read that got through is the moment to
          // notice the stream is not there any more. `watching` is the id it
          // was showing; the call is a no-op while the socket is up.
          if (watching) watch(watching, true);
        } else if (response.status === 404) {
          setState({
            payload: null,
            error: "error.badScreenLink",
            stale: false,
            loading: false,
          });
          // A revoked link is an answer, and the board behind it is not this
          // screen's to show on the next reload.
          forgetDisplay(token);
          stream?.close();
          stream = null;
          return; // a bad token will not fix itself; stop asking
        } else if (!response.ok) {
          throw new Error(`server returned ${response.status}`);
        } else {
          const tag = response.headers.get("etag");
          const served = (await response.json()) as DisplayPayload;
          etag.current = tag;
          setState({
            payload: withEmptyLists(served),
            error: null,
            stale: false,
            loading: false,
          });
          // Kept as it was served, tag and all: this is what the wall draws
          // after a reload with no signal, and the tag is what turns the read
          // that follows into a 304 rather than a payload nobody needed.
          writeDisplay(token, served, tag);
          // The screen learns which tournament it is showing from the payload,
          // so the stream can only be opened once there has been one.
          watch(served.tournament.id, true);
        }
      } catch {
        if (cancelled) return;
        // Keep whatever is on screen; just mark it as possibly out of date.
        setState((prev) => ({
          ...prev,
          stale: prev.payload !== null,
          error: prev.payload ? null : "error.unreachable",
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
     *
     * A closed stream is opened again. The browser retries a connection that
     * dropped, but not one that failed — a proxy answering 500 while the
     * backend restarts, or a captive portal returning its own page, is the end
     * of that EventSource. So every read that gets through calls this, and a
     * socket the browser has given up on is rebuilt by the next one.
     */
    const watch = (tournamentId: string, current: boolean) => {
      if (!tournamentId) return;
      if (watching === tournamentId && stream && stream.readyState !== EventSource.CLOSED) {
        return;
      }
      watching = tournamentId;
      const topic = `tournament/${tournamentId}`;

      stream?.close();
      stream = new EventSource("/api/realtime");
      /**
       * Whether what is on screen was current when this stream was opened.
       *
       * The first connect after a fresh read has nothing to tell the screen —
       * it was opened by that read. Every connect after it is one the browser
       * made because the last one dropped, and a screen that came up on the
       * cache has not had a good read at all.
       */
      let fresh = current;

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

        // A connection is news in itself. Whatever happened while there was
        // no socket arrived with no nudge, and a wall marked stale through an
        // outage would otherwise wear "reconnecting" until the next slow poll
        // — up to a minute after the signal came back, in front of a hall.
        // The read costs an `If-None-Match` and a 304 when nothing changed.
        if (fresh) fresh = false;
        else readSoon();
      });

      stream.addEventListener(topic, () => {
        if (!cancelled) readSoon();
      });

      // EventSource retries on its own; there is nothing to reconnect by hand.
      // A screen that cannot hold a stream is a screen on the slow poll, which
      // is the state this whole hook is written to survive.
    };

    /**
     * The cache first, then the server.
     *
     * Not a race — the cached payload is only put up if the network has not
     * already answered, so a screen with signal never sees the old board flash
     * past. It goes up marked stale, which is the "reconnecting" the header
     * has always had, and the read already in flight either replaces it or
     * fails and leaves it there, which is the whole point.
     *
     * The stored tag is restored with the stored payload and never on its own:
     * a tag with nothing behind it would earn a 304 and leave the screen with
     * nothing to draw. It is not the first read that carries it — that one
     * left before the disk answered — but every read after, so a wall that has
     * been showing the cached board through an outage asks the cheap question
     * when the signal comes back and is told it was right all along.
     *
     * Subscribing from the cache matters as much: that confirming read answers
     * 304 and brings no payload to learn the tournament id from, and without
     * this the screen would sit on the slow poll for the rest of the day.
     */
    const hydrate = async () => {
      const cached = await readDisplay(token);
      if (cancelled || answered || !cached) return;
      const servedAt = Date.parse(cached.payload.generated_at);
      if (!Number.isFinite(servedAt) || Date.now() - servedAt > CACHE_MAX_AGE_MS) return;

      etag.current = cached.etag;
      setState({
        payload: withEmptyLists(cached.payload),
        error: null,
        stale: true,
        loading: false,
      });
      watch(cached.payload.tournament.id, false);
    };

    void hydrate();
    void read();
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (coalesce) clearTimeout(coalesce);
      stream?.close();
    };
  }, [token]);

  return useMemo(
    () => ({ ...state, error: state.error ? t(state.error) : null }),
    [state, t],
  );
}
