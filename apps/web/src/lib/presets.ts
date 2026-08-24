/**
 * Three ways to run a day, and what each one costs in matches.
 *
 * The wizard never asks "how many pools" or "how many advance" — those are
 * answers to a question an organiser has not asked yet. It asks how long the
 * day should be, and derives the rest from the number of teams. The numbers
 * shown next to each choice are the point of the screen: "28 matches, about
 * four hours on two courts" is a decision someone can actually make.
 *
 * Everything here is pure. The stage records these describe are written at
 * launch, in `lib/launch.ts`.
 */

export type PresetId = "knockout" | "groups" | "everyone";

export interface StageSpec {
  name: string;
  format: "round_robin" | "single_elim";
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
  title: string;
  /** One word in the corner of the card: what this choice is FOR. */
  tag: string;
  blurb: string;
  minTeams: number;
  /** "2 groups of 4, then semi-finals" — the shape, for this many teams. */
  shape: (teams: number) => string;
  matches: (teams: number) => number;
  stages: (teams: number) => StageSpec[];
}

/** A rough court slot: the match, plus getting the next pair on. */
const MINUTES_PER_MATCH = 25;

const combinations = (n: number) => (n * (n - 1)) / 2;

/** Pools of at most five, and never fewer than two pools. */
export const poolCount = (teams: number) => Math.max(2, Math.ceil(teams / 5));

/** Snake distribution fills pools as evenly as it can; sizes follow. */
function poolSizes(teams: number): number[] {
  const pools = poolCount(teams);
  const base = Math.floor(teams / pools);
  const remainder = teams % pools;
  return Array.from({ length: pools }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * A knockout plays one match per eliminated team, whatever the byes do to the
 * bracket size, plus the third-place match when there are semi-finals.
 */
const knockoutMatches = (teams: number) => Math.max(teams - 1, 0) + (teams >= 4 ? 1 : 0);

const roundName = (teams: number) =>
  teams <= 2 ? "a final" :
  teams <= 4 ? "semi-finals" :
  teams <= 8 ? "quarter-finals" :
  `a round of ${2 ** Math.ceil(Math.log2(teams))}`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const PRESETS: Preset[] = [
  {
    id: "knockout",
    title: "Straight knockout",
    tag: "Shortest",
    blurb: "Lose once and you are out. The quickest way to a winner, and the least playing time for whoever draws badly.",
    minTeams: 2,
    shape: (teams) => `${roundName(teams)} through to the final, plus a third-place match`,
    matches: knockoutMatches,
    stages: () => [
      { name: "Playoff", format: "single_elim", config: { thirdPlace: true } },
    ],
  },
  {
    id: "groups",
    title: "Groups, then playoff",
    tag: "Recommended",
    blurb: "Everyone gets a few guaranteed matches, the top two of each group carry on. What most one-day tournaments do.",
    minTeams: 6,
    shape: (teams) => {
      const sizes = poolSizes(teams);
      const even = sizes.every((size) => size === sizes[0]);
      const groups = even
        ? `${plural(sizes.length, "group")} of ${sizes[0]}`
        : `${plural(sizes.length, "group")} of ${sizes.join(" and ")}`;
      return `${groups}, then ${roundName(sizes.length * 2)} for the top two of each`;
    },
    matches: (teams) => {
      const qualifiers = poolCount(teams) * 2;
      return poolSizes(teams).reduce((total, size) => total + combinations(size), 0) +
        knockoutMatches(qualifiers);
    },
    stages: (teams) => [
      {
        name: "Groups",
        format: "round_robin",
        config: { poolCount: poolCount(teams), advancePerPool: 2 },
      },
      {
        name: "Playoff",
        format: "single_elim",
        config: { thirdPlace: true },
        seedFromPrevious: true,
        advancePerPool: 2,
      },
    ],
  },
  {
    id: "everyone",
    title: "Everyone plays everyone",
    tag: "Longest",
    blurb: "One table, no knockout. Every team plays every other and the table decides it — nobody goes home after two matches.",
    minTeams: 3,
    shape: (teams) => `one group of ${teams}, ${plural(teams - 1, "match")} each, the table decides`,
    matches: combinations,
    stages: () => [
      { name: "Group", format: "round_robin", config: { poolCount: 1 } },
    ],
  },
];

export const presetById = (id: PresetId) =>
  PRESETS.find((preset) => preset.id === id) ?? PRESETS[1];

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

export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes / 15) * 15;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}
