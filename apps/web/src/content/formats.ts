/**
 * The hub, and one page per format Whistle.day can actually run.
 *
 * `ladder` is missing on purpose: `stages.format` accepts it and nothing
 * generates it, so there is no page for it. A page for a format the product
 * cannot run is the one kind of SEO page that costs more than it earns —
 * somebody arrives on a promise and leaves on a broken wizard.
 */

import { factsFor, poolShape, roundRobinGrid, singleElimGrid } from "./shape";
import type { Page } from "./types";

export const HUB: Page = {
  slug: "tournament-generator",
  kind: "hub",
  title: "Free Tournament Generator: Brackets, Groups and Swiss",
  h1: "Tournament generator",
  description:
    "Make a bracket, a group stage or a Swiss draw, run the day from your phone, and put the results on a projector. Free, no account.",
  lede:
    "Give it a list of teams and how long the day should be. It draws the tournament, schedules it across your courts, and gives you a link and a QR code to hand out. Then it runs the day: enter a result and the tables rebuild, the bracket fills in, and the next Swiss round draws itself.",
  generator: { preset: "groups", teams: 8 },
  alternate: { hreflang: "cs", slug: "generator-turnaju" },
  teamGrids: [singleElimGrid("en"), roundRobinGrid("en")],
  sections: [
    {
      heading: "Pick a format by how long you have, not by what it is called",
      body: [
        "Most tournament software asks how many groups you want and how many teams advance. Those are answers to a question nobody has asked yet. The real decision is how much of a day you have and how many matches everybody should get out of it, and every format is a different trade between those two.",
        "A straight knockout is the shortest day and the cruellest: half the field has played once by lunchtime. Everyone-plays-everyone is the fairest and the longest. Groups then a playoff is what most one-day tournaments settle on because it guarantees everybody two or three matches and still ends with a final. Swiss is what you run when the field is too big for groups and you still want nobody knocked out.",
        "Whichever you pick, the number of matches and the rough finish time are on screen before you commit, worked out against the teams and courts you actually entered.",
      ],
    },
    {
      heading: "The day, not just the draw",
      body: [
        "A bracket image is the easy half. The hard half is the four hours afterwards: which match is on which court, what is being played right now, who won the one that just finished, and what that does to the table.",
        "Whistle.day is built for the second half. Results go in from a phone at the side of a court, one match at a time. Everything downstream is the server's job: the winner, the bracket, the tables, the playoff slots waiting on a final position. A result tapped in at the net is on the wall about a fifth of a second later.",
      ],
    },
    {
      heading: "Free, and no account until you want one",
      body: [
        "There is no signup in front of the wizard. An account is created behind the scenes when you start a tournament, and you are offered the chance to put an email on it later, once there is something worth keeping. Nothing is capped, nothing is watermarked, and the projector view has no ads on it.",
      ],
    },
  ],
  faq: [
    {
      q: "Is it really free?",
      a: "Yes. Every format, any number of teams, the projector view and the spectator view. A subscription only adds sponsor logos to the closing panel of the projector rotation, which is for clubs who sell that space.",
    },
    {
      q: "Do I need to make an account?",
      a: "No. Start a tournament and it works. You can put an email on the account afterwards if you want to open it on another device.",
    },
    {
      q: "Can spectators follow along?",
      a: "Yes. Every tournament gets a link and a QR code for a phone-sized results view, and a separate one for a projector or a TV.",
    },
  ],
  related: [
    "round-robin-generator",
    "single-elimination-bracket-generator",
    "group-stage-knockout-generator",
    "swiss-tournament-generator",
    "tournament-projector-display",
  ],
};

