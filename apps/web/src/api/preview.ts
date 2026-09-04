import type { StageFormat, StagePlan } from "@seedly/engine";
import { useEffect, useState } from "react";

/**
 * A draw for a tournament that does not exist.
 *
 * `POST /api/preview` runs the same four generators a real stage does, with no
 * record to read and nothing written, so a page about an eight-team knockout
 * can show an eight-team knockout to somebody who has never been here.
 *
 * The alternative was drawing the bracket in TypeScript on the client, which
 * is exactly what `packages/engine` used to do and exactly why it does not any
 * more: two implementations of bracket seeding is how brackets drift. A
 * printable sheet that disagrees with the tournament it was printed for is the
 * worst version of that bug, because nobody finds out until the hall does.
 */
export interface PreviewRequest {
  format: StageFormat;
  /** Ignored when `names` is given. */
  teams?: number;
  names?: string[];
  config?: {
    poolCount?: number;
    advancePerPool?: number;
    legs?: number;
    thirdPlace?: boolean;
    rounds?: number;
  };
}

export async function fetchPreview(
  request: PreviewRequest,
  signal?: AbortSignal,
): Promise<StagePlan> {
  const response = await fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.message ?? `preview failed (${response.status})`);
  }

  const body = (await response.json()) as { plan: StagePlan };
  return body.plan;
}

export type PreviewState =
  | { status: "loading" }
  | { status: "ready"; plan: StagePlan }
  | { status: "failed"; message: string };

/**
 * The draw, fetched on arrival.
 *
 * Deliberately not part of the prerender. The endpoint needs a running server
 * and the build has none, and the value of these pages in an index is the
 * prose and the numbers — which are prerendered — rather than a bracket a
 * crawler would not read anyway. So the page is complete without this and
 * better with it.
 */
export function usePreview(request: PreviewRequest): PreviewState {
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const key = JSON.stringify(request);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    fetchPreview(JSON.parse(key) as PreviewRequest, controller.signal)
      .then((plan) => setState({ status: "ready", plan }))
      .catch((thrown: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "failed",
          message: thrown instanceof Error ? thrown.message : "could not draw it",
        });
      });

    return () => controller.abort();
  }, [key]);

  return state;
}
