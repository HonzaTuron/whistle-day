/**
 * Sheets to print and fill in by hand.
 *
 * The paper version is not a lesser thing than the app. A hall with no wifi, a
 * referee who does not want a phone, and a wall that wants the draw pinned to
 * it before anybody arrives are all real, and they all end at a printer. These
 * pages also happen to be what "printable 16 team bracket" searches for, which
 * is a query with more volume behind it than most of the generator pages.
 *
 * The sheet itself is drawn by `POST /api/preview`, which runs the same
 * generators a real stage does. That is the whole reason these are worth
 * publishing: a sheet printed on Friday that disagrees with the draw on
 * Saturday is a bug nobody finds until the hall does.
 */

import { bracketSize, byeCount, factsFor, knockoutPath, plural } from "./shape";
import { combinations, knockoutMatches } from "../lib/presets";
import type { Page } from "./types";

export const BRACKETS = [4, 8, 16, 32];
export const ROUND_ROBINS = [4, 5, 6, 8, 10, 12];

function printableBracket(teams: number): Page {
  const matches = knockoutMatches(teams);
  const byes = byeCount(teams);

  return {
    slug: `printable/${teams}-team-bracket`,
    kind: "printable",
    title: `Printable ${teams} Team Bracket: Free PDF Sheet`,
    h1: `Printable ${teams} team bracket`,
    description:
      `A blank ${teams} team knockout bracket to print and fill in: ${matches} matches, ruled score boxes. Free, no signup.`,
    lede:
      `A blank bracket for ${teams} teams (${knockoutPath(teams).join(", then ")}) with ruled boxes to write scores into. Put your own team names on it first, or print it numbered and fill it in at the draw.`,
    generator: { preset: "knockout", teams },
    facts: factsFor("knockout", teams),
    sections: [
      {
        heading: "Print it, or run it",
        body: [
          `The sheet below is the same draw the software would produce for ${teams} teams, because it is drawn by the same generator rather than by a separate bit of code that makes brackets for pictures. ${byes > 0 ? `That includes the ${plural(byes, "bye")}: the bracket holds ${bracketSize(teams)}, and the spare positions go to the top seeds.` : `${teams} is a power of two, so the bracket is exactly full.`}`,
          "Paper is the right answer more often than software people admit: it does not need wifi, it does not need a charger, and it can be pinned to a wall where everybody walks past. What it cannot do is rebuild a table when somebody corrects a score two hours later, which is the point at which this stops being enough.",
        ],
      },
      {
        heading: "Printing it well",
        body: [
          "Landscape, and let the browser scale to fit. The sheet is laid out to come out on one page at these sizes; a 32-team bracket on A4 is legible but tight, and A3 is better if you have it.",
          "Print it twice. One for the wall and one for whoever is running the desk, because the wall copy will get written on by somebody else.",
        ],
      },
    ],
    faq: [
      {
        q: `How many matches in a ${teams} team bracket?`,
        a: `${matches}, one per eliminated team${teams >= 4 ? ", plus a third-place match" : ""}.`,
      },
      {
        q: "Can I put my own team names on it?",
        a: "Yes, in the boxes above the sheet. Nothing is saved and nothing is sent anywhere except the draw request itself.",
      },
      {
        q: "Is there a PDF?",
        a: "Print to PDF from your browser. The sheet has a print stylesheet, so what comes out is the bracket and nothing else.",
      },
    ],
    related: [
      `${teams}-team-single-elimination-bracket`,
      "single-elimination-bracket-generator",
      "printable/round-robin-schedule",
      "guide/how-to-seed-a-bracket",
    ],
  };
}

function printableRoundRobin(teams: number): Page {
  const matches = combinations(teams);

  return {
    slug: `printable/${teams}-team-round-robin-schedule`,
    kind: "printable",
    title: `Printable ${teams} Team Round Robin Schedule`,
    h1: `Printable ${teams} team round robin schedule`,
    description:
      `A blank ${teams} team round robin schedule to print: all ${matches} fixtures, grouped by round, with score boxes. Free.`,
    lede:
      `Every pair, once: ${plural(matches, "fixture")} laid out round by round with ruled boxes for the scores. Print it, pin it up, and fill it in as the day goes.`,
    generator: { preset: "everyone", teams },
    facts: factsFor("everyone", teams),
    sections: [
      {
        heading: "Grouped by round, not listed",
        body: [
          `The fixtures come out in rounds rather than as one list of ${matches}, because a round is what you actually run: everybody plays, then everybody plays again. A list sorted by team is a list somebody has to cross-reference to find out what happens next.`,
          teams % 2 === 1
            ? `${teams} is odd, so one team sits out each round. Over the schedule everybody gets exactly one bye, and a bye is not a fixture, so there is no line to write on.`
            : `${teams} is even, so every round pairs the whole field and nobody sits out.`,
        ],
      },
      {
        heading: "The table is the part paper is worst at",
        body: [
          "A schedule prints fine. A league table does not, because it has to be rebuilt every time a result changes, and the tiebreakers (head-to-head among the tied teams only, then score difference) are the part people get wrong by hand and then argue about.",
          "If the day is going to end in a close table, that is the point at which running it on a phone stops being a preference.",
        ],
      },
    ],
    faq: [
      {
        q: `How many matches in a ${teams} team round robin?`,
        a: `${matches}. Every pair meets once: ${teams} × ${teams - 1} ÷ 2.`,
      },
      {
        q: "Can I print it blank and draw the names at the venue?",
        a: "Yes. Leave the name boxes empty and it prints numbered places.",
      },
    ],
    related: [
      `${teams}-team-round-robin-schedule`,
      "round-robin-generator",
      "printable/8-team-bracket",
      "league-table-generator",
    ],
  };
}

export const PRINTABLE_PAGES: Page[] = [
  ...BRACKETS.map(printableBracket),
  ...ROUND_ROBINS.map(printableRoundRobin),
  {
    slug: "printable/round-robin-schedule",
    kind: "printable",
    title: "Printable Round Robin Schedule: Any Number of Teams",
    h1: "Printable round robin schedule",
    description:
      "Print a blank round robin schedule for any number of teams, grouped by round with score boxes. Free, no signup.",
    lede:
      "Pick a field size and print the fixtures: every pair once, laid out round by round, with ruled boxes for the scores.",
    generator: { preset: "everyone", teams: 8 },
    facts: factsFor("everyone", 8),
    sections: [
      {
        heading: "Sized for the field you actually have",
        body: [
          "A round robin grows fast: six teams is 15 matches, ten is 45, sixteen is 120. The sheet is drawn for whatever size you ask for, so it is worth checking the fixture count against the hours and courts you have before printing anything.",
        ],
      },
    ],
    related: [
      "printable/8-team-round-robin-schedule",
      "printable/12-team-round-robin-schedule",
      "round-robin-generator",
      "guide/how-many-courts-do-i-need",
    ],
  },
];
