import type { DisplayPayload, Id } from "@seedly/engine";
import type { Board } from "./organiser";

/**
 * What this device was last shown, kept so a reload is not a blank screen.
 *
 * Without it, an organiser who reloads — or whose phone drops the tab out of
 * memory in their pocket, which is the ordinary way a phone behaves — comes
 * back to "Loading…" and then an error, holding a device that knows everything
 * about the tournament except how to say it. The outbox keeps their unsent
 * results; this keeps the match list those results belong to. A screen has the
 * same reload and no queue to protect: precaching the shell means a projector
 * starts from the device, and this is what it has to draw once it has.
 *
 * It is a cache and nothing more. What it holds is read from the server on
 * every mount and overwritten by what comes back; nothing is ever merged out
 * of it, and losing it costs one round trip. What makes the organiser's screen
 * correct while offline is this plus the outbox overlay, composed at render —
 * see `lib/pending.ts`.
 *
 * IndexedDB rather than localStorage, for the reason the outbox is the other
 * way round: five hundred fixtures with their slots expanded is most of a
 * megabyte, and writing that synchronously after every result would stutter
 * the one screen that must never feel slow. Losing a cache write is harmless,
 * so the asynchrony costs nothing here.
 */

const DB_NAME = "seedly";
const BOARDS = "boards";
const DISPLAYS = "displays";
const VERSION = 2;

let db: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  return (db ??= new Promise((resolve) => {
    // Private windows, disabled site data, and a handful of embedded browsers
    // have no usable IndexedDB. None of them are a reason for the app not to
    // work — the cache is the thing that goes missing, not the tournament.
    if (typeof indexedDB === "undefined") return resolve(null);

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, VERSION);
    } catch {
      return resolve(null);
    }

    // Version 1 was boards alone. A device that has one keeps it and gains the
    // second store; the version bump is the whole migration.
    request.onupgradeneeded = () => {
      for (const store of [BOARDS, DISPLAYS]) {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store);
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // A second tab holding an older version open. Rare, and not worth blocking
    // a match list on: this load goes to the network like it always did.
    request.onblocked = () => resolve(null);
  }));
}

function transact<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return open().then(
    (open) =>
      new Promise((resolve) => {
        if (!open) return resolve(null);
        try {
          const request = work(open.transaction(store, mode).objectStore(store));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

/** The board as it was last read from the server, or null for a cold device. */
export const readBoard = (tournament: Id): Promise<Board | null> =>
  transact<Board>(BOARDS, "readonly", (store) => store.get(tournament) as IDBRequest<Board>);

/**
 * Keep the board that has just been read.
 *
 * Nothing awaits this. A slow disk must not sit between a result landing and
 * the list redrawing, and a write that fails leaves the previous board in
 * place, which is still better than none.
 */
export function writeBoard(tournament: Id, board: Board): void {
  void transact(BOARDS, "readwrite", (store) => store.put(board, tournament));
}

/** Drop a tournament nobody on this device is running any more. */
export function forgetBoard(tournament: Id): void {
  void transact(BOARDS, "readwrite", (store) => store.delete(tournament));
}

/** A screen payload as it was last served, kept under the token that read it. */
export interface CachedDisplay {
  payload: DisplayPayload;
  /**
   * The tag the payload was served under, so a screen that comes up on the
   * cache can still ask the cheap question — `If-None-Match`, and a 304 that
   * says what is already on the wall is current. The tag is stored with the
   * payload and only ever sent back with it: a tag on its own would earn a 304
   * with no body and nothing to draw.
   */
  etag: string | null;
}

/** The payload this screen last saw, or null for a cold device. */
export const readDisplay = (token: string): Promise<CachedDisplay | null> =>
  transact<CachedDisplay>(
    DISPLAYS,
    "readonly",
    (store) => store.get(token) as IDBRequest<CachedDisplay>,
  );

/** Keep the payload that has just been read. Not awaited, as above. */
export function writeDisplay(
  token: string,
  payload: DisplayPayload,
  etag: string | null,
): void {
  void transact(DISPLAYS, "readwrite", (store) => store.put({ payload, etag }, token));
}

/** Drop a screen link the server no longer answers for. */
export function forgetDisplay(token: string): void {
  void transact(DISPLAYS, "readwrite", (store) => store.delete(token));
}
