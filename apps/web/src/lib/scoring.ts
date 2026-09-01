import type { ScoringConfig, Tiebreaker } from "@seedly/engine";

/**
 * How a sport is scored, and what each tiebreak is called on a screen.
 *
 * The wizard asks for a sport, not for a points table. "Volleyball" is a
 * question an organiser can answer while holding a clipboard; "how many points
 * for a win, and is a draw possible" is one they can only answer by looking it
 * up, and the answer is the same every time for the sport they run every year.
 *
 * The numbers a sport implies are still shown and still editable on the
 * scoring sheet, because a local league that awards two points for a win is
 * not a bug in the preset — it is a local league.
 */

export type SportId = "volleyball" | "football" | "basketball" | "other";

export interface Sport {
  id: SportId;
  label: string;
  /** What goes in `tournaments.sport`. Empty for "other" — the projector
   *  renders this field, and "Other" under a tournament name reads as a
   *  mistake rather than as an answer. */
  sport: string;
  /** One line on the chip's own terms: what picking this actually decides. */
  hint: string;
  scoring: ScoringConfig;
}

/**
 * The tiebreak order the app has always used, and still the right answer for
 * anything played to a single score.
 */
const GENERIC_TIEBREAKERS: Tiebreaker[] = [
  "points",
  "head_to_head",
  "score_diff",
  "score_for",
  "seed",
];

export const SPORTS: Sport[] = [
  {
    id: "volleyball",
    label: "Volleyball",
    sport: "volleyball",
    hint: "Sets decide it, and no match ends level.",
    scoring: {
      // Sets per fixture. Nothing reads this yet — see the README — but a
      // stored 1 would be wrong the day something does.
      bestOf: 3,
      pointsWin: 2,
      pointsDraw: 0,
      pointsLoss: 0,
      drawsAllowed: false,
      walkoverScore: 2,
      // Sets separate a volleyball table before points within them do, which
      // is what score_diff and sub_diff are here: sets, then rally points.
      tiebreakers: ["points", "head_to_head", "score_diff", "sub_diff", "score_for", "seed"],
    },
  },
  {
    id: "football",
    label: "Football",
    sport: "football",
    hint: "Three for a win, one for a draw.",
    scoring: {
      bestOf: 1,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      drawsAllowed: true,
      walkoverScore: 3,
      tiebreakers: GENERIC_TIEBREAKERS,
    },
  },
  {
    id: "basketball",
    label: "Basketball",
    sport: "basketball",
    hint: "Two for a win, one for a loss, and no draws.",
    scoring: {
      bestOf: 1,
      // FIBA credits a point for turning up and losing, which is why the loss
      // column is not zero and why this preset is worth having.
      pointsWin: 2,
      pointsDraw: 0,
      pointsLoss: 1,
      drawsAllowed: false,
      walkoverScore: 20,
      tiebreakers: GENERIC_TIEBREAKERS,
    },
  },
  {
    id: "other",
    label: "Something else",
    sport: "",
    hint: "Three for a win, one for a draw. Change it later if that is wrong.",
    scoring: {
      bestOf: 1,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      drawsAllowed: true,
      walkoverScore: 0,
      tiebreakers: GENERIC_TIEBREAKERS,
    },
  },
];

/**
 * The default is the generic one, not the most popular one. A tournament
 * quietly scored as volleyball because nobody tapped a chip is worse than one
 * scored as nothing in particular.
 */
export const DEFAULT_SPORT: SportId = "other";

export const sportById = (id: SportId): Sport =>
  SPORTS.find((sport) => sport.id === id) ?? SPORTS[SPORTS.length - 1];

/**
 * Which chip to light on a tournament that already exists. Matched on the
 * scoring rather than on `sport`, because the scoring is what the chip
 * actually sets — a volleyball day whose points have been edited by hand is no
 * longer the volleyball preset and should not claim to be.
 */
export function matchSport(sport: string, scoring: ScoringConfig | null): SportId | null {
  if (!scoring) return null;
  const found = SPORTS.find(
    (candidate) =>
      candidate.sport === sport &&
      candidate.scoring.pointsWin === scoring.pointsWin &&
      candidate.scoring.pointsDraw === scoring.pointsDraw &&
      candidate.scoring.pointsLoss === scoring.pointsLoss &&
      candidate.scoring.drawsAllowed === drawsAllowed(scoring),
  );
  return found?.id ?? null;
}

/**
 * Absent means yes, matching the server. Every tournament written before the
 * field existed was being scored football-style, and reading a missing field
 * as `false` would tell an organiser their day has no draws in it the morning
 * after it recorded three.
 */
export const drawsAllowed = (scoring: ScoringConfig | null): boolean =>
  scoring?.drawsAllowed !== false;

/** What each criterion is called where somebody has to order them by hand. */
export const TIEBREAK_LABELS: Record<Tiebreaker, { label: string; hint: string }> = {
  points: { label: "Points", hint: "The table's own column." },
  head_to_head: { label: "Head-to-head", hint: "How the tied teams did against each other." },
  score_diff: { label: "Score difference", hint: "Scored minus conceded." },
  score_for: { label: "Scored", hint: "Total scored, however many were let in." },
  sub_diff: { label: "Point difference", hint: "Across the sets, where sets are kept." },
  wins: { label: "Wins", hint: "Matches won, ignoring how they were won." },
  seed: { label: "Seeding", hint: "The order the teams were entered in. Never a tie." },
  draw: { label: "Drawing lots", hint: "The last resort, decided off the app." },
};

/**
 * The criteria worth offering. `draw` is left out because nothing on the
 * server implements it, and `points` because it is always first — a table
 * ordered by anything before its own points column is not a table.
 */
export const ORDERABLE_TIEBREAKERS: Tiebreaker[] = [
  "head_to_head",
  "score_diff",
  "score_for",
  "sub_diff",
  "wins",
  "seed",
];
