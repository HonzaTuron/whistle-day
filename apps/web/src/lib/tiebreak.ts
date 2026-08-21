import type { DisplayPool, Tiebreaker } from "@seedly/engine";

const CRITERION_LABEL: Record<Tiebreaker, string> = {
  points: "points",
  head_to_head: "head-to-head",
  score_diff: "set difference",
  score_for: "sets won",
  sub_diff: "point difference",
  wins: "wins",
  seed: "seeding",
  draw: "drawing lots",
};

/**
 * When teams finish level, the hall wants to know why one is above the other.
 * The server records which criteria it actually needed; this turns that into a
 * sentence instead of leaving people to guess.
 *
 * Returns null when points alone decided the table, which is most of the time.
 */
export function tiebreakNote(pool: DisplayPool): string | null {
  const beyondPoints = new Set<Tiebreaker>();

  for (const row of pool.standings) {
    for (const criterion of row.tiebreak ?? []) {
      if (criterion !== "points") beyondPoints.add(criterion);
    }
  }
  if (beyondPoints.size === 0) return null;

  const named = [...beyondPoints].map((c) => CRITERION_LABEL[c] ?? c);
  const last = named.pop();
  return named.length > 0
    ? `Level on points — separated by ${named.join(", ")}, then ${last}.`
    : `Level on points — separated by ${last}.`;
}
