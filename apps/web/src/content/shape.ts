/**
 * What a format costs, for a given number of teams.
 *
 * Every number a marketing page prints comes from here, and everything here
 * comes from `lib/presets.ts` — the same functions the format screen quotes
 * from, which in turn have to agree with the Go generators. A page that
 * promises "12 matches, about two hours" and a wizard that then runs 14 is
 * worse than having no page: it is a wrong answer with a search engine
 * pointing at it.
 *
 * Nothing here generates a draw. Generation lives on the server and there is
 * one implementation of it; this only counts what that implementation will
 * produce. Counting is not the thing that drifts — bracket seeding is — which
 * is why the counts may live in the browser and the seeding may not.
 */

import { roundTitle } from "../lib/bracket";
import { translate, type MessageKey, type Vars } from "../lib/i18n";
import {
  combinations,
  estimate,
  formatDuration,
  knockoutMatches,
  poolCount,
  poolSizes,
  presetById,
  swissRounds,
  type PresetId,
} from "../lib/presets";
import type { Fact, TeamGrid } from "./types";

/**
 * The marketing pages are English, so they carry an English translator rather
 * than reading one out of the provider.
 *
 * They are prerendered at build time with no request and no browser to ask
 * what language anybody wants, and there is no Czech version of them yet. When
 * there is, this is the seam: these pages become locale-parameterised and this
 * constant becomes an argument.
 */
const t = (key: MessageKey, vars?: Vars) => translate("en", key, vars);

/**
 * "5 matches", not "5 matchs".
 *
 * Deliberately not the i18n catalog's plural machinery, which exists so Czech
 * gets its four forms right. These strings are assembled at build time in one
 * language, and routing them through a catalog would mean a message key for
 * every noun on 123 pages to buy nothing.
 */
export const plural = (n: number, word: string) =>
  `${n} ${word}${n === 1 ? "" : /[sxz]$|[cs]h$/.test(word) ? "es" : "s"}`;

/** The bracket a knockout of this many teams is drawn into. */
export const bracketSize = (teams: number) =>
  2 ** Math.ceil(Math.log2(Math.max(teams, 2)));

/**
 * Teams that skip round one because the field is not a power of two.
 *
 * This is the single most-searched thing about an odd bracket size — "what
 * happens with 12 teams" is a question about byes — so every knockout page
 * states it whether or not there are any.
 */
export const byeCount = (teams: number) => bracketSize(teams) - teams;

/** Rounds in a knockout, counting the final. */
export const knockoutRounds = (teams: number) =>
  Math.ceil(Math.log2(Math.max(teams, 2)));

/**
 * "Quarter-finals → Semi-finals → Final".
 *
 * Named by distance from the end through `lib/bracket.ts`, which is where the
 * projector and the phone get their round titles. Counting fixtures instead
 * would label the last round "Semi-finals", which is the bug that put
 * `roundTitle` in a shared file in the first place.
 */
export const knockoutPath = (teams: number) =>
  Array.from({ length: knockoutRounds(teams) }, (_, i) =>
    roundTitle(t, knockoutRounds(teams) - i),
  );

/**
 * Rounds in a round robin. An odd field needs one more than an even one of the
 * same size, because somebody sits out every round.
 */
export const roundRobinRounds = (teams: number) =>
  teams % 2 === 0 ? teams - 1 : teams;

/** Matches each team plays in a round robin — the number people actually want. */
export const matchesEach = (teams: number) => Math.max(teams - 1, 0);

/** "2 groups of 4", or "3 groups of 4, 4 and 3" when they cannot be even. */
export function poolShape(teams: number): string {
  const sizes = poolSizes(teams);
  const even = sizes.every((size) => size === sizes[0]);
  const label = sizes.length === 1 ? "group" : "groups";
  return even
    ? `${sizes.length} ${label} of ${sizes[0]}`
    : `${sizes.length} ${label} of ${sizes.join(", ")}`;
}

/** "about 3 h on 2 courts" — the sentence the format screen is built around. */
export function duration(preset: PresetId, teams: number, courts: number) {
  const { minutes } = estimate(presetById(preset), teams, courts);
  return `${formatDuration(t, minutes)} on ${courts} ${courts === 1 ? "court" : "courts"}`;
}

/**
 * The facts panel at the top of a parametric page, per format.
 *
 * Two courts is the assumption behind every quoted duration because it is what
 * a school hall has. The page says so rather than leaving somebody to wonder
 * which day it was describing.
 */