export const FORMAT_PAGES: Page[] = [
  {
    slug: "round-robin-generator",
    kind: "format",
    title: "Round Robin Generator: Every Team Plays Every Team",
    h1: "Round robin generator",
    description:
      "Generate a round robin schedule where every team plays every other, with a live league table and tiebreakers that explain themselves. Free, no account.",
    lede:
      "Everybody plays everybody, and the table decides it. No knockout, nobody sent home after two matches, and the same number of games for every team however the results go.",
    generator: { preset: "everyone", teams: 6 },
    alternate: { hreflang: "cs", slug: "rozpis-kazdy-s-kazdym-tabulka" },
    teamGrids: [roundRobinGrid("en")],
    facts: factsFor("everyone", 6),
    sections: [
      {
        heading: "What you get",
        body: [
          "A full fixture list (every pair, once) spread across however many courts you have. A league table that rebuilds itself every time a result goes in. And a projector view that shows the table to the hall without anybody having to stand at a laptop.",
          "The numbers above are for six teams; change the count in the wizard and everything re-quotes. A round robin is the one format where the size of the day grows fast: doubling the field roughly quadruples the matches.",
        ],
      },
      {
        heading: "The table is rebuilt, not accumulated",
        body: [
          "Standings are recomputed from scratch after every result rather than added up as they arrive. That sounds like the slower way to do it, and it is, but incremental accumulation is exactly where a corrected score produces a table that no longer matches its own fixtures. Fix a score an hour later and the table lands where it would have been if the score had been right the first time.",
        ],
      },
      {
        heading: "Ties are explained, not just broken",
        body: [
          "Two teams level on points are separated by head-to-head first, then score difference, then points scored, and when a table needs more than points to rank, the criteria that actually did the separating are printed underneath it.",
          "Head-to-head is computed among the tied teams only, from the fixtures those teams played against each other, which is why ranking is recursive rather than one comparator chain. That sentence under the table is the difference between a table and an argument in a sports hall.",
        ],
      },
      {
        heading: "Odd numbers of teams",
        body: [
          "An odd field means somebody sits out every round, and the schedule handles it: each team gets one bye across the tournament and the fixture count is unaffected, because a bye is not a match. The round count goes up by one compared to an even field of the same size.",
        ],
      },
    ],
    faq: [
      {
        q: "How many matches is a round robin?",
        a: "Every pair meets once, so it is teams × (teams − 1) ÷ 2. Six teams is 15 matches; ten teams is 45; sixteen is 120. The wizard quotes the number and a rough finish time before you commit to it.",
      },
      {
        q: "Can teams play each other twice?",
        a: "Yes. A two-leg round robin doubles the fixture list, home and away. It is a stage setting rather than a separate format.",
      },
      {
        q: "What if I want a knockout at the end?",
        a: "Then you want groups and a playoff, which is the same round robin with the top of each table carried into a bracket that seeds itself.",
      },
    ],
    related: [
      "6-team-round-robin-schedule",
      "8-team-round-robin-schedule",
      "printable/round-robin-schedule",
      "league-table-generator",
      "group-stage-knockout-generator",
      "guide/group-stage-tiebreakers-explained",
    ],
  },

  {
    slug: "single-elimination-bracket-generator",
    kind: "format",
    title: "Single Elimination Bracket Generator: Free, No Account",
    h1: "Single elimination bracket generator",
    description:
      "Make a knockout bracket for any number of teams, byes worked out for you, and put it on a projector that fills itself in. Free, no signup.",
    lede:
      "Lose once and you are out. The quickest way to a winner, and the least playing time for whoever draws badly. Any number of teams: the bracket is sized up to the next power of two and the byes are handed out for you.",
    generator: { preset: "knockout", teams: 8 },
    alternate: { hreflang: "cs", slug: "pavouk-turnaje-generator" },
    teamGrids: [singleElimGrid("en")],
    facts: factsFor("knockout", 8),
    sections: [
      {
        heading: "Byes, without the arithmetic",
        body: [
          "A knockout bracket holds a power of two (4, 8, 16, 32), and hardly any tournament has exactly that many teams. The difference is made up with byes: teams that skip the first round and enter in the second.",
          "You do not have to work out how many. Enter twelve teams and the bracket is drawn at sixteen with four byes, placed so the seeded teams get them, which is the convention and also the only placement that does not distort the draw.",
        ],
      },
      {
        heading: "Every cell is readable before it is played",
        body: [
          "A bracket drawn on Monday for a tournament played on Saturday is mostly empty, and the empty half is what people look at. Every unfilled position carries the label the server wrote for it: \"Winner QF1\", \"1. A\", \"Bye\". The bracket reads as a plan rather than as a grid of blanks.",
          "The same is true on the projector and on the phone view. A match with an unresolved side renders as text with those labels and no affordance at all, because it is waiting for somebody rather than refusing to work.",
        ],
      },
      {
        heading: "Third place, if you want it",
        body: [
          "A third-place match shares a round with the final but is not part of the tree, which is why it is counted separately in the match total above. It is on by default because most one-day tournaments play it: one more match, and two teams who would otherwise have finished their day on a loss get another game.",
        ],
      },
    ],
    faq: [
      {
        q: "How many matches in a single elimination bracket?",
        a: "One per team eliminated, so teams − 1, plus one more if you play a third-place match. Byes do not add matches: a team that skips round one simply has not played yet.",
      },
      {
        q: "What if I do not have a power-of-two number of teams?",
        a: "That is the normal case and it is handled. The bracket is drawn at the next power of two and the spare positions become byes.",
      },
      {
        q: "Can I seed the bracket?",
        a: "Yes. Teams carry a seed number and the draw lays them out so the top seeds cannot meet before the final, and so the byes go to the top of the draw.",
      },
    ],
    related: [
      "8-team-single-elimination-bracket",
      "16-team-single-elimination-bracket",
      "12-team-single-elimination-bracket",
      "printable/bracket",
      "printable/8-team-bracket",
      "double-elimination-bracket-generator",
      "guide/how-to-seed-a-bracket",
    ],
  },

  {
    slug: "double-elimination-bracket-generator",
    kind: "format",
    title: "Double Elimination Bracket Generator: Losers Bracket Included",
    h1: "Double elimination bracket generator",
    description:
      "Generate a double elimination bracket with a winners bracket, a losers bracket and a grand final. Any team count, byes handled, free.",
    lede:
      "Lose once and you drop into the losers bracket; lose twice and you are out. Nobody goes home on one bad game, and the day still ends with one winner.",
    generator: { preset: "double", teams: 8 },
    facts: factsFor("double", 8),
    sections: [
      {
        heading: "Two brackets and a grand final",
        body: [
          "The winners bracket runs like an ordinary knockout. Everyone it eliminates drops into the losers bracket, which runs alongside it and eliminates them for good on a second defeat. The two survivors meet in a grand final.",
          "The match count is the giveaway for how much longer this takes than a straight knockout: everybody but the winner has to lose twice, so it is roughly double. That is the price of the second life, and it is worth knowing before you commit a hall to it.",
        ],
      },
      {
        heading: "Why it is worth the extra time",
        body: [
          "A straight knockout can send the second-best team home in the first round because of one bad draw. Double elimination is the cheapest fix for that: it costs about twice the matches and it almost never produces a winner nobody believes in.",
          "It is the default in esports for exactly this reason, and it works just as well in a hall: the losers bracket keeps courts busy and keeps teams in the building.",
        ],
      },
      {
        heading: "Byes here mean something different",
        body: [
          "A bye in a bracket is not a match and scores nothing. It is a free pass to the next round. A bye in a Swiss round is the opposite: it takes the points for a win, because otherwise sitting out sends whoever was the odd one out to the bottom of the table for something that was not their fault. They are the same record in the database and they mean opposite things, which is worth knowing if you ever look at the raw data.",
        ],
      },
    ],
    faq: [
      {
        q: "How many matches in a double elimination tournament?",
        a: "Roughly 2 × teams − 2, because everybody except the winner has to lose twice. Eight teams is 14 matches against a straight knockout's 8.",
      },
      {
        q: "Does the grand final have a bracket reset?",
        a: "Not currently. The winners-bracket finalist and the losers-bracket finalist play one grand final and it decides the tournament.",
      },
      {
        q: "How long does it take compared to a knockout?",
        a: "About twice as long for the same field, which on two courts and a 25-minute slot is the difference between a morning and most of a day.",
      },
    ],
    related: [
      "8-team-double-elimination-bracket",
      "16-team-double-elimination-bracket",
      "single-elimination-bracket-generator",
      "esports-tournament-bracket",
      "guide/single-vs-double-elimination",
    ],
  },

  {
    slug: "swiss-tournament-generator",
    kind: "format",
    title: "Swiss Tournament Generator: Pairings That Draw Themselves",
    h1: "Swiss tournament generator",
    description:
      "Run a Swiss tournament where each round pairs teams on the same record and the next round draws itself when the last one finishes. Free.",
    lede:
      "No groups and nobody knocked out. Everyone plays the same number of rounds, each one against somebody on the same record: win and you meet a winner, lose and you meet somebody who lost. The table sorts itself out.",
    generator: { preset: "swiss", teams: 16 },
    alternate: { hreflang: "cs", slug: "svycarsky-system-turnaj-rozpis" },
    facts: factsFor("swiss", 16),
    sections: [
      {
        heading: "The next round draws itself",
        body: [
          "Only round one is written up front, because the rest of them are not knowable yet. When the last result of a round goes in, the next round is paired from the table as it stood at that moment, never from the round being drawn, which is the mistake that produces a pairing depending on its own result.",
          "There is nothing to press. Finishing a round is what draws the next one. There is a manual pairing endpoint, but it is the repair path rather than the normal one.",
        ],
      },
      {
        heading: "How many rounds",
        body: [
          "The default is ceil(log2(teams)), the fewest rounds that can still leave exactly one team unbeaten, with a floor of three and a ceiling of however many opponents there actually are. Sixteen teams is four rounds; thirty-two is five; sixty-four is six.",
          "You can set it higher for a longer day. Run it long enough against a small field and the draw will run out of fresh opponents and start repeating a meeting; nothing is wrong when that happens, but you are told about it rather than left to notice.",
        ],
      },
      {
        heading: "Byes score",
        body: [
          "An odd field means one team sits out each round, and in a Swiss that bye takes the points for a win. Scoring it zero would send whoever happened to be the odd one out to the bottom of the table for something they had no part in.",
        ],
      },
      {
        heading: "Correcting a result redraws what it fed",
        body: [
          "Fix a score and the round it fed is redrawn, but only while nothing from that round onwards has been played. Matches cannot be unplayed to match a corrected table, so past that point the correction updates the standings and leaves the pairings alone.",
        ],
      },
    ],
    faq: [
      {
        q: "How many rounds should a Swiss tournament have?",
        a: "ceil(log2(teams)) is the standard answer: 8 teams → 3 rounds, 16 → 4, 32 → 5, 64 → 6. That is the fewest that can leave one team unbeaten.",
      },
      {
        q: "Can two teams play each other twice?",
        a: "The pairing avoids rematches. If the field is small and the tournament runs long it can run out of fresh opponents, in which case it repeats a meeting and tells you it did.",
      },
      {
        q: "How does the tournament end?",
        a: "Either on the table after the last round, or with a playoff: the default carries the top four into semi-finals and a third-place match.",
      },
    ],
    related: [
      "16-player-swiss-tournament",
      "32-player-swiss-tournament",
      "chess-swiss-tournament-generator",
      "guide/how-swiss-pairing-works",
      "guide/how-many-swiss-rounds",
    ],
  },

  {
    slug: "group-stage-knockout-generator",
    kind: "format",
    title: "Group Stage and Knockout Generator: Pools Then Playoff",
    h1: "Group stage and knockout generator",
    description:
      "Draw groups, then a playoff that seeds itself from the final group tables. The World Cup format for any number of teams. Free, no account.",
    lede:
      "Everyone gets a few guaranteed matches, the top of each group carries on, and the playoff seeds itself from the tables the moment they are final. What most one-day tournaments actually do.",
    generator: { preset: "groups", teams: 12 },
    alternate: { hreflang: "cs", slug: "skupiny-a-play-off-generator" },
    facts: factsFor("groups", 12),
    sections: [
      {
        heading: "The playoff fills itself in",
        body: [
          `Twelve teams draws as ${poolShape(12)}. The bracket is drawn at the same time as the groups, with its positions labelled "1. A", "2. B" and so on, so the whole day is on the wall from the first whistle.`,
          "As each group finishes, the positions waiting on it resolve and real team names replace the labels. Nothing has to be re-entered and nobody has to redraw anything at the halfway point of the day, which is the point in a tournament when redrawing anything by hand goes wrong.",
        ],
      },
      {
        heading: "A provisional table never promotes anybody",
        body: [
          "A group table is provisional until every fixture in it is settled, and a playoff position waiting on that group will not fill until it is. Promoting a provisionally-first team into a bracket would be the worst bug this system could have: a team told they are through, playing a quarter-final, while a group match that changes the order is still being played on the next court.",
        ],
      },
      {
        heading: "The best third-placed teams",
        body: [
          "When the number of group winners and runners-up does not fill the bracket, the gap is closed by taking the best teams from the next place down, chosen across the groups rather than within one. That needs a table the group tables cannot produce: which of the third-placed teams were actually best.",
          "It runs tier by tier: every group's winner, then every runner-up, then every third. That way a runner-up never outranks a winner. Within a tier, results against anyone finishing below the smallest group's last place are disregarded, so teams out of a group of four and a group of three are compared over the same number of matches.",
        ],
      },
    ],
    faq: [
      {
        q: "How many groups should I have?",
        a: "Groups of four or five are the sweet spot: three or four guaranteed matches each, and a table small enough to finish before the playoff needs it. Whistle.day defaults to pools of at most five and never fewer than two pools.",
      },
      {
        q: "How many teams advance from each group?",
        a: "Two by default, which is what fills a bracket cleanly from an even number of groups. You can take more, and you can top the bracket up with the best third-placed teams.",
      },
      {
        q: "What decides the group tables?",
        a: "Points, then head-to-head among the tied teams only, then score difference, then points scored. When a table needs more than points to rank, the criteria that separated it are printed underneath.",
      },
    ],
    related: [
      "4-groups-of-4",
      "4-groups-of-3",
      "12-team-group-stage-and-playoff",
      "round-robin-generator",
      "guide/group-stage-tiebreakers-explained",
    ],
  },

  {
    slug: "league-table-generator",
    kind: "format",
    title: "League Table Generator: Standings With Explained Tiebreakers",
    h1: "League table generator",
    description:
      "A live league table that rebuilds after every result, with head-to-head tiebreakers that print the reason a tie was separated. Free.",
    lede:
      "Enter results, get a table. Played, won, drawn, lost, score for and against, points, recomputed from scratch every time so a correction lands where it should have been the first time.",
    generator: { preset: "everyone", teams: 8 },
    sections: [
      {
        heading: "Points are configurable, tiebreakers are ordered",
        body: [
          "Points for a win, a draw and a loss are settings, because a volleyball league and a football league do not agree about any of them. So is the order of the tiebreakers: points, head-to-head, score difference, points scored, sets won, seed. They are applied left to right and the ones that were actually needed are recorded against the table.",
        ],
      },
      {
        heading: "Why the reason is printed",
        body: [
          "\"Why are they above us\" is the question that starts arguments in a hall, and a table that cannot answer it is a table somebody will dispute at the trophy presentation. So when two teams were level on points and head-to-head separated them, the table says so underneath, in words.",
        ],
      },
      {
        heading: "Walkovers do not invent a score",
        body: [
          "A team that does not turn up concedes the match, and the winner is credited whatever the rulebook says: zero by default, so an absence never flatters a score difference. The table shows it as a walkover rather than as a scoreline for a match nobody played.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I use it without running a tournament?",
        a: "A league is a single round-robin group with no playoff after it, which is exactly what the everyone-plays-everyone format produces. Set it up once and enter results as the season goes.",
      },
      {
        q: "Does it handle a two-leg league?",
        a: "Yes. Home and away doubles the fixture list and the table treats it as one competition.",
      },
    ],
    related: [
      "round-robin-generator",
      "live-tournament-standings-screen",
      "guide/group-stage-tiebreakers-explained",
    ],
  },

  {
    slug: "multi-stage-tournament-builder",
    kind: "format",
    title: "Multi-Stage Tournament Builder: Any Order of Formats",
    h1: "Multi-stage tournament builder",
    description:
      "Groups then Swiss then a playoff, or any other order. Build a tournament out of stages that feed each other, and run it from a phone.",
    lede:
      "A tournament is an ordered list of stages, and the order is yours. Groups then a playoff is the common one. Swiss then a playoff works. So does a playoff first and a consolation round-robin after it, if that is the day you want.",
    generator: { preset: "groups", teams: 16 },
    sections: [
      {
        heading: "Stages feed each other by position, not by name",
        body: [
          "A later stage can be seeded from an earlier one's tables: take the top two of every group, or the top four of a Swiss, and the positions in the next stage carry labels until the tables that fill them are final.",
          "Because the wiring is by position rather than by team, the whole tournament can be drawn before a ball is hit. The bracket is on the wall from the start with \"1. A\" and \"Winner SF1\" in it, and it fills in as the day goes.",
        ],
      },
      {
        heading: "Corrections propagate the whole way down",
        body: [
          "Editing a score hours later reruns the entire chain: the winner, the tables, the positions those tables feed, and the bracket cells downstream of them. There is no separate repair step for the normal case, because the normal case is that somebody typed a 2 where they meant a 3 and noticed at the trophy table.",
        ],
      },
      {
        heading: "A team who turns up late",
        body: [
          "Somebody arriving after the draw is the normal case rather than the exception, and it is handled: a late team can be added to a group or a Swiss field, and a bracket nobody has played yet is redrawn around them.",
          "The one case with no answer is a knockout that has already started. The ninth team is not one of eight positions decided on Friday, and rewriting the draw around them would rewrite a match that has been played, so at that point they are genuinely too late.",
        ],
      },
      {
        heading: "What it will not do yet",
        body: [
          "A bracket topped up with the best third-placed teams can draw two teams from the same group against each other, because which groups those teams come from is not known until the groups have been played. Competitions that care fix it with a published table of every possible combination.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I run Swiss and then a knockout?",
        a: "Yes. That is the default Swiss setup: Swiss rounds for the whole field, then semi-finals and a third-place match for the top four.",
      },
      {
        q: "How many stages can a tournament have?",
        a: "There is no limit. Stages are an ordered list and each one can be seeded from any earlier one.",
      },
    ],
    related: [
      "group-stage-knockout-generator",
      "swiss-tournament-generator",
      "guide/group-stage-vs-swiss",
      "tournament-projector-display",
    ],
  },
];
