import type { Id } from "@seedly/engine";
import {
  ApiError,
  clearResult,
  ensureOrganiser,
  saveGames,
  saveResult,
  saveWalkover,
  setLive,
  setSchedule,
  storedSession,
  type Session,
} from "./organiser";
import { collapse, type Intent, type Queued } from "../lib/pending";

/**
 * The results this device is holding on to.
 *
 * A sports hall's wifi drops for a minute at a time and its 4G is whatever
 * makes it through a concrete roof, and the organiser is not going to stop
 * scoring while it sorts itself out. Every write from the match sheet goes in
 * here first and is sent from here, so a tap is recorded the moment it happens
 * and the network is something that catches up afterwards.
 *
 * It is deliberately not a general offline layer. What is queued is the work a
 * person does standing at the side of a court — a score, a walkover, a
 * correction, a court, a start. Taking a team out is not queued and should not
 * be: the answer changes who gets drawn into the next Swiss round, and a
 * withdrawal sitting in a queue for ten minutes is a round drawn around
 * somebody who has gone home. Neither are join codes, which mint a token that
 * only the server can make. Those still need a signal, and the screen says so.
 *
 * ## Why localStorage
 *
 * The board cache is in IndexedDB (`api/cache.ts`) because it is large and
 * losing it costs nothing. This is the opposite on both counts: a few hundred
 * bytes, and losing it loses a result nobody else has. localStorage is
 * synchronous, so an entry is durable before `enqueue` returns — there is no
 * window where the phone can be locked, the tab killed, and the write gone.
 */

const KEY = "seedly.outbox";

/** 0 is the first try. After that, long enough to be worth waiting for. */
const BACKOFF_MS = [0, 2_000, 5_000, 10_000, 20_000, 30_000];

const backoff = (attempts: number) =>
  BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)]!;

// ---------------------------------------------------------------------------
// what the screen is told
// ---------------------------------------------------------------------------

/**
 * A write the server refused.
 *
 * Not everything that fails is worth retrying, and telling the two apart is
 * the difference between a queue that drains and one that spins forever. A
 * knockout will not store a level score, and neither will a tournament whose
 * scoring says draws are not a result — both come back 400. Retrying those
 * until the end of time would leave an organiser watching "1 result waiting"
 * all afternoon with nothing explaining why. So a refusal comes out of the
 * queue and is put in front of them instead.
 */
export interface Rejection {
  tournament: Id;
  fixture: Id;
  message: string;
}

export interface OutboxSnapshot {
  /** Written but not yet read back, so still worth drawing on the board. */
  entries: Queued[];
  /** Waiting to be sent. This is the number the organiser cares about. */
  waiting: number;
  sending: boolean;
  /** Set once a send has failed and we are waiting to try again. */
  offline: boolean;
  rejections: Rejection[];
}

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------

let queue: Queued[] = read();
let rejections: Rejection[] = [];
let sending = false;
let offline = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

/**
 * Rebuilt on change and handed out unchanged in between.
 *
 * `useSyncExternalStore` re-renders whenever the snapshot is a different
 * object, so building a fresh one per read would render this screen forever.
 */
let snapshot: OutboxSnapshot = build();

function build(): OutboxSnapshot {
  return {
    entries: queue,
    waiting: queue.filter((entry) => entry.state === "queued").length,
    sending,
    offline,
    rejections,
  };
}

function changed() {
  snapshot = build();
  for (const listener of listeners) listener();
}

function read(): Queued[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Queued[];
    // Anything that was already sent belongs to a page that is gone; it landed
    // on the server, and the board will be read fresh on the way back in.
    return parsed.filter((entry) => entry.state === "queued");
  } catch {
    return []; // private mode, or something else wrote nonsense here
  }
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // Nothing to persist with. The queue still works for this page load, which
    // is most of the value — this only stops mattering if the tab is closed.
  }
}

// ---------------------------------------------------------------------------
// the queue
// ---------------------------------------------------------------------------

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getSnapshot = (): OutboxSnapshot => snapshot;

/**
 * Record something, durably, and start trying to send it.
 *
 * Returns once it is stored — not once it is sent. That is the whole point:
 * the sheet closes, the row updates, and whether there was a signal is a
 * question for the pill at the top of the screen.
 */
export function enqueue(tournament: Id, intent: Intent): void {
  queue = collapse(queue, {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tournament,
    intent,
    at: Date.now(),
    state: "queued",
    attempts: 0,
  });
  write();
  changed();
  void flush();
}

/**
 * Which entries a refresh is about to account for.
 *
 * Taken *before* the board is loaded, and handed back to `acknowledge` after.
 * An entry that is sent while a load is in flight may or may not be in the
 * response, so it is not in this list and stays on the board until a later
 * refresh has definitely seen it. Acknowledging everything sent at the moment
 * the load returns is how a result vanishes for one render.
 */
export const sentSoFar = (): string[] =>
  queue.filter((entry) => entry.state === "sent").map((entry) => entry.id);

/**
 * Drop the entries that have been read back off the board.
 *
 * Called by the screen after a refresh, not by the send. An entry stays on the
 * board between landing on the server and the reload arriving, or the match
 * blinks back to unplayed in between.
 */
export function acknowledge(ids: string[]): void {
  if (ids.length === 0) return;
  const done = new Set(ids);
  const next = queue.filter((entry) => !done.has(entry.id));
  if (next.length === queue.length) return;
  queue = next;
  write();
  changed();
}

