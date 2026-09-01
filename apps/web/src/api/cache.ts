import type { Id } from "@seedly/engine";
import type { Board } from "./organiser";

/**
 * The last board this device was shown, kept so a reload is not a blank screen.
 *
 * Without it, an organiser who reloads — or whose phone drops the tab out of
 * memory in their pocket, which is the ordinary way a phone behaves — comes
 * back to "Loading…" and then an error, holding a device that knows everything
 * about the tournament except how to say it. The outbox keeps their unsent
 * results; this keeps the match list those results belong to.
 *
 * It is a cache and nothing more. The board is read from the server on every
 * mount and this is overwritten by what comes back; nothing is ever merged out
 * of it, and losing it costs one round trip. What makes the screen correct
 * while offline is this plus the outbox overlay, composed at render — see
 * `lib/pending.ts`.
 *
 * IndexedDB rather than localStorage, for the reason the outbox is the other
 * way round: five hundred fixtures with their slots expanded is most of a
 * megabyte, and writing that synchronously after every result would stutter
 * the one screen that must never feel slow. Losing a cache write is harmless,
 * so the asynchrony costs nothing here.
 */

const DB_NAME = "seedly";
const STORE = "boards";
const VERSION = 1;

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

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
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
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return open().then(
    (open) =>
      new Promise((resolve) => {
        if (!open) return resolve(null);
        try {
          const request = work(open.transaction(STORE, mode).objectStore(STORE));
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
  transact<Board>("readonly", (store) => store.get(tournament) as IDBRequest<Board>);

/**
 * Keep the board that has just been read.
 *
 * Nothing awaits this. A slow disk must not sit between a result landing and
 * the list redrawing, and a write that fails leaves the previous board in
 * place, which is still better than none.
 */
export function writeBoard(tournament: Id, board: Board): void {
  void transact("readwrite", (store) => store.put(board, tournament));
}

/** Drop a tournament nobody on this device is running any more. */
export function forgetBoard(tournament: Id): void {
  void transact("readwrite", (store) => store.delete(tournament));
}