export function factsFor(preset: PresetId, teams: number): Fact[] {
  const courts = 2;
  const time = {
    label: "Roughly how long",
    value: duration(preset, teams, courts),
    note: "Allowing 25 minutes a match, courts running in parallel.",
  };

  switch (preset) {
    case "knockout": {
      const byes = byeCount(teams);
      return [
        {
          label: "Matches",
          value: String(knockoutMatches(teams)),
          note: teams >= 4 ? "Including the third-place match." : undefined,
        },
        {
          label: "Rounds",
          value: String(knockoutRounds(teams)),
          note: knockoutPath(teams).join(" → "),
        },
        {
          label: "Byes",
          value: String(byes),
          note:
            byes === 0
              ? `${teams} is a power of two, so nobody sits out round one.`
              : `${plural(byes, "team")} go straight to round two — the bracket holds ${bracketSize(teams)}.`,
        },
        time,
      ];
    }

    case "double":
      return [
        {
          label: "Matches",
          value: String(presetById("double").matches(teams)),
          note: "Everybody but the winner has to lose twice.",
        },
        {
          label: "Guaranteed matches",
          value: "2",
          note: "Nobody goes home on one bad game.",
        },
        {
          label: "Brackets",
          value: "2",
          note: "A winners bracket, a losers bracket, and a grand final between them.",
        },
        time,
      ];

    case "everyone":
      return [
        {
          label: "Matches",
          value: String(combinations(teams)),
          note: "Every pair meets once.",
        },
        {
          label: "Matches each",
          value: String(matchesEach(teams)),
          note: "The same for everybody, however the results go.",
        },
        {
          label: "Rounds",
          value: String(roundRobinRounds(teams)),
          note:
            teams % 2 === 0
              ? "Everybody plays in every round."
              : "An odd field means one team sits out each round.",
        },
        time,
      ];

    case "everyoneTwice":
      return [
        {
          label: "Matches",
          value: String(combinations(teams) * 2),
          note: "Every pair meets twice, once each way.",
        },
        {
          label: "Matches each",
          value: String(matchesEach(teams) * 2),
          note: "The same for everybody, home and away.",
        },
        {
          label: "Rounds",
          value: String(roundRobinRounds(teams) * 2),
          note:
            teams % 2 === 0
              ? "Everybody plays in every round."
              : "An odd field means one team sits out each round.",
        },
        time,
      ];

    case "swiss": {
      const rounds = swissRounds(teams);
      return [
        {
          label: "Rounds",
          value: String(rounds),
          note: "The fewest that can still leave one team unbeaten.",
        },
        {
          label: "Matches",
          value: String(presetById("swiss").matches(teams)),
          note: "Including semi-finals and a third-place match for the top four.",
        },
        {
          label: "Matches each",
          value: String(rounds),
          note: "Nobody is knocked out — everyone plays every round.",
        },
        time,
      ];
    }

    case "groups":
      return [
        {
          label: "Groups",
          value: String(poolCount(teams)),
          note: poolShape(teams),
        },
        {
          label: "Matches",
          value: String(presetById("groups").matches(teams)),
          note: "Group matches plus the playoff they feed.",
        },
        {
          label: "Guaranteed matches",
          value: String(Math.min(...poolSizes(teams)) - 1),
          note: "Before anybody can be knocked out.",
        },
        time,
      ];
  }
}

const csT = (key: MessageKey, vars?: Vars) => translate("cs", key, vars);

/** Czech round progression for knockouts, e.g. "Čtvrtfinále → Semifinále → Finále". */
export const knockoutPathCs = (teams: number) =>
  Array.from({ length: knockoutRounds(teams) }, (_, i) =>
    roundTitle(csT, knockoutRounds(teams) - i),
  );

/** "cca 3 h na 2 kurtech" */
export function durationCs(preset: PresetId, teams: number, courts = 2) {
  const { minutes } = estimate(presetById(preset), teams, courts);
  return `${formatDuration(csT, minutes)} na ${courts} ${courts === 1 ? "kurtu" : courts < 5 ? "kurtech" : "kurtech"}`;
}

/** "2 skupiny po 4" */
export function poolShapeCs(teams: number): string {
  const sizes = poolSizes(teams);
  const even = sizes.every((size) => size === sizes[0]);
  const label = sizes.length === 1 ? "skupina" : sizes.length < 5 ? "skupiny" : "skupin";
  return even
    ? `${sizes.length} ${label} po ${sizes[0]}`
    : `${sizes.length} ${label} po ${sizes.join(", ")}`;
}