export function dismissRejections(): void {
  if (rejections.length === 0) return;
  rejections = [];
  changed();
}

// ---------------------------------------------------------------------------
// sending
// ---------------------------------------------------------------------------

/**
 * The account the queue writes as.
 *
 * Held here rather than passed in, because a flush can fire from a timer or an
 * `online` event with no component mounted to pass anything. `ensureOrganiser`
 * is the same call the rest of the app makes and is idempotent; the stored
 * session is tried first so the ordinary case costs no request at all.
 */
let session: Session | null = null;
/**
 * Set when the token was refused, so the next attempt goes the long way round.
 *
 * Without it a 401 is a loop: the stored session is the token that was just
 * refused, and reading it back off the device would present the same expired
 * credential every time the backoff fired. `ensureOrganiser` is the call that
 * actually renews, and this is what forces it.
 */
let stale = false;

async function activeSession(): Promise<Session> {
  if (stale) {
    stale = false;
    return (session = await ensureOrganiser());
  }
  return (session ??= storedSession() ?? (await ensureOrganiser()));
}

async function send(entry: Queued): Promise<void> {
  const active = await activeSession();
  const { intent } = entry;
  const at = new Date(entry.at);

  switch (intent.kind) {
    case "result":
      // Points first, then the result: the fixture write is the one that
      // rebuilds the tables, and it should be the last thing the server sees
      // or the tiebreak is computed from the sets as they were a request ago.
      await saveGames(active, intent.fixture, intent.sets, true);
      await saveResult(active, intent.fixture, intent.home, intent.away, at);
      return;

    case "walkover":
      await saveGames(active, intent.fixture, [], true);
      await saveWalkover(active, intent.fixture, intent.winner, at);
      return;

    case "clear":
      await saveGames(active, intent.fixture, [], false);
      await clearResult(active, intent.fixture, intent.status);
      return;

    case "schedule":
      await setSchedule(active, intent.fixture, {
        // Rebuilt key by key: `setSchedule` reads an absent key as "leave it
        // alone", and handing it the intent whole would work only by accident
        // of the two shapes agreeing.
        ...(intent.court === undefined ? {} : { court: intent.court }),
        ...(intent.scheduled_at === undefined
          ? {}
          : { scheduled_at: intent.scheduled_at }),
      });
      return;

    case "live":
      await setLive(active, intent.fixture, intent.live, at);
      return;
  }
}

/**
 * Whether it is worth trying this one again.
 *
 * A refusal is the server having read the request and said no; sending it a
 * second time gets the same answer. A 401 is the one status worth one more go,
 * because the token expires on its own schedule and re-authenticating fixes
 * it — so the session is dropped and the next attempt rebuilds it. Everything
 * that is not an `ApiError` at all never reached the server: fetch throws a
 * TypeError with no signal, and that is exactly what this queue exists for.
 */
function permanent(thrown: unknown): thrown is ApiError {
  if (!(thrown instanceof ApiError)) return false;
  if (thrown.status === 401) {
    session = null;
    stale = true;
    return false;
  }
  return thrown.status >= 400 && thrown.status < 500;
}

/**
 * Send what is waiting, oldest first, and stop at the first thing that fails.
 *
 * Stopping matters. Two writes to one fixture are collapsed before they get
 * here, but two fixtures in the same pool are not, and carrying on past a
 * failure would send the second and leave the first — a table rebuilt from a
 * pool that is missing the earlier of two results it should have had. Draining
 * in order means the server always sees a prefix of what happened.
 */
export async function flush(): Promise<void> {
  if (sending) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  const waiting = queue.filter((entry) => entry.state === "queued");
  if (waiting.length === 0) {
    if (offline) {
      offline = false;
      changed();
    }
    return;
  }

  sending = true;
  changed();

  let failed = false;

  for (const entry of waiting) {
    try {
      await send(entry);
      // Sent, not gone: it stays on the board until the screen has read the
      // server's version back. See `acknowledge`.
      queue = queue.map((held) =>
        held.id === entry.id ? { ...held, state: "sent" as const, error: undefined } : held,
      );
      write();
      changed();
    } catch (thrown) {
      const message =
        thrown instanceof Error ? thrown.message : "That could not be saved.";

      if (permanent(thrown)) {
        // Refused, not undelivered. Out of the queue and on to the screen.
        rejections = [
          ...rejections,
          { tournament: entry.tournament, fixture: entry.intent.fixture, message },
        ];
        queue = queue.filter((held) => held.id !== entry.id);
        write();
        changed();
        continue;
      }

      queue = queue.map((held) =>
        held.id === entry.id
          ? { ...held, attempts: held.attempts + 1, error: message }
          : held,
      );
      write();
      failed = true;
      break;
    }
  }

  sending = false;
  offline = failed;
  changed();

  if (failed) {
    const attempts = Math.max(...queue.map((entry) => entry.attempts), 0);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, backoff(attempts));
  }
}

/**
 * The three things that mean it is worth trying again.
 *
 * `online` is the obvious one and the least reliable — a phone reports itself
 * online the moment it associates with an access point, which in a hall is
 * some time before anything routes. Coming back to the tab is the one that
 * actually correlates with a person having walked somewhere with signal, and
 * the backoff timer is the floor under both.
 */
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flush();
  });
}
