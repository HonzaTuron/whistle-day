/**
 * A page per format per team count.
 *
 * "8 team double elimination bracket" and "5 team round robin" are the
 * searches with real intent behind them and no good answer on the web: the
 * pages that rank for them are mostly a printable PDF from 2009. What somebody
 * asking wants is three numbers — how many matches, how many rounds, how long
 * — and then the thing that does it.
 *
 * So these are generated rather than written. The prose is assembled around
 * the numbers, and the numbers come from `shape.ts`, which comes from the
 * functions the wizard itself quotes. There is no copy here that could be true
 * of one team count and false of another.
 *
 * Awkward field sizes are the point, not an edge case. Five teams, twelve
 * teams, nine teams — the counts that are not a power of two and do not divide
 * evenly — are where somebody is genuinely stuck, and they get the same page
 * as the tidy ones.
 */

import {
  bracketSize,
  byeCount,
  factsFor,
  plural,
  knockoutPath,
  knockoutRounds,
  matchesEach,
  poolShape,
  roundRobinRounds,
} from "./shape";
import {
  combinations,
  knockoutMatches,
  poolCount,
  poolSizes,
  presetById,
  swissRounds,
} from "../lib/presets";
import type { Page } from "./types";

/** Field sizes worth a page of their own, per format. */
const SINGLE_ELIM = range(3, 32);
const DOUBLE_ELIM = [4, 5, 6, 7, 8, 10, 12, 16, 20, 24, 32];
const ROUND_ROBIN = range(3, 16);
const SWISS = [8, 10, 12, 16, 20, 24, 32, 40, 48, 64];
const GROUPS = [6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 24, 28, 32];

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// ---------------------------------------------------------------------------
// single elimination
// ---------------------------------------------------------------------------

function singleElim(teams: number): Page {
  const byes = byeCount(teams);
  const rounds = knockoutRounds(teams);
  const path = knockoutPath(teams);
  const matches = knockoutMatches(teams);

  return {
    slug: `${teams}-team-single-elimination-bracket`,
    kind: "parametric",
    title: `${teams} Team Single Elimination Bracket: Free Generator`,
    h1: `${teams} team single elimination bracket`,
    description:
      `A ${teams} team knockout bracket: ${matches} matches over ${plural(rounds, "round")}` +
      `${byes > 0 ? `, with ${plural(byes, "bye")}` : ""}. Generate it free, no account.`,
    lede:
      `${teams} teams, ${plural(matches, "match")}, ${plural(rounds, "round")}: ` +
      `${path.join(", then ")}. ` +
      (byes > 0
        ? `${teams} is not a power of two, so the bracket is drawn at ${bracketSize(teams)} and ${plural(byes, "team")} skip the first round.`
        : `${teams} is a power of two, so the bracket is full and nobody sits out.`),
    generator: { preset: "knockout", teams },
    facts: factsFor("knockout", teams),
    sections: [
      {
        heading: byes > 0 ? `Where the ${plural(byes, "bye")} go` : "A full bracket",
        body:
          byes > 0
            ? [
                `A knockout bracket holds a power of two. ${teams} teams needs a bracket of ${bracketSize(teams)}, which leaves ${plural(byes, "position")} empty, and each empty position is a bye: a team that does not play in round one and enters in round two.`,
                `The byes go to the top of the draw, to the seeded teams. That is the convention, and it is also the only placement that does not distort the bracket: scattering them at random would hand a free round to whoever happened to land next to one.`,
                `Byes do not add matches. The ${matches} above is one match per eliminated team${teams >= 4 ? ", plus the third-place match" : ""}, and a team that skips round one has simply not played yet.`,
              ]
            : [
                `${teams} is a power of two, so the bracket is exactly full: every team plays in round one and nobody is handed a free pass. It is the tidiest a knockout gets.`,
                `${plural(matches, "match")} in total (one per eliminated team${teams >= 4 ? ", plus the third-place match" : ""}) over ${plural(rounds, "round")}.`,
              ],
      },
      {
        heading: "How the day runs",
        body: [
          `${path.map((name, i) => `${name} (${matchesInRound(teams, i)} ${matchesInRound(teams, i) === 1 ? "match" : "matches"})`).join(", then ")}.`,
          "A knockout round cannot start until the one before it has finished, so the finish time above is optimistic in a way a round robin's is not: the last few rounds run on fewer and fewer courts. Two courts is assumed; a single court roughly doubles it.",
        ],
      },
      {
        heading: "Before it is played",
        body: [
          `The whole bracket exists from the moment you draw it. Positions that do not have a team yet carry the label the server wrote ("Winner QF1" and so on), so it can go on a projector on the morning of the tournament and be read as a plan rather than a grid of blanks.`,
        ],
      },
    ],
    faq: [
      {
        q: `How many matches is a ${teams} team knockout?`,
        a: `${matches}. One for every team eliminated: ${teams - 1} of them${teams >= 4 ? ", plus a third-place match" : ""}.`,
      },
      {
        q: `How many rounds for ${teams} teams?`,
        a: `${rounds}: ${path.join(", ")}.`,
      },
      ...(byes > 0
        ? [
            {
              q: `How many byes with ${teams} teams?`,
              a: `${byes}. The bracket is drawn at ${bracketSize(teams)} and the ${plural(byes, "spare position")} go to the top seeds, who enter in round two.`,
            },
          ]
        : []),
    ],
    related: relatives(
      "single-elimination-bracket-generator",
      neighbours(teams, SINGLE_ELIM).map((n) => `${n}-team-single-elimination-bracket`),
      DOUBLE_ELIM.includes(teams) ? [`${teams}-team-double-elimination-bracket`] : [],
      ["guide/how-to-seed-a-bracket"],
    ),
  };
}

