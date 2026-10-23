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
import { BRACKETS, ROUND_ROBINS } from "./printables";
import type { Page } from "./types";

/** Field sizes worth a page of their own, per format. */
const SINGLE_ELIM = range(3, 32);
const DOUBLE_ELIM = [4, 5, 6, 7, 8, 10, 12, 16, 20, 24, 32];
const ROUND_ROBIN = range(3, 32);
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
  const size = bracketSize(teams);
  const rounds = knockoutRounds(teams);
  const path = knockoutPath(teams);
  const matches = knockoutMatches(teams);
  const r1Teams = Math.max(teams - byes, 0);
  const r1Matches = r1Teams / 2;
  const nextRoundName = rounds > 1 ? path[1] : "Final";
  // Three teams is the one size where the honest advice is not to run a
  // bracket at all: the bye is a free pass to the final, handed out by the draw.
  const three = teams === 3;

  return {
    slug: `${teams}-team-single-elimination-bracket`,
    kind: "parametric",
    title:
      byes > 0
        ? `${teams} Team Bracket with Byes: Single Elimination Generator`
        : `${teams} Team Bracket (No Byes): Single Elimination Generator`,
    h1: `${teams} team single elimination bracket`,
    description:
      byes > 0
        ? `A ${teams} team bracket with byes: ${byes} first-round byes, ${matches} matches over ${plural(rounds, "round")}. Printable & digital bracket, free.`
        : `A ${teams} team bracket with no byes: ${matches} matches over ${plural(rounds, "round")}. Free printable sheet & live digital bracket.`,
    lede:
      byes > 0
        ? `${teams} team bracket with byes: ${plural(matches, "match")}, ${plural(rounds, "round")}, and ${plural(byes, "first-round bye")}. ` +
          `Because ${teams} is not a power of two, the bracket is drawn at ${size} with ${plural(byes, "team")} advancing directly to the ${nextRoundName.toLowerCase()}, while the other ${plural(r1Teams, "team")} play in round one.` +
          (three ? " With three teams, play everyone plays everyone instead." : "")
        : `${teams} teams, ${plural(matches, "match")}, ${plural(rounds, "round")}: ${path.join(", then ")}. ` +
          `${teams} is a power of two, so the bracket is perfectly balanced and nobody sits out with a bye.`,
    generator: { preset: three ? "everyone" : "knockout", teams },
    facts: factsFor("knockout", teams),
    sections: [
      ...(three
        ? [
            {
              heading: "Why three teams should not play a knockout",
              body: [
                "Two teams play a semi-final and the third goes straight into the final without playing. Whoever the draw hands the bye has won a match for free and is fresh for the final; the other two have to win twice. The draw decides more of the result than the games do.",
                "A round robin is three matches, one more than the bracket, and every team plays twice. Nobody is waved through, and the table settles it. The generator below starts you on that.",
              ],
            },
          ]
        : []),
      {
        heading:
          byes > 0
            ? `How byes work for ${teams} teams: ${byes === 1 ? "1 team gets a first-round bye" : `${byes} teams get a first-round bye`}`
            : `No byes needed for ${teams} teams: a balanced ${teams}-team bracket`,
        body:
          byes > 0
            ? [
                `In a **${teams} team bracket with byes**, ${teams} is not a power of two, so the draw expands to the next power of two (${size} slots). That leaves exactly **${plural(byes, "empty slot")}**, which become **${plural(byes, "first-round bye")}**.`,
                `**Who gets the byes?** The top seeds (${byes === 1 ? "seed #1" : `seeds #1 through #${byes}`}) receive a first-round bye and skip straight to the ${nextRoundName.toLowerCase()}. The remaining ${plural(r1Teams, "team")} (${byes === teams - 1 ? `seed #${teams}` : `seeds #${byes + 1} through #${teams}`}) play in the opening round (${plural(r1Matches, "match")}).`,
                `The ${r1Matches} winner${r1Matches === 1 ? "" : "s"} from round one then join the ${byes} rested seed${byes === 1 ? "" : "s"} in the ${nextRoundName.toLowerCase()}, completing a full ${size / 2}-team second round with zero further byes.`,
                `Placing byes with the top seeds is standard tournament practice: it rewards regular season ranking and prevents distortion of the draw. Total matches: ${matches}${teams >= 4 ? " (including the third-place match)" : ""}.`,
              ]
            : [
                `Because ${teams} is an exact power of two (2^${rounds}), a **${teams} team bracket requires zero byes**. Every team enters in the opening round (${path[0]}), with ${teams / 2} matches starting simultaneously.`,
                `The tournament progresses through ${plural(rounds, "round")}: ${path.map((name, i) => `${name} (${matchesInRound(teams, i)} matches)`).join(", then ")}${teams >= 4 ? ", plus a third-place match" : ""}. With ${matches} matches in total, every team plays an authentic opening match, and nobody receives an artificial bye.`,
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
              q: `How do byes work in a ${teams} team bracket?`,
              a: `A ${teams} team bracket is drawn on a ${size}-team grid. Exactly ${byes} teams get a first-round bye (top seeds 1–${byes}) straight to the ${nextRoundName.toLowerCase()}, while the other ${r1Teams} teams play ${r1Matches} opening match${r1Matches === 1 ? "" : "es"}.`,
            },
            {
              q: `Who gets the byes in a ${teams} team tournament?`,
              a: `The top ${byes} seeds (seeds 1 through ${byes}) receive the first-round byes to reward seeding and maintain bracket balance.`,
            },
          ]
        : [
            {
              q: `Does a ${teams} team bracket have byes?`,
              a: `No. ${teams} is an exact power of two, so all ${teams} teams play in the opening round (${teams / 2} matches) with zero byes.`,
            },
          ]),
    ],
    related: relatives(
      "single-elimination-bracket-generator",
      neighbours(teams, SINGLE_ELIM).map((n) => `${n}-team-single-elimination-bracket`),
      BRACKETS.includes(teams)
        ? [`printable/${teams}-team-bracket`]
        : [`printable/bracket?teams=${teams}`],
      DOUBLE_ELIM.includes(teams) ? [`${teams}-team-double-elimination-bracket`] : [],
      three ? [`${teams}-team-round-robin-schedule`] : [],
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
    title: odd
      ? `${teams} Team Round Robin Schedule (with Byes): Free Generator`
      : `${teams} Team Round Robin Schedule (No Byes): Free Generator`,
    h1: `${teams} team round robin schedule`,
    description: odd
      ? `A ${teams} team round robin schedule with byes: ${matches} matches over ${rounds} rounds (${each} each), live standings table. Free generator, no signup.`
      : `A ${teams} team round robin schedule with no byes: ${matches} matches over ${rounds} rounds (${each} each). Free generator & live table.`,
    lede: odd
      ? `Every team plays every other. ${plural(matches, "match")} in total across ${rounds} rounds (${plural(each, "match")} each). ` +
        `Because ${teams} is an odd number, one team sits out each round with a scheduled bye, meaning everybody gets exactly 1 rest round.`
      : `Every team plays every other. ${plural(matches, "match")} in total, ${plural(each, "match")} each, over ${plural(rounds, "round")}. ` +
        `Because ${teams} is even, every round pairs the entire field with zero byes.`,
    generator: { preset: "everyone", teams },
    facts: factsFor("everyone", teams),
    sections: [
      {
        heading: odd
          ? `How byes work in a ${teams}-team round robin schedule`
          : `Zero byes in a ${teams}-team round robin: full action every round`,
        body: odd
          ? [
              `In a **${teams} team round robin with byes**, an odd number of teams cannot all play simultaneously: in each round, ${teams - 1} teams are paired into ${(teams - 1) / 2} matches while exactly 1 team sits out with a scheduled bye.`,
              `Over the course of the ${rounds} rounds, every team receives exactly one bye round and plays ${plural(each, "match")}. Total fixtures remain at ${matches} (calculated as ${teams} × ${teams - 1} ÷ 2). A bye is not scored and awards zero points—it simply provides each team one rest rotation during the day.`,
            ]
          : [
              `Because ${teams} is an even number, every team plays in every single round with **zero byes**. Each of the ${rounds} rounds pairs the entire field into ${teams / 2} simultaneous matches.`,
              `That is the most efficient round robin format: every competitor plays ${each} matches, producing ${matches} total fixtures without anyone waiting on the bench.`,
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
      ...(odd
        ? [
            {
              q: `How do byes work in a ${teams} team round robin?`,
              a: `With an odd field of ${teams} teams, each round features ${(teams - 1) / 2} matches while 1 team has a bye. Every team gets exactly one bye across the ${rounds} rounds.`,
            },
          ]
        : [
            {
              q: `Does a ${teams} team round robin have byes?`,
              a: `No. ${teams} is an even number, so all ${teams} teams play in all ${rounds} rounds without any byes.`,
            },
          ]),
    ],
    related: relatives(
      "round-robin-generator",
      neighbours(teams, ROUND_ROBIN).map((n) => `${n}-team-round-robin-schedule`),
      ROUND_ROBINS.includes(teams)
        ? [`printable/${teams}-team-round-robin-schedule`]
        : [`printable/round-robin-schedule?teams=${teams}`],
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
      ? `${teams} Team Tournament: ${shape}, Then Playoff | Free Generator`
      : `${teams} Team Group Stage and Playoff: Free Generator`,
    h1: even
      ? `${teams} team tournament generator: ${shape}, then a playoff`
      : `${teams} teams: ${shape}, then a playoff`,
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