/** Czech fact blocks for marketing pages. */
export function factsForCs(preset: PresetId, teams: number): Fact[] {
  const courts = 2;
  const time = {
    label: "Přibližná délka",
    value: durationCs(preset, teams, courts),
    note: "Při 25 minutách na zápas, kurty běží souběžně.",
  };

  switch (preset) {
    case "knockout": {
      const byes = byeCount(teams);
      return [
        {
          label: "Zápasů",
          value: String(knockoutMatches(teams)),
          note: teams >= 4 ? "Včetně zápasu o 3. místo." : undefined,
        },
        {
          label: "Kol",
          value: String(knockoutRounds(teams)),
          note: knockoutPathCs(teams).join(" → "),
        },
        {
          label: "Volné losy (byes)",
          value: String(byes),
          note:
            byes === 0
              ? `${teams} je mocnina 2, takže nikdo v 1. kole nestojí.`
              : `${byes} ${byes === 1 ? "tým postupuje" : byes < 5 ? "týmy postupují" : "týmů postupuje"} přímo do 2. kola (pavouk pro ${bracketSize(teams)}).`,
        },
        time,
      ];
    }

    case "everyone":
      return [
        {
          label: "Zápasů",
          value: String(combinations(teams)),
          note: "Každý s každým jednou.",
        },
        {
          label: "Zápasů na tým",
          value: String(matchesEach(teams)),
          note: "Stejný počet pro každého bez ohledu na výsledky.",
        },
        {
          label: "Kol",
          value: String(roundRobinRounds(teams)),
          note:
            teams % 2 === 0
              ? "Všichni hrají v každém kole."
              : "Lichý počet: v každém kole má 1 tým pauzu (bye).",
        },
        time,
      ];

    case "swiss": {
      const rounds = swissRounds(teams);
      return [
        {
          label: "Kol",
          value: String(rounds),
          note: "Minimum kol pro nalezení neporaženého vítěze.",
        },
        {
          label: "Zápasů",
          value: String(presetById("swiss").matches(teams)),
          note: "Včetně semifinále a zápasu o 3. místo pro nejlepší 4.",
        },
        {
          label: "Zápasů na tým",
          value: String(rounds),
          note: "Nikdo nevypadává – všichni odehrají všechna kola.",
        },
        time,
      ];
    }

    case "groups":
      return [
        {
          label: "Skupiny",
          value: String(poolCount(teams)),
          note: poolShapeCs(teams),
        },
        {
          label: "Zápasů",
          value: String(presetById("groups").matches(teams)),
          note: "Zápasy ve skupinách plus navazující play-off pavouk.",
        },
        {
          label: "Zaručeno zápasů",
          value: String(Math.min(...poolSizes(teams)) - 1),
          note: "Předtím než kdokoliv může z turnaje vypadnout.",
        },
        time,
      ];

    default:
      return factsFor(preset, teams);
  }
}

/**
 * Grid of all single-elimination bracket variants from 4 to 32 teams.
 */
export function singleElimGrid(locale: "en" | "cs" = "en"): TeamGrid {
  const isCs = locale === "cs";
  return {
    heading: isCs
      ? "Pavouk turnaje podle počtu týmů (4 až 32 týmů)"
      : "Single Elimination Brackets by Team Count (4 to 32 teams)",
    description: isCs
      ? "Vyberte přesný počet týmů vašeho turnaje. U počtů, které nejsou mocninou dvou (např. 10, 12 nebo 14 týmů), pavouk automaticky nasazuje volné losy (byes)."
      : "Select your exact field size from 4 to 32 teams. Brackets that are not a power of two (such as 10, 12, or 14 teams) automatically assign first-round byes to top seeds.",
    items: Array.from({ length: 29 }, (_, i) => {
      const count = i + 4;
      const byes = byeCount(count);
      const isPower = byes === 0;
      let badge = "";
      if (isCs) {
        badge = isPower
          ? "Bez byes"
          : byes === 1
            ? "1 volný los"
            : byes < 5
              ? `${byes} volné losy`
              : `${byes} volných losů`;
      } else {
        badge = isPower ? "0 byes" : plural(byes, "bye");
      }
      return {
        teams: count,
        slug: `${count}-team-single-elimination-bracket`,
        label: isCs ? `${count} ${count < 5 ? "týmy" : "týmů"}` : `${count} teams`,
        badge,
        isPowerOfTwo: isPower,
      };
    }),
  };
}

/**
 * Grid of all round-robin schedule variants from 4 to 32 teams.
 */
export function roundRobinGrid(locale: "en" | "cs" = "en"): TeamGrid {
  const isCs = locale === "cs";
  return {
    heading: isCs
      ? "Rozpisy každý s každým podle počtu týmů (4 až 32 týmů)"
      : "Round Robin Schedules by Team Count (4 to 32 teams)",
    description: isCs
      ? "Kompletní rozpis zápasů každý s každým a automatická tabulka. U lichých počtů týmů rozpis plánuje volno (bye) v každém kole."
      : "Complete match schedules where every team plays every opponent once, with a self-updating league table.",
    items: Array.from({ length: 29 }, (_, i) => {
      const count = i + 4;
      const matches = combinations(count);
      const isOdd = count % 2 === 1;
      let badge = "";
      if (isCs) {
        badge = `${matches} ${matches < 5 ? "zápasy" : "zápasů"}`;
      } else {
        badge = `${matches} matches`;
      }
      return {
        teams: count,
        slug: `${count}-team-round-robin-schedule`,
        label: isCs ? `${count} ${count < 5 ? "týmy" : "týmů"}` : `${count} teams`,
        badge,
        isPowerOfTwo: !isOdd,
      };
    }),
  };
}