/** Matches in round `index` of a knockout, byes already accounted for. */
function matchesInRound(teams: number, index: number): number {
  const size = bracketSize(teams);
  const pairs = size / 2 ** (index + 1);
  if (index > 0) return pairs;
  // Round one only plays the pairs where both positions hold a real team.
  return Math.max(teams - size / 2, 0);
}

// ---------------------------------------------------------------------------
// double elimination
// ---------------------------------------------------------------------------

function doubleElim(teams: number): Page {
  const matches = presetById("double").matches(teams);
  const knockout = knockoutMatches(teams);

  return {
    slug: `${teams}-team-double-elimination-bracket`,
    kind: "parametric",
    title: `${teams} Team Double Elimination Bracket: Free Generator`,
    h1: `${teams} team double elimination bracket`,
    description:
      `A ${teams} team double elimination bracket: winners bracket, losers bracket and a grand final, ${matches} matches in total. Free.`,
    lede:
      `${teams} teams and two lives each. ${plural(matches, "match")} in total: a winners bracket, the losers bracket that catches everyone it knocks out, and a grand final between the two survivors.`,
    generator: { preset: "double", teams },
    facts: factsFor("double", teams),
    sections: [
      {
        heading: "Why it is about twice the matches",
        body: [
          `Everybody except the winner has to lose twice, so a field of ${teams} produces roughly ${matches} matches against a straight knockout's ${knockout}. That is the whole trade: about double the court time, and almost no chance of the second-best team going home because of one bad draw in round one.`,
          `On two courts at 25 minutes a match that is the difference between a morning and most of a day. Worth checking against how long you actually have the hall for.`,
        ],
      },
      {
        heading: "Everybody gets at least two matches",
        body: [
          `Losing the first one drops a team into the losers bracket rather than out of the building. For a ${teams}-team field that is the cheapest guarantee of a real day out for everybody. The format is popular in esports for the fairness, and it works in a hall for the same reason plus one more: it keeps courts busy and teams in the building.`,
        ],
      },
    ],
    faq: [
      {
        q: `How many matches in a ${teams} team double elimination?`,
        a: `${matches}, about 2 × ${teams} − 2, because everybody but the winner has to lose twice.`,
      },
      {
        q: "How many matches is everybody guaranteed?",
        a: "Two. A team that loses its first match drops into the losers bracket and plays again there.",
      },
    ],
    related: relatives(
      "double-elimination-bracket-generator",
      neighbours(teams, DOUBLE_ELIM).map((n) => `${n}-team-double-elimination-bracket`),
      [`${teams}-team-single-elimination-bracket`],
      ["guide/single-vs-double-elimination"],
    ),
  };
}

