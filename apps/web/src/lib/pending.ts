import type { Id } from "@seedly/engine";
import type { BoardFixture, SetScore } from "../api/organiser";
import { stamp } from "../api/organiser";

/**
 * What a write means, kept apart from how it is sent.
 *
 * A hall loses its wifi for ten minutes at a time and the organiser keeps
 * entering results through it. Queueing the *requests* would not survive that:
 * `saveGames` reads the rows that exist before deciding whether to create,
 * patch or delete them, and offline there is nothing to read and no record id
 * to patch. So what is queued is the intent — "this match finished 2–0, with
 * these sets" — and replaying it runs the ordinary `api/organiser` write with
 * the read back in place. One write path, online or not.
 *
 * Everything here is pure. The queue's storage, its retries and its timers
 * live in `api/outbox.ts`; this file is the part worth being sure about.
 */

export type Intent =
  | { kind: "result"; fixture: Id; home: number; away: number; sets: SetScore[] }
  | { kind: "walkover"; fixture: Id; winner: Id }
  /**
   * The status a cleared fixture goes back to depends on whether its own two
   * sides are still known, which is a question about the board. It is answered
   * when the intent is made rather than when it is sent, because by the time a
   * queue drains the board it was made against may be an hour old.
   */
  | { kind: "clear"; fixture: Id; status: "ready" | "pending" }
  | { kind: "schedule"; fixture: Id; court?: Id | null; scheduled_at?: string }
  | { kind: "live"; fixture: Id; live: boolean };

/**
 * A queued intent, and what has happened to it.
 *
 * `sent` is not a tidying-up state. The optimistic result has to stay on the
 * screen until the board has been read back, or there is a blink between the
 * write landing and the reload arriving where the match reverts to unplayed —
 * exactly the flicker `writeScreen` in `routes/Results.tsx` was written to
 * avoid. The entry is dropped once a refresh has been seen, not once the
 * request has.
 */
export interface Queued {
  /** Local, not the server's — these records already have server ids. */
  id: string;
  tournament: Id;
  intent: Intent;
  /** When the organiser tapped, so a queue can say how long it has waited. */
  at: number;
  state: "queued" | "sent";
  attempts: number;
  /** The last network failure, for a queue that is not draining. */
  error?: string;
}

/**
 * Two writes to one fixture only conflict when they touch the same columns.
 *
 * `result`, `walkover`, `clear` and `live` all write `status`, so only the
 * last of them means anything: a match marked live and then finished is a
 * finished match, and sending both would have the server derive a winner from
 * a fixture it had just been told was in progress. Court and time are a
 * different question about the same match — an organiser moves a match to
 * court two and enters its score twenty minutes later, and both must land.
 *
 * Collapsing per lane is also what stops a day of corrections from becoming a
 * queue of forty writes: a match rescored three times offline drains as one.
 */
export type Lane = "outcome" | "schedule";

export const laneOf = (intent: Intent): Lane =>
  intent.kind === "schedule" ? "schedule" : "outcome";

/**
 * Put an intent in the queue, superseding what it makes irrelevant.
 *
 * An outcome replaces the pending outcome for its fixture outright. A schedule
 * merges into the pending one, because each is a partial patch: setting a
 * court must not silently unset a time that was queued a minute earlier.
 *
 * Only `queued` entries are collapsed into. One already `sent` is on the
 * server, and a correction on top of it is a second write rather than an edit
 * of the first — the fixture history the server keeps should show both, since
 * "they changed it twice" is the question that history exists to answer.
 */
export function collapse(queue: Queued[], next: Queued): Queued[] {
  const lane = laneOf(next.intent);
  const index = queue.findIndex(
    (entry) =>
      entry.state === "queued" &&
      entry.intent.fixture === next.intent.fixture &&
      laneOf(entry.intent) === lane,
  );

  if (index === -1) return [...queue, next];

  const merged: Queued =
    lane === "schedule"
      ? {
          ...queue[index]!,
          // Spread, not assign: an absent key means "leave it alone", so the
          // two partial patches have to be layered rather than replaced.
          intent: { ...queue[index]!.intent, ...next.intent } as Intent,
          at: next.at,
          attempts: 0,
          error: undefined,
        }
      : { ...next, id: queue[index]!.id };

  const out = [...queue];
  out[index] = merged;
  return out;
}

