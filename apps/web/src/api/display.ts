import type { DisplayPayload } from "@seedly/engine";
import { useEffect, useRef, useState } from "react";

/**
 * A screen may run unattended for a whole day, so polling has to stay cheap
 * and has to survive the venue wifi dropping out.
 *
 * The server tags every payload; sending the tag back means an unchanged
 * tournament answers 304 with no body. On failure the last good payload stays
 * on screen — a blank projector in a sports hall is worse than a stale one.
 */
const POLL_INTERVAL_MS = 4000;

export interface DisplayState {
  payload: DisplayPayload | null;
  error: string | null;
  /** True once a request has failed since the last success. */
  stale: boolean;
  loading: boolean;
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

    // Reset when the token changes, or a new screen briefly shows the old one.
    etag.current = null;
    setState({ payload: null, error: null, stale: false, loading: true });

    const poll = async () => {
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
          return; // a bad token will not fix itself; stop polling
        } else if (!response.ok) {
          throw new Error(`server returned ${response.status}`);
        } else {
          etag.current = response.headers.get("etag");
          const payload = (await response.json()) as DisplayPayload;
          setState({ payload, error: null, stale: false, loading: false });
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
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token]);

  return state;
}