// ---------------------------------------------------------------------------
// round robin
// ---------------------------------------------------------------------------

function roundRobin(teams: number): Page {
  const matches = combinations(teams);
  const rounds = roundRobinRounds(teams);
  const each = matchesEach(teams);
  const odd = teams % 2 === 1;

  return {
    slug: `${teams}-team-round-robin-schedule`,
    kind: "parametric",
    title: `${teams} Team Round Robin Schedule: Free Generator`,
    h1: `${teams} team round robin schedule`,
    description:
      `A ${teams} team round robin: ${matches} matches over ${plural(rounds, "round")}, ${each} each, with a live league table. Free, no account.`,
    lede:
      `Every team plays every other. ${plural(matches, "match")} in total, ${plural(each, "match")} each, over ${plural(rounds, "round")}` +
      `${odd ? ", one more than an even field of this size, because somebody sits out every round." : "."}`,
    generator: { preset: "everyone", teams },
    facts: factsFor("everyone", teams),
    sections: [
      {
        heading: odd ? `${teams} is odd, so there is a bye every round` : "Everybody plays every round",
        body: odd
          ? [
              `With ${teams} teams there is no way to pair everybody at once: ${teams - 1} play and one sits out. Over the tournament each team gets exactly one bye, which is why it takes ${rounds} rounds rather than the ${teams - 1} an even field of this size would need.`,
              `A bye is not a match and it is not scored: the fixture count stays at ${matches}, and everybody still plays ${each}. The table is unaffected by who happened to sit out when.`,
            ]
          : [
              `${teams} is even, so every round pairs the whole field: ${teams / 2} matches at once, ${rounds} rounds, and nobody sits out.`,
              `That is the tidiest a round robin gets, and it is why even fields are worth arranging for if you have any say in the entry list.`,
            ],
      },
      {
        heading: "How long it takes",
        body: [
          `${plural(matches, "match")} is the number that decides your day. Spread across two courts at 25 minutes a slot that is the duration quoted above; on one court, double it; on four, halve it.`,
          "Unlike a knockout, a round robin parallelises almost perfectly. There is no round that has to wait for the one before it, so the estimate is a good deal more honest here than it is for a bracket.",
        ],
      },
      {
        heading: "The table, and the argument it prevents",
        body: [
          `${teams} teams playing ${each} matches each will produce a tie somewhere near the top more often than not. Points first, then head-to-head among the tied teams only, then score difference, then points scored, and the table prints which of those actually did the separating.`,
        ],
      },
    ],
    faq: [
      {
        q: `How many matches in a ${teams} team round robin?`,
        a: `${matches}. Every pair meets once: ${teams} × ${teams - 1} ÷ 2.`,
      },
      {
        q: `How many games does each team play?`,
        a: `${each}, one against each of the others, the same for everybody however the results go.`,
      },
      {
        q: `How many rounds?`,
        a: odd
          ? `${rounds}. An odd field needs one round per team, because one team sits out each round.`
          : `${rounds}. An even field pairs completely, so it is one fewer round than there are teams.`,
      },
    ],
    related: relatives(
      "round-robin-generator",
      neighbours(teams, ROUND_ROBIN).map((n) => `${n}-team-round-robin-schedule`),
      GROUPS.includes(teams) ? [`${teams}-team-group-stage-and-playoff`] : [],
      ["league-table-generator", "guide/byes-in-a-round-robin"],
    ),
  };
}

// ---------------------------------------------------------------------------
// swiss
// ---------------------------------------------------------------------------