/**
 * What a queued intent does to the match it is about — and to nothing else.
 *
 * This is the honest half of working offline. A result closes its own fixture
 * and stops there: it does not push a winner into the slots that name it, does
 * not rebuild a pool table, and does not fill the playoff place that table
 * decides. All of that is the server's, derived in one transaction from every
 * fixture at once, and a client guessing at it would be wrong in the way this
 * codebase least wants to be wrong — invisibly, until the projector disagreed
 * with the hall.
 *
 * So an organiser scoring through an outage sees their results recorded and
 * the bracket downstream standing still. That is the truth of the situation,
 * and it resolves itself the moment the queue drains.
 *
 * `winner` is the one exception, and it is display-only: `FixtureRow` bolds
 * the winning name from it, and a recorded match that cannot say who won reads
 * as broken. The server derives it again on arrival and overwrites this.
 */
export function applyIntent(
  fixture: BoardFixture,
  intent: Intent,
  at: number = Date.now(),
): BoardFixture {
  switch (intent.kind) {
    case "result": {
      const { home, away } = intent;
      const winner =
        home > away ? fixture.home_entry : away > home ? fixture.away_entry : null;
      const loser =
        home > away ? fixture.away_entry : away > home ? fixture.home_entry : null;
      return {
        ...fixture,
        status: "finished",
        home_score: home,
        away_score: away,
        winner,
        loser,
        finished_at: stamp(new Date(at)),
      };
    }

    case "walkover":
      return {
        ...fixture,
        status: "walkover",
        home_score: 0,
        away_score: 0,
        winner: intent.winner,
        loser:
          intent.winner === fixture.home_entry ? fixture.away_entry : fixture.home_entry,
        finished_at: stamp(new Date(at)),
      };

    case "clear":
      return {
        ...fixture,
        status: intent.status,
        home_score: 0,
        away_score: 0,
        winner: null,
        loser: null,
        finished_at: "",
      };

    case "schedule":
      return {
        ...fixture,
        ...(intent.court === undefined ? {} : { court: intent.court ?? null }),
        ...(intent.scheduled_at === undefined
          ? {}
          : { scheduled_at: intent.scheduled_at }),
      };

    case "live":
      return intent.live
        ? { ...fixture, status: "live", started_at: stamp(new Date(at)) }
        : { ...fixture, status: "ready", started_at: "" };
  }
}

/**
 * The board as the organiser should see it: what the server last said, plus
 * everything this device has done since that has not been read back yet.
 *
 * Composed at render rather than written into the cache. A cache holding a
 * mutated board would need the mutation unpicked when a write turned out to be
 * refused, and a result the server rejected — a draw in a knockout — would
 * otherwise sit in local storage looking recorded forever.
 */
export function overlay(fixtures: BoardFixture[], queue: Queued[]): BoardFixture[] {
  if (queue.length === 0) return fixtures;

  const byFixture = new Map<Id, Queued[]>();
  for (const entry of queue) {
    const list = byFixture.get(entry.intent.fixture);
    if (list) list.push(entry);
    else byFixture.set(entry.intent.fixture, [entry]);
  }

  return fixtures.map((fixture) => {
    const entries = byFixture.get(fixture.id);
    if (!entries) return fixture;
    return entries.reduce(
      (carry, entry) => applyIntent(carry, entry.intent, entry.at),
      fixture,
    );
  });
}

/** The fixtures this device is still holding, for the marker on their rows. */
export function waitingFixtures(queue: Queued[]): Set<Id> {
  return new Set(
    queue.filter((entry) => entry.state === "queued").map((entry) => entry.intent.fixture),
  );
}
