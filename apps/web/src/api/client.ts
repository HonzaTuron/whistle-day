import PocketBase, { ClientResponseError } from "pocketbase";
import { tr } from "../lib/i18n";

/**
 * The one PocketBase client.
 *
 * ## Why it is not created at module scope
 *
 * The same reason `__root.tsx` builds its `QueryClient` per render: under
 * Start the document is rendered on the server for every request, and a
 * client created when the module loads would be shared between them. This one
 * carries an auth token, so sharing it is not a stale cache — it is one
 * organiser's session answering somebody else's request. It is also built on
 * `localStorage`, which does not exist there at all.
 *
 * So it is made on first use in a browser and never on a server. Everything
 * that calls it runs from an effect or a query, which is to say after
 * hydration, so nothing has to wait for it.
 *
 * ## Two settings that are not defaults
 *
 * **Auto-cancellation is off.** The SDK cancels an in-flight request when a
 * second one with the same key is made, which is a sensible default for a
 * screen that re-renders and a disaster for this app: the outbox drains
 * results one at a time in order, and cancelling the first because the second
 * arrived would send the server a result that depends on one it never got.
 * The board also polls while the match sheet writes. Rather than remembering
 * `requestKey: null` at forty call sites, it is off here.
 *
 * **Auth state lives in our own store, not the SDK's.** The SDK would happily
 * keep a token in `localStorage` for us. It would not keep the password, and
 * for a device account that password is the only way back once a token has
 * expired — there is no email to send a reset to and no provider to sign in
 * with. So `organiser.ts` stays the owner of the session and this file
 * mirrors it into `pb.authStore`, which is what makes the SDK send the
 * Authorization header.
 *
 * ## What deliberately does not use this
 *
 * Two files still call `fetch` directly, and both should stay that way.
 *
 * `preview.ts` runs during the **build**, not only in a browser: the printable
 * sheets and the marketing pages are prerendered against `POST /api/preview`
 * by a Node process that has no `window` at all. Everything here would throw
 * there. It is also the one request worth letting a CDN keep, which is a plain
 * `fetch` concern rather than an SDK one.
 *
 * `display.ts` reads the projector payload with `If-None-Match` and expects a
 * 304 with no body — the SDK hands back parsed JSON and has nowhere to put
 * "nothing changed". It also drives its own `EventSource` with reconnect
 * behaviour worked out against real halls and real dropouts. `pb.realtime`
 * would do that job, but swapping it is a change to the least testable and
 * least forgiving screen in the app, and there is nothing wrong with it.
 */

let instance: PocketBase | null = null;

/**
 * The client, or null on the server.
 *
 * Null rather than a throw: the callers are queries and effects that already
 * do not run during SSR, and a module that explodes on import would take the
 * prerender with it.
 */
export function client(): PocketBase | null {
  if (typeof window === "undefined") return null;
  if (instance) return instance;

  // Same origin. The API and the app are served together, and a base URL in a
  // build-time variable is one more thing to get wrong per deployment.
  instance = new PocketBase(window.location.origin);
  instance.autoCancellation(false);
  return instance;
}

/**
 * The client, insisting. For the paths that cannot do anything useful without
 * one and are only ever reached from a browser.
 */
export function pb(): PocketBase {
  const c = client();
  if (!c) throw new Error("PocketBase is not available on the server");
  return c;
}

/** Point the SDK at an account, so its requests carry the token. */
export function useToken(token: string, record?: Record<string, unknown>): void {
  const c = client();
  if (!c) return;
  // `record` is only what the SDK echoes back on `authStore.record`; nothing
  // in this app reads it, and the session we keep is the real one.
  c.authStore.save(token, (record ?? null) as never);
}

export function forgetToken(): void {
  client()?.authStore.clear();
}

/**
 * What the rest of the app calls an error.
 *
 * The SDK throws `ClientResponseError` for everything, including a network
 * failure that never reached the server — which it reports as status 0. That
 * distinction is load-bearing: the offline queue retries what never arrived
 * and gives up on what was refused, and treating a dropped connection as a
 * refusal would throw away a result somebody typed at the side of a court.
 */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** True when the server never answered, so the request is worth repeating. */
export const isOffline = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 0;

/**
 * Turn whatever the SDK threw into an `ApiError` with a sentence worth
 * showing somebody.
 *
 * PocketBase reports validation failures per field, and the field name is
 * half the message: "Failed to create record." tells an organiser nothing,
 * while "name: The value is required." at least points at the box to fix. So
 * the fields are named, exactly as the hand-written transport did before the
 * SDK replaced it.
 */
export function asApiError(thrown: unknown): ApiError {
  if (thrown instanceof ApiError) return thrown;

  if (thrown instanceof ClientResponseError) {
    const data =
      (thrown.response as { data?: Record<string, { message?: string } | undefined> })
        ?.data ?? {};

    const fields = Object.entries(data)
      .map(([field, detail]) => (detail?.message ? `${field}: ${detail.message}` : field))
      .join(", ");

    return new ApiError(
      fields || thrown.response?.message || tr("error.request", { status: thrown.status }),
      thrown.status,
    );
  }

  return new ApiError(thrown instanceof Error ? thrown.message : "request failed", 0);
}

/** Run an SDK call and rethrow its failure in this app's shape. */
export async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (thrown) {
    throw asApiError(thrown);
  }
}