function swiss(teams: number): Page {
  const rounds = swissRounds(teams);
  const matches = presetById("swiss").matches(teams);
  const odd = teams % 2 === 1;

  return {
    slug: `${teams}-player-swiss-tournament`,
    kind: "parametric",
    title: `${teams} Player Swiss Tournament: Rounds and Pairings`,
    h1: `${teams} player Swiss tournament`,
    description:
      `A ${teams} player Swiss: ${plural(rounds, "round")}, pairings drawn automatically after each one, nobody knocked out. Free generator.`,
    lede:
      `${teams} players, ${plural(rounds, "round")}, and nobody knocked out. Each round pairs players on the same record, and the next round draws itself the moment the last result of the previous one goes in.`,
    generator: { preset: "swiss", teams },
    facts: factsFor("swiss", teams),
    sections: [
      {
        heading: `Why ${rounds} rounds`,
        body: [
          `ceil(log2(${teams})) is ${Math.ceil(Math.log2(teams))}, the fewest rounds that can still leave exactly one player unbeaten, which is the standard answer to "how long should a Swiss be". Whistle.day floors it at three, because a two-round Swiss has not sorted anything out.`,
          `You can run it longer for a fuller table. Against a field of ${teams} there are ${teams - 1} possible opponents, so past that the draw would have nothing fresh left; well before then it will start having to repeat a meeting, and it tells you when it does.`,
        ],
      },
      {
        heading: "Nobody is knocked out",
        body: [
          `Everybody plays all ${rounds} rounds. That is the reason to run a Swiss rather than a knockout for a field this size: ${teams} players in a straight bracket means half of them have finished by the end of round one, and a Swiss gives every one of them the same day.`,
          odd
            ? `${teams} is odd, so one player sits out each round, and that bye takes the points for a win. Scoring it zero would send whoever happened to be the odd one out to the bottom of the table for something they had no part in.`
            : `${teams} is even, so every round pairs the whole field with nobody sitting out.`,
        ],
      },
      {
        heading: "And then a playoff, if you want one",
        body: [
          "The default carries the top four off the Swiss table into semi-finals and a third-place match, which is what the match total above includes. Ending on the table alone works too. It is a stage setting rather than a different format.",
        ],
      },
    ],
    faq: [
      {
        q: `How many rounds for ${teams} players?`,
        a: `${rounds}. That is ceil(log2(${teams})), the fewest that can leave one player unbeaten.`,
      },
      {
        q: "Do I have to pair each round myself?",
        a: "No. Finishing a round is what draws the next one, from the table as it stood at that moment. There is a manual pairing endpoint but it is the repair path.",
      },
      {
        q: "Can the same two players meet twice?",
        a: "The pairing avoids it. On a small field over a long tournament it can run out of fresh opponents, in which case it repeats a meeting and says so.",
      },
    ],
    related: relatives(
      "swiss-tournament-generator",
      neighbours(teams, SWISS).map((n) => `${n}-player-swiss-tournament`),
      ["guide/how-many-swiss-rounds", "guide/how-swiss-pairing-works"],
    ),
  };
}

// ---------------------------------------------------------------------------
// groups then playoff
// ---------------------------------------------------------------------------

