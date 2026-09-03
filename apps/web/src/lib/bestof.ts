import type { ScoringConfig } from "@seedly/engine";

/**
 * What "best of three" means to a match sheet.
 *
 * `scoring.bestOf` was stored by the sport presets for months and read by
 * nobody: the sheet counted whatever sets had been entered and the organiser
 * decided when the match was over. So a volleyball match could be saved 1–0
 * with the third set still to come, and the table took it.
 *
 * The server refuses that now, which is what makes the rule true. This is the
 * same arithmetic on the near side of the wire — not because the server needs
 * help, but because the result goes into a queue that may not drain for ten
 * minutes, and "we could not save that" arriving after the teams have left is
 * not a refusal anybody can act on.
 */

/** How many sets take the match, or 0 when a single score decides it. */
export function setsToWin(scoring: ScoringConfig | null): number {
  const bestOf = scoring?.bestOf ?? 0;
  if (bestOf < 2) return 0;
  return Math.floor(bestOf / 2) + 1;
}

/** Why a score cannot end the match, or null when it can. */
export type ScoreFault = "unfinished" | "over";

/**
 * The same three rules the server applies, in the same order: a match is over
 * when somebody has the sets, it is not over before that, and it cannot have
 * gone on longer than the format has sets in it.
 */
export function scoreFault(
  bestOf: number,
  home: number,
  away: number,
): ScoreFault | null {
  const need = setsToWin({ bestOf } as ScoringConfig);
  if (need === 0) return null;

  const high = Math.max(home, away);
  const low = Math.min(home, away);

  if (high < need) return "unfinished";
  if (high > need || high + low > bestOf) return "over";
  return null;
}

/**
 * Whether the match is won, given the sets as they stand.
 *
 * This is what turns the sheet from a scoreboard into something that knows the
 * match is finished — the moment a second set goes to one side of a best of
 * three, there is nothing left to enter.
 */
export const matchIsDecided = (
  scoring: ScoringConfig | null,
  home: number,
  away: number,
): boolean => {
  const need = setsToWin(scoring);
  return need > 0 && Math.max(home, away) >= need;
};

/**
 * Whether another set can be added.
 *
 * Two ways to be at the end of them: somebody has won enough, or the format
 * has run out. A fifth set in a best of five is the second one.
 */
export const canAddSet = (
  scoring: ScoringConfig | null,
  played: number,
  home: number,
  away: number,
): boolean => {
  const bestOf = scoring?.bestOf ?? 0;
  if (setsToWin(scoring) === 0) return true; // no format, no limit
  return played < bestOf && !matchIsDecided(scoring, home, away);
};
