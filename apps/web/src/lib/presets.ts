import type { LabelKind } from "@seedly/engine";
import type { MessageKey, Translate } from "./i18n";

/**
 * The ways to run a day, and what each one costs in matches.
 *
 * The wizard never asks "how many pools" or "how many advance" — those are
 * answers to a question an organiser has not asked yet. It asks how long the
 * day should be, and derives the rest from the number of teams. The numbers
 * shown next to each choice are the point of the screen: "28 matches, about
 * four hours on two courts" is a decision someone can actually make.
 *
 * Everything here is pure. What changed when the app learned a second language
 * is that the prose left: a preset now holds message keys, and `shape` is
 * handed a translator rather than building a sentence out of English grammar.
 * The stage records these describe are written at launch, in `api/launch.ts`.
 */

export type PresetId = "knockout" | "double" | "groups" | "swiss" | "everyone";

export interface StageSpec {
  /** The English name, still stored, and the kind that lets it be said again. */
  name: string;
  nameKind: LabelKind;
  format: "round_robin" | "single_elim" | "double_elim" | "swiss";
  config: Record<string, unknown>;
  /**
   * A playoff is seeded from the stage before it. The id does not exist until
   * that stage is created, so the wiring is finished at launch.
   */
  seedFromPrevious?: boolean;
  advancePerPool?: number;
}

export interface Preset {
  id: PresetId;
  title: MessageKey;
  /** One word in the corner of the card: what this choice is FOR. */
  tag: MessageKey;
  blurb: MessageKey;
  minTeams: number;
  /** "2 groups of 4, then semi-finals" — the shape, for this many teams. */
  shape: (t: Translate, teams: number) => string;
  matches: (teams: number) => number;
  stages: (teams: number) => StageSpec[];
}

/** A rough court slot: the match, plus getting the next pair on. */
const MINUTES_PER_MATCH = 25;

/** Every pair meets once: the size of a round robin, in matches. */
export const combinations = (n: number) => (n * (n - 1)) / 2;

/** Pools of at most five, and never fewer than two pools. */
export const poolCount = (teams: number) => Math.max(2, Math.ceil(teams / 5));