function groups(teams: number): Page {
  const sizes = poolSizes(teams);
  const count = poolCount(teams);
  const even = sizes.every((size) => size === sizes[0]);
  const shape = poolShape(teams);
  const matches = presetById("groups").matches(teams);
  const qualifiers = count * 2;
  const guaranteed = Math.min(...sizes) - 1;

  return {
    slug: `${teams}-team-group-stage-and-playoff`,
    kind: "parametric",
    title: even
      ? `${teams} Teams: ${shape}, Then a Playoff`
      : `${teams} Team Group Stage and Playoff: Free Generator`,
    h1: `${teams} teams: ${shape}, then a playoff`,
    description:
      `Draw ${teams} teams into ${shape} and a playoff that seeds itself from the tables. ${matches} matches, ${guaranteed}+ guaranteed each. Free.`,
    lede:
      `${teams} teams draws as ${shape}. The top two of each go through to ${roundWord(qualifiers)}, ` +
      `so everybody is guaranteed ${plural(guaranteed, "match")} before anyone can be knocked out. ${plural(matches, "match")} in total.`,
    generator: { preset: "groups", teams },
    facts: factsFor("groups", teams),
    sections: [
      {
        heading: `Why ${shape}`,
        body: [
          `Pools of at most five, and never fewer than two pools: that is the rule, and for ${teams} teams it comes out at ${shape}. Groups of four or five are the sweet spot: three or four guaranteed matches each, and a table small enough to be final before the playoff needs it.`,
          even
            ? `${teams} divides evenly, so every group is the same size and every team plays the same number of group matches. Nothing has to be adjusted for fairness.`
            : `${teams} does not divide evenly, so the groups come out as ${sizes.join(", ")}. Teams in the smaller group play one fewer match, which matters when the best third-placed teams are compared across groups. Results against anyone finishing below the smallest group's last place are disregarded, so the comparison is over the same number of matches either way.`,
        ],
      },
      {
        heading: "The playoff is drawn before the groups are played",
        body: [
          `${qualifiers} teams qualify (the top two of each group), which fills ${roundWord(qualifiers)}. The bracket is drawn at the same time as the groups, with its positions labelled "1. A", "2. B" and so on, so the whole day is on the wall from the first whistle.`,
          "As each group finishes, the positions waiting on it resolve and the real names appear. A group table is provisional until every fixture in it is settled, and a playoff position will not fill from a provisional table. A team told they are through while a match that changes the order is still on the next court is the worst thing this could get wrong.",
        ],
      },
      {
        heading: "How long the day is",
        body: [
          `${plural(matches, "match")}: the group matches, plus the ${knockoutMatches(qualifiers)} of the playoff including a third-place match. The group stage parallelises well across courts; the playoff does not, because each round waits for the one before it.`,
        ],
      },
    ],
    faq: [
      {
        q: `How do you split ${teams} teams into groups?`,
        a: `${shape}. Pools of at most five and never fewer than two pools${even ? ", and this many divides evenly" : `, which for ${teams} comes out uneven at ${sizes.join(", ")}`}.`,
      },
      {
        q: "How many teams go through?",
        a: `${qualifiers}, the top two of each group, which fills ${roundWord(qualifiers)} exactly.`,
      },
      {
        q: "How many matches is everybody guaranteed?",
        a: `${guaranteed}, before anybody can be knocked out.`,
      },
    ],
    related: relatives(
      "group-stage-knockout-generator",
      neighbours(teams, GROUPS).map((n) => `${n}-team-group-stage-and-playoff`),
      ROUND_ROBIN.includes(teams) ? [`${teams}-team-round-robin-schedule`] : [],
      ["guide/group-stage-tiebreakers-explained"],
    ),
  };
}

const roundWord = (qualifiers: number) =>
  qualifiers <= 2
    ? "a final"
    : qualifiers <= 4
      ? "semi-finals"
      : qualifiers <= 8
        ? "quarter-finals"
        : `a round of ${2 ** Math.ceil(Math.log2(qualifiers))}`;

// ---------------------------------------------------------------------------

/** The nearest field sizes either side, which is what somebody browses to next. */
function neighbours(teams: number, all: number[]): number[] {
  const i = all.indexOf(teams);
  return [all[i - 1], all[i + 1]].filter((n): n is number => n !== undefined);
}

const relatives = (...groups: (string | string[])[]): string[] =>
  groups.flat();

export const PARAMETRIC_PAGES: Page[] = [
  ...SINGLE_ELIM.map(singleElim),
  ...DOUBLE_ELIM.map(doubleElim),
  ...ROUND_ROBIN.map(roundRobin),
  ...SWISS.map(swiss),
  ...GROUPS.map(groups),
];

/**
 * Alternate slugs that should land on a canonical page.
 *
 * "4 groups of 4" is how somebody searches for what Whistle.day calls a 16-team
 * group stage. Publishing both as pages would be two URLs competing for one
 * query with the same content on them; publishing neither would miss the
 * query. So the shape-worded one redirects to the team-count one, which is
 * canonical because it is the only one of the two that can exist for every
 * field size.
 */
export const SLUG_ALIASES: Record<string, string> = Object.fromEntries(
  GROUPS.flatMap((teams) => {
    const sizes = poolSizes(teams);
    if (!sizes.every((size) => size === sizes[0])) return [];
    return [
      [
        `${sizes.length}-groups-of-${sizes[0]}`,
        `${teams}-team-group-stage-and-playoff`,
      ],
    ];
  }),
);
