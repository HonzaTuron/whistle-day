import type { ScoringConfig, Tiebreaker } from "@whistleday/engine";
import type { CourtsUnit } from "./courts";
import type { MessageKey } from "./i18n";

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

export type SportId =
  | "volleyball"
  | "football"
  | "basketball"
  | "tennis"
  | "padel"
  | "badminton"
  | "table_tennis"
  | "handball"
  | "other";

export interface Sport {
  id: SportId;
  label: MessageKey;
  /** What goes in `tournaments.sport`. Empty for "other" — the projector
   *  renders this field, and "Other" under a tournament name reads as a
   *  mistake rather than as an answer. */
  sport: string;
  /** One line on the chip's own terms: what picking this actually decides. */
  hint: MessageKey;
  scoring: ScoringConfig;
  /**
   * How many sets settle a match, for a sport where that is a real choice —
   * a club plays best of 3 or best of 5 and the wizard should ask rather than
   * guess. Absent where it is not a question: volleyball is always three
   * sets, football and basketball are never sets at all.
   */
  setChoices?: number[];
  /** What this sport calls the place a match happens — see `lib/courts.ts`. */
  courtsUnit: CourtsUnit;
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
    label: "sport.volleyball",
    sport: "volleyball",
    hint: "sport.volleyball.hint",
    scoring: {
      // Sets per fixture. Read by the match sheet and enforced on the wire.
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
    courtsUnit: "courts",
  },
  {
    id: "football",
    label: "sport.football",
    sport: "football",
    hint: "sport.football.hint",
    scoring: {
      bestOf: 1,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      drawsAllowed: true,
      walkoverScore: 3,
      tiebreakers: GENERIC_TIEBREAKERS,
    },
    courtsUnit: "pitches",
  },
  {
    id: "basketball",
    label: "sport.basketball",
    sport: "basketball",
    hint: "sport.basketball.hint",
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
    courtsUnit: "courts",
  },
  {
    id: "tennis",
    label: "sport.tennis",
    sport: "tennis",
    hint: "sport.tennis.hint",
    scoring: {
      bestOf: 3,
      pointsWin: 2,
      pointsDraw: 0,
      pointsLoss: 0,
      drawsAllowed: false,
      walkoverScore: 2,
      tiebreakers: ["points", "head_to_head", "score_diff", "sub_diff", "score_for", "seed"],
    },
    setChoices: [3, 5],
    courtsUnit: "courts",
  },
  {
    id: "padel",
    label: "sport.padel",
    sport: "padel",
    hint: "sport.padel.hint",
    scoring: {
      bestOf: 3,
      pointsWin: 2,
      pointsDraw: 0,
      pointsLoss: 0,
      drawsAllowed: false,
      walkoverScore: 2,
      tiebreakers: ["points", "head_to_head", "score_diff", "sub_diff", "score_for", "seed"],
    },
    setChoices: [3, 5],
    courtsUnit: "courts",
  },
  {
    id: "badminton",
    label: "sport.badminton",
    sport: "badminton",
    hint: "sport.badminton.hint",
    scoring: {
      bestOf: 3,
      pointsWin: 2,
      pointsDraw: 0,
      pointsLoss: 0,
      drawsAllowed: false,
      walkoverScore: 2,
      tiebreakers: ["points", "head_to_head", "score_diff", "sub_diff", "score_for", "seed"],
    },
    setChoices: [3, 5],
    courtsUnit: "courts",
  },
  {
    id: "table_tennis",
    label: "sport.table_tennis",
    sport: "table_tennis",
    hint: "sport.table_tennis.hint",
    scoring: {
      bestOf: 5,
      pointsWin: 2,
      pointsDraw: 0,
      pointsLoss: 0,
      drawsAllowed: false,
      walkoverScore: 2,
      tiebreakers: ["points", "head_to_head", "score_diff", "sub_diff", "score_for", "seed"],
    },
    setChoices: [3, 5, 7],
    courtsUnit: "tables",
  },
  {
    id: "handball",
    label: "sport.handball",
    sport: "handball",
    hint: "sport.handball.hint",
    scoring: {
      bestOf: 1,
      pointsWin: 2,
      pointsDraw: 1,
      pointsLoss: 0,
      drawsAllowed: true,
      walkoverScore: 2,
      tiebreakers: GENERIC_TIEBREAKERS,
    },
    courtsUnit: "courts",
  },
  {
    id: "other",
    label: "sport.other",
    sport: "",
    hint: "sport.other.hint",
    scoring: {
      bestOf: 1,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      drawsAllowed: true,
      walkoverScore: 0,
      tiebreakers: GENERIC_TIEBREAKERS,
    },
    setChoices: [1, 3, 5],
    courtsUnit: "courts",
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

/**
 * What each criterion is called where somebody has to order them by hand, and
 * what it is called inside a sentence.
 *
 * Two names rather than one because they are not the same word twice: a row in
 * a list is "Head-to-head", and the note under a table reads "separated by
 * head-to-head". Czech is the same, and neither language lowercases the first
 * to get the second.
 */
export const TIEBREAK_LABELS: Record<
  Tiebreaker,
  { label: MessageKey; hint: MessageKey; inline: MessageKey }
> = {
  points: {
    label: "tiebreak.points",
    hint: "tiebreak.points.hint",
    inline: "tiebreak.inline.points",
  },
  head_to_head: {
    label: "tiebreak.head_to_head",
    hint: "tiebreak.head_to_head.hint",
    inline: "tiebreak.inline.head_to_head",
  },
  score_diff: {
    label: "tiebreak.score_diff",
    hint: "tiebreak.score_diff.hint",
    inline: "tiebreak.inline.score_diff",
  },
  score_for: {
    label: "tiebreak.score_for",
    hint: "tiebreak.score_for.hint",
    inline: "tiebreak.inline.score_for",
  },
  sub_diff: {
    label: "tiebreak.sub_diff",
    hint: "tiebreak.sub_diff.hint",
    inline: "tiebreak.inline.sub_diff",
  },
  wins: {
    label: "tiebreak.wins",
    hint: "tiebreak.wins.hint",
    inline: "tiebreak.inline.wins",
  },
  seed: {
    label: "tiebreak.seed",
    hint: "tiebreak.seed.hint",
    inline: "tiebreak.inline.seed",
  },
  draw: {
    label: "tiebreak.draw",
    hint: "tiebreak.draw.hint",
    inline: "tiebreak.inline.draw",
  },
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