/** Snake distribution fills pools as evenly as it can; sizes follow. */
export function poolSizes(teams: number): number[] {
  const pools = poolCount(teams);
  const base = Math.floor(teams / pools);
  const remainder = teams % pools;
  return Array.from({ length: pools }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * A knockout plays one match per eliminated team, whatever the byes do to the
 * bracket size, plus the third-place match when there are semi-finals.
 */
export const knockoutMatches = (teams: number) => Math.max(teams - 1, 0) + (teams >= 4 ? 1 : 0);

/**
 * Swiss rounds: ceil(log2(teams)), the fewest that can leave one team
 * unbeaten, never below three and never above what there are opponents for.
 * It has to agree with swissRoundCount in backend/internal/tournament/swiss.go,
 * or the day would be a round longer than the screen said it would be.
 */
export const swissRounds = (teams: number) =>
  Math.min(Math.max(3, Math.ceil(Math.log2(Math.max(teams, 2)))), Math.max(teams - 1, 1));

/**
 * How far a knockout reaches, named as the round it starts at.
 *
 * 16 and 32 get their own keys rather than being counted into a generic
 * sentence, because Czech has one word for each — osmifinále, šestnáctifinále
 * — and "a round of 16" is not a phrase anybody there says.
 */
const roundName = (t: Translate, teams: number): string => {
  if (teams <= 2) return t("round.final");
  if (teams <= 4) return t("round.semis");
  if (teams <= 8) return t("round.quarters");
  const size = 2 ** Math.ceil(Math.log2(teams));
  if (size === 16) return t("round.of16");
  if (size === 32) return t("round.of32");
  return t("round.of", { size });
};

export const PRESETS: Preset[] = [
  {
    id: "knockout",
    title: "preset.knockout.title",
    tag: "preset.knockout.tag",
    blurb: "preset.knockout.blurb",
    minTeams: 2,
    shape: (t, teams) => t("preset.knockout.shape", { round: roundName(t, teams) }),
    matches: knockoutMatches,
    stages: () => [
      {
        name: "Playoff",
        nameKind: "playoff",
        format: "single_elim",
        config: { thirdPlace: true },
      },
    ],
  },
  {
    id: "double",
    title: "preset.double.title",
    tag: "preset.double.tag",
    blurb: "preset.double.blurb",
    minTeams: 4,
    shape: (t) => t("preset.double.shape"),
    // Everybody but the winner loses twice.
    matches: (teams) => Math.max(2 * teams - 2, 1),
    stages: () => [
      {
        name: "Double elimination",
        nameKind: "double_elim",
        format: "double_elim",
        config: {},
      },
    ],
  },
  {
    id: "groups",
    title: "preset.groups.title",
    tag: "preset.groups.tag",
    blurb: "preset.groups.blurb",
    minTeams: 6,
    shape: (t, teams) => {
      const sizes = poolSizes(teams);
      const even = sizes.every((size) => size === sizes[0]);
      // Two groups of four reads differently from groups of four and three,
      // and both are one message with the count in it rather than a phrase
      // assembled out of pieces — Czech inflects "skupina" past the caller.
      const groups = even
        ? t("preset.groups.even", { count: sizes.length, size: sizes[0]! })
        : t("preset.groups.uneven", {
            count: sizes.length,
            sizes: sizes.join(t("preset.groups.sizesJoin")),
          });
      return t("preset.groups.shape", {
        groups,
        round: roundName(t, sizes.length * 2),
      });
    },
    matches: (teams) => {
      const qualifiers = poolCount(teams) * 2;
      return poolSizes(teams).reduce((total, size) => total + combinations(size), 0) +
        knockoutMatches(qualifiers);
    },
    stages: (teams) => [
      {
        name: "Groups",
        nameKind: "groups",
        format: "round_robin",
        config: { poolCount: poolCount(teams), advancePerPool: 2 },
      },
      {
        name: "Playoff",
        nameKind: "playoff",
        format: "single_elim",
        config: { thirdPlace: true },
        seedFromPrevious: true,
        advancePerPool: 2,
      },
    ],
  },
  {
    id: "swiss",
    title: "preset.swiss.title",
    tag: "preset.swiss.tag",
    blurb: "preset.swiss.blurb",
    minTeams: 8,
    shape: (t, teams) =>
      t("preset.swiss.shape", { count: swissRounds(teams), teams }),
    // Each round is half the field, rounded down: an odd team sits out and
    // takes the win for it.
    matches: (teams) => swissRounds(teams) * Math.floor(teams / 2) + knockoutMatches(4),
    stages: (teams) => [
      {
        name: "Swiss",
        nameKind: "swiss",
        format: "swiss",
        config: { rounds: swissRounds(teams), advancePerPool: 4 },
      },
      {
        name: "Playoff",
        nameKind: "playoff",
        format: "single_elim",
        config: { thirdPlace: true },
        seedFromPrevious: true,
        advancePerPool: 4,
      },
    ],
  },
  {
    id: "everyone",
    title: "preset.everyone.title",
    tag: "preset.everyone.tag",
    blurb: "preset.everyone.blurb",
    minTeams: 3,
    shape: (t, teams) => t("preset.everyone.shape", { teams, count: teams - 1 }),
    matches: combinations,
    stages: () => [
      { name: "Group", nameKind: "group", format: "round_robin", config: { poolCount: 1 } },
    ],
  },
];

export const presetById = (id: PresetId) =>
  PRESETS.find((preset) => preset.id === id) ?? PRESETS[1]!;

export const availablePresets = (teams: number) =>
  PRESETS.filter((preset) => teams >= preset.minTeams);

/**
 * What to have selected when the format screen opens. Enough teams for groups
 * and it is groups; a handful and everyone would rather play everyone than be
 * knocked out in one match; two teams is a final and nothing else.
 */
export function defaultPreset(teams: number): PresetId {
  if (teams >= 6) return "groups";
  if (teams >= 3) return "everyone";
  return "knockout";
}

export interface Estimate {
  matches: number;
  minutes: number;
}

/**
 * Courts run in parallel, so the day is roughly the matches spread across
 * them. It ignores the fact that a knockout round cannot start before the
 * previous one finishes, which is why every number on screen is prefixed "≈".
 */
export function estimate(preset: Preset, teams: number, courts: number): Estimate {
  const matches = preset.matches(teams);
  const parallel = Math.max(courts, 1);
  return {
    matches,
    minutes: Math.ceil(matches / parallel) * MINUTES_PER_MATCH,
  };
}

export function formatDuration(t: Translate, minutes: number): string {
  const rounded = Math.round(minutes / 15) * 15;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (hours === 0) return t("duration.minutes", { minutes: rest });
  if (rest === 0) return t("duration.hours", { hours });
  return t("duration.hoursMinutes", { hours, minutes: rest });
}
