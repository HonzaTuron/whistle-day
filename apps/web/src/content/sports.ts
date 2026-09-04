/**
 * One page per sport, over the same generator.
 *
 * Nothing here forks the engine. A sport page is a default format, a default
 * field size, the words that sport uses for a court and a match, and two
 * paragraphs about what running that particular day is actually like. The
 * wizard it links into is the same wizard.
 *
 * Padel americano is deliberately absent. It rotates partners between rounds
 * and scores individuals rather than pairs, which is a format Whistle.day does not
 * generate — and a page promising it would be the one kind of page that costs
 * more than it earns.
 */

import { factsFor } from "./shape";
import type { Page, Section } from "./types";
import type { PresetId } from "../lib/presets";

interface SportSpec {
  slug: string;
  /** "volleyball", used mid-sentence. */
  sport: string;
  title: string;
  h1: string;
  description: string;
  lede: string;
  preset: PresetId;
  teams: number;
  /** What this sport calls the playing area, plural. */
  courts: string;
  sections: Section[];
  faq: { q: string; a: string }[];
  related: string[];
}

const SPORTS: SportSpec[] = [
  {
    slug: "volleyball-tournament-bracket",
    sport: "volleyball",
    title: "Volleyball Tournament Generator — Pools, Playoff and a Wall Display",
    h1: "Volleyball tournament generator",
    description:
      "Draw volleyball pools and a playoff, enter results set by set, and put the tables on a projector in the hall. Free, no account.",
    lede:
      "Pools then a playoff, scores entered set by set from the side of the court, and a projector view the whole hall can read. Built for the one-day tournament in a sports hall, which is what most volleyball tournaments are.",
    preset: "groups",
    teams: 12,
    courts: "courts",
    sections: [
      {
        heading: "Sets, not just a match score",
        body: [
          "Under the match score are the points, set by set. They are optional and plenty of days are run without them, but they are not decoration: the points sum into the table as the tiebreak that separates two teams level on match points and on sets won.",
          "They are written as they are entered rather than saved at the end, because somebody standing at the net tapping a point per rally will not press Save between rallies. Every screen showing the tournament is nudged, so a tap at the court is a scoreline on the wall a moment later.",
        ],
      },
      {
        heading: "The match score is counted from the sets, not typed beside them",
        body: [
          "Once a set exists the match-score steppers become a read-out. A screen that accepts 2–1 over three sets reading 25–20, 22–25, 19–25 is a screen that will eventually put a scoreline on a wall the hall can see is wrong.",
          "And a set is won when it is over: 18–14 in the third is not a two-set lead, it is a third set somebody is ahead in, so the wall says 1–1 while it is being played.",
        ],
      },
      {
        heading: "The wall is the point",
        body: [
          "A volleyball hall has a lot of people in it who are not playing, and a projector is how they find out what is happening without asking the organiser. The screen rotates itself — live matches, the pool tables, the bracket, what is on which court next — and is sized to be read from the far end of a hall.",
          "Light is the default rather than dark. A projector has no black; an unlit pixel is the lamp's grey floor, so under sports-hall lighting a dark scoreboard washes out and takes its text with it.",
        ],
      },
    ],
    faq: [
      {
        q: "What format works best for a one-day volleyball tournament?",
        a: "Pools then a playoff, almost always. It guarantees every team three or four matches and still finishes with a final. Twelve teams draws as three pools of four.",
      },
      {
        q: "Can I record individual set scores?",
        a: "Yes, and they feed the tiebreak. They are optional — a day run on match scores alone works fine.",
      },
      {
        q: "How do I show the tables in the hall?",
        a: "Every tournament gets a projector link and a QR code. Point a laptop or a smart TV at the link and leave it alone; it updates itself.",
      },
    ],
    related: [
      "12-team-group-stage-and-playoff",
      "beach-volleyball-tournament-generator",
      "group-stage-knockout-generator",
      "tournament-projector-display",
    ],
  },

  {
    slug: "beach-volleyball-tournament-generator",
    sport: "beach volleyball",
    title: "Beach Volleyball Tournament Generator — Pools and Playoff",
    h1: "Beach volleyball tournament generator",
    description:
      "Draw beach volleyball pools across your courts, run the day from a phone in the sand, and share results by QR code. Free.",
    lede:
      "Pools across however many courts you have, results entered from a phone between matches, and a link players can open on their own phones instead of walking over to the desk.",
    preset: "groups",
    teams: 16,
    courts: "courts",
    sections: [
      {
        heading: "A phone, because there is no desk",
        body: [
          "Beach tournaments do not have a hall with a projector and a table for a laptop. They have somebody with a phone and a lot of sand. The whole organiser side runs on a phone — put a match on a court, mark it live, enter the result — and the wizard that sets the tournament up does too.",
          "The spectator side is a phone view rather than a wall: tabs, scrolling, one person looking for one thing. Print the QR code once and stick it on the desk.",
        ],
      },
      {
        heading: "Pools of four, across the courts you have",
        body: [
          "Sixteen pairs draws as four pools of four — three guaranteed matches each and a quarter-final for the top two of every pool. The schedule spreads across your courts and the estimate on the format screen is quoted against the number you actually entered, which on a beach is usually the real constraint.",
        ],
      },
    ],
    faq: [
      {
        q: "How many courts do I need?",
        a: "The format screen quotes a finish time against the courts you enter, so try a couple of numbers. Sixteen pairs in pools on four courts is a comfortable day; on two it is a long one.",
      },
      {
        q: "Can players see the draw on their phones?",
        a: "Yes — a QR code opens a phone-sized view of the pools, the tables and what is on next.",
      },
    ],
    related: [
      "16-team-group-stage-and-playoff",
      "volleyball-tournament-bracket",
      "qr-code-tournament-results",
    ],
  },

  {
    slug: "padel-tournament-generator",
    sport: "padel",
    title: "Padel Tournament Generator — Draws, Tables and a Live Screen",
    h1: "Padel tournament generator",
    description:
      "Generate a padel draw for any number of pairs, run it across your courts, and show live results on a screen at the club. Free.",
    lede:
      "Any number of pairs, drawn into pools or a bracket, scheduled across the club's courts. Results go in from a phone and the screen in the clubhouse keeps up on its own.",
    preset: "groups",
    teams: 16,
    courts: "courts",
    sections: [
      {
        heading: "Pairs are teams",
        body: [
          "A padel pair is entered as one team with two members on it. The draw, the tables and the bracket all work on the pair, which is what a padel tournament actually competes.",
          "Partner-rotating formats — americano and mexicano, where individuals score and partners change every round — are a different thing and Whistle.day does not generate them. If that is the day you are running, this is not the tool for it.",
        ],
      },
      {
        heading: "The clubhouse screen",
        body: [
          "Most padel clubs have a screen somewhere already. Point it at the projector link and it shows what is on which court, the pool tables and the bracket, rotating on a timer, with no one to drive it. The organiser sets which panels appear from their phone and sees the change on the screen immediately.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I run a padel americano?",
        a: "No. Americano rotates partners between rounds and scores individuals, which is a format Whistle.day does not generate. Pools and brackets on fixed pairs work fully.",
      },
      {
        q: "How many pairs can I enter?",
        a: "There is no cap. Sixteen pairs draws as four pools of four; the numbers re-quote for whatever you enter.",
      },
    ],
    related: [
      "16-team-group-stage-and-playoff",
      "pickleball-round-robin-generator",
      "tournament-projector-display",
    ],
  },

  {
    slug: "pickleball-round-robin-generator",
    sport: "pickleball",
    title: "Pickleball Round Robin Generator — Schedule and Standings",
    h1: "Pickleball round robin generator",
    description:
      "Make a pickleball round robin schedule with a live standings table, spread across your courts. Free, no account, no ads.",
    lede:
      "Everybody plays everybody, spread across your courts, with a table that rebuilds itself after every result. The format most club pickleball days actually run.",
    preset: "everyone",
    teams: 8,
    courts: "courts",
    sections: [
      {
        heading: "Round robin first, bracket only if you want one",
        body: [
          "Club pickleball is mostly round robin, because the point of the morning is playing rather than winning, and nobody wants to drive over to lose once and go home. Eight teams is 28 matches and everybody plays seven of them.",
          "If you do want to finish with a final, the same field can run as pools with a playoff on top — same wizard, different answer on the format screen.",
        ],
      },
      {
        heading: "Points matter for the table",
        body: [
          "Two teams level on wins is the normal outcome of a round robin this size, and points scored is what separates them. Entering the actual scores rather than just the winner is what makes the final table defensible.",
        ],
      },
    ],
    faq: [
      {
        q: "How many matches for 8 teams?",
        a: "28 — every pair meets once. Each team plays 7.",
      },
      {
        q: "Can I run it across several courts?",
        a: "Yes, and a round robin parallelises almost perfectly, so four courts really is about a quarter of the time of one.",
      },
    ],
    related: [
      "8-team-round-robin-schedule",
      "round-robin-generator",
      "league-table-generator",
    ],
  },

  {
    slug: "badminton-tournament-draw",
    sport: "badminton",
    title: "Badminton Tournament Draw — Free Generator and Live Draw Sheet",
    h1: "Badminton tournament draw",
    description:
      "Generate a badminton draw for any entry list, with byes placed on the seeds, and a live draw sheet on a screen in the hall. Free.",
    lede:
      "A draw for whatever the entry list turns out to be, with the byes placed on the seeds rather than scattered, and a draw sheet on the hall screen that fills itself in as results come back to the desk.",
    preset: "knockout",
    teams: 16,
    courts: "courts",
    sections: [
      {
        heading: "The draw sheet is readable before it is played",
        body: [
          "A badminton draw is mostly empty on the morning of the tournament, and the empty half is what everybody stands and looks at. Every position that does not have a name yet carries its label — \"Winner QF1\" — so the sheet reads as a plan rather than a grid of blanks.",
          "It goes on a screen rather than on paper on a wall, and it updates as the desk enters results, which saves the walk over to write a name in a box.",
        ],
      },
      {
        heading: "Byes go to the seeds",
        body: [
          "Entry lists are never a power of two. The bracket is drawn at the next one up and the spare positions become byes, placed at the top of the draw so the seeded players get them. That is the convention, and it is also the only placement that does not hand a free round to whoever happened to land next to a gap.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I run several events on one day?",
        a: "Each event is its own tournament — singles, doubles, mixed — and each gets its own link and screen. There is no cap on how many you run.",
      },
      {
        q: "Does it handle byes automatically?",
        a: "Yes. Enter the entry list and the bracket is sized up to the next power of two with the byes placed on the seeds.",
      },
    ],
    related: [
      "16-team-single-elimination-bracket",
      "single-elimination-bracket-generator",
      "guide/how-to-seed-a-bracket",
      "table-tennis-tournament-generator",
    ],
  },

  {
    slug: "table-tennis-tournament-generator",
    sport: "table tennis",
    title: "Table Tennis Tournament Generator — Groups and Knockout",
    h1: "Table tennis tournament generator",
    description:
      "Draw table tennis groups and a knockout, run it across your tables, and show the results on a screen. Free, no account.",
    lede:
      "Groups then a knockout, across however many tables you have. Short matches and a lot of them, which is the one format of day where the schedule matters more than the draw.",
    preset: "groups",
    teams: 16,
    courts: "tables",
    sections: [
      {
        heading: "A lot of short matches",
        body: [
          "Table tennis runs more matches per hour than almost anything else, which means the constraint is rarely the format and almost always how many tables are free. The format screen quotes a finish time against the tables you enter, so you can try three numbers and pick the day you can actually staff.",
        ],
      },
      {
        heading: "Groups of four, then a bracket",
        body: [
          "Sixteen players draws as four groups of four: three guaranteed matches each and a quarter-final for the top two of every group. The bracket is drawn at the same time as the groups and fills itself in as each group finishes.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I record individual games within a match?",
        a: "Yes — game-by-game scores feed the tiebreak that separates two players level on matches and on games.",
      },
      {
        q: "How many tables do I need for 16 players?",
        a: "Four is comfortable for a group stage of 24 matches. The estimate on the format screen quotes it for whatever you enter.",
      },
    ],
    related: [
      "16-team-group-stage-and-playoff",
      "group-stage-knockout-generator",
      "badminton-tournament-draw",
    ],
  },

  {
    slug: "futsal-tournament-generator",
    sport: "futsal",
    title: "Futsal Tournament Generator — Groups, Playoff and a Hall Screen",
    h1: "Futsal tournament generator",
    description:
      "Draw futsal groups and a playoff, run the day from a phone, and put the tables on the hall screen. Free, no account.",
    lede:
      "Groups then a playoff, scheduled across the pitches in the hall, run from a phone at the side. The tables rebuild themselves and the wall keeps up.",
    preset: "groups",
    teams: 12,
    courts: "pitches",
    sections: [
      {
        heading: "Goal difference, and the argument about it",
        body: [
          "Futsal groups end level on points more often than most sports, and goal difference is what separates them — except when head-to-head comes first, which depends on whose rules you are running under. Both are configurable, applied in the order you set, and the table prints which one actually did the separating.",
          "That sentence under the table is the difference between a table and an argument at the trophy presentation.",
        ],
      },
      {
        heading: "One hall, several pitches, one screen",
        body: [
          "A futsal day is usually one hall split into two or three pitches with everybody's parents along the side. The projector view shows what is live on each pitch, the group tables and the bracket, rotating on its own, so nobody has to come and ask.",
        ],
      },
    ],
    faq: [
      {
        q: "How do I split 12 teams?",
        a: "Three groups of four — three guaranteed matches each, with the top two of each going through to a quarter-final round topped up from the best third-placed teams.",
      },
      {
        q: "Can I set points for a win and a draw?",
        a: "Yes, along with the order of the tiebreakers.",
      },
    ],
    related: [
      "12-team-group-stage-and-playoff",
      "kids-football-tournament-schedule",
      "group-stage-knockout-generator",
      "guide/group-stage-tiebreakers-explained",
    ],
  },

  {
    slug: "chess-swiss-tournament-generator",
    sport: "chess",
    title: "Chess Swiss Tournament Generator — Pairings Draw Themselves",
    h1: "Chess Swiss tournament generator",
    description:
      "Run a Swiss chess tournament where each round pairs players on the same score and the next round draws itself. Free, no account.",
    lede:
      "The format chess invented. Every player plays every round, each one against somebody on the same score, and the pairing for the next round is drawn the moment the last game of this one is entered.",
    preset: "swiss",
    teams: 32,
    courts: "boards",
    sections: [
      {
        heading: "Pairings without a pairing program",
        body: [
          "Finishing a round is what draws the next one, from the table as it stood at that moment — never from the round being drawn, which is the mistake that produces a pairing that depends on its own result. There is nothing to press and no file to import.",
          "The draw avoids rematches. On a small field over a long tournament it will eventually run out of fresh opponents and repeat a meeting; nothing is wrong when that happens, but you are told rather than left to spot it.",
        ],
      },
      {
        heading: "Byes score a point",
        body: [
          "An odd field means somebody sits out each round, and that bye takes the point. Scoring it zero would send whoever happened to be the odd one out to the bottom of the table for something they had no part in — which is exactly the opposite of what a bye means in a knockout bracket, where it is a free pass and scores nothing.",
        ],
      },
      {
        heading: "What it does not do",
        body: [
          "This is not a FIDE-rated pairing engine. It does not implement Dutch or Burstein pairing rules, it does not balance colours, and it does not compute Buchholz. It pairs on score, avoids rematches, and ranks on points and the tiebreakers you configure. For a club night or a school tournament that is the whole job; for a rated event it is not.",
        ],
      },
    ],
    faq: [
      {
        q: "How many rounds for 32 players?",
        a: "Five — ceil(log2(32)) — which is the fewest that can still leave exactly one player unbeaten.",
      },
      {
        q: "Does it balance colours?",
        a: "No. It pairs on score and avoids rematches; colour allocation is not implemented.",
      },
      {
        q: "Does it calculate Buchholz?",
        a: "No. Ranking is on points and the configurable tiebreakers — head-to-head, score difference, and so on.",
      },
    ],
    related: [
      "32-player-swiss-tournament",
      "16-player-swiss-tournament",
      "swiss-tournament-generator",
      "guide/how-swiss-pairing-works",
    ],
  },

  {
    slug: "esports-tournament-bracket",
    sport: "esports",
    title: "Esports Tournament Bracket — Double Elimination, Free",
    h1: "Esports tournament bracket",
    description:
      "Generate a double elimination esports bracket with a losers bracket and a grand final, plus a live overlay-ready results screen. Free.",
    lede:
      "Double elimination by default, because one bad game should not end anybody's tournament. A winners bracket, the losers bracket that catches everyone it knocks out, and a grand final between them.",
    preset: "double",
    teams: 16,
    courts: "stations",
    sections: [
      {
        heading: "Why double elimination is the default here",
        body: [
          "It is the esports convention for a reason: a single-elimination bracket can send the second-best team home in round one on a draw nobody chose. Double elimination costs about twice the matches and almost never produces a winner nobody believes in.",
          "Sixteen teams is 30 matches against a straight knockout's 16. Worth knowing before you schedule the day.",
        ],
      },
      {
        heading: "A screen for the stream, and one for the players",
        body: [
          "The projector view is a self-rotating screen showing what is live, the bracket and the recent results — sized to be read at a distance, which also makes it legible as a full-screen source in a stream. The phone view is the one to give the players.",
          "Both read from one public endpoint with the token in the URL as the only credential, so no one needs an account to watch.",
        ],
      },
      {
        heading: "What it does not do",
        body: [
          "There is no check-in, no bracket reset in the grand final, no seeding from an external ladder and no match reporting by the players themselves. Results are entered by whoever is running it.",
        ],
      },
    ],
    faq: [
      {
        q: "Is there a bracket reset in the grand final?",
        a: "No. The winners-bracket finalist and the losers-bracket finalist play one grand final and it decides the tournament.",
      },
      {
        q: "Can players report their own scores?",
        a: "Not currently. Results are entered by the organiser or whoever is running the desk.",
      },
      {
        q: "Is it really free with no ads?",
        a: "Yes, including the projector view. That is the main difference from the incumbents in this space.",
      },
    ],
    related: [
      "16-team-double-elimination-bracket",
      "double-elimination-bracket-generator",
      "vs/challonge",
      "vs/battlefy",
    ],
  },

  {
    slug: "spikeball-roundnet-tournament-bracket",
    sport: "roundnet",
    title: "Spikeball / Roundnet Tournament Generator — Pools and Bracket",
    h1: "Spikeball and roundnet tournament generator",
    description:
      "Draw roundnet pools and a bracket across your nets, run it from a phone, and share the results by QR code. Free.",
    lede:
      "Pools across however many nets you have, then a bracket for the top of each. Run from a phone in a field, where there is no desk and no power.",
    preset: "groups",
    teams: 16,
    courts: "nets",
    sections: [
      {
        heading: "Built for a field, not a hall",
        body: [
          "Roundnet tournaments happen outside with no laptop and nowhere to put one. The whole organiser side is a phone: put a match on a net, mark it live, enter the result. Players get a QR code and check the pools on their own phones instead of walking back to whoever is running it.",
        ],
      },
      {
        heading: "Pools of four, then a bracket",
        body: [
          "Sixteen pairs draws as four pools of four — three guaranteed games each — with the top two of every pool going through to a quarter-final. The bracket is drawn at the same time and fills in as the pools finish.",
        ],
      },
    ],
    faq: [
      {
        q: "Does it work without signal?",
        a: "Results, yes — they queue on the phone and send themselves when the signal comes back. The tables and the bracket stand still until the queue drains, because those are worked out from every fixture at once on the server. Setting the tournament up needs a signal.",
      },
      {
        q: "How many nets do I need?",
        a: "The format screen quotes a finish time against the number you enter. Sixteen pairs in pools on four nets is a comfortable afternoon.",
      },
    ],
    related: [
      "16-team-group-stage-and-playoff",
      "qr-code-tournament-results",
      "group-stage-knockout-generator",
    ],
  },

  {
    slug: "kids-football-tournament-schedule",
    sport: "youth football",
    title: "Kids Football Tournament Schedule — Everyone Plays, Free",
    h1: "Kids football tournament schedule",
    description:
      "Make a youth football tournament schedule where every team gets the same number of games, on a phone, with results on a screen. Free.",
    lede:
      "The format that matters for children is the one where everybody plays the same number of games. Groups then a playoff guarantees three; everyone-plays-everyone guarantees more and finishes on a table instead of a final.",
    preset: "groups",
    teams: 12,
    courts: "pitches",
    sections: [
      {
        heading: "Do not run a straight knockout",
        body: [
          "A knockout sends half the field home after one game, and for a field of eight-year-olds who were driven there by a parent that is the wrong day out. Groups then a playoff guarantees everybody three matches before anybody is knocked out, for about the same amount of pitch time.",
          "If you have the morning for it, everyone-plays-everyone is better still: no elimination at all, the same number of games for every team, and a table at the end.",
        ],
      },
      {
        heading: "Parents can follow it on their phones",
        body: [
          "Every tournament gets a QR code that opens a phone-sized view — the fixtures, the tables, what is on which pitch next. Print it once and pin it to the clubhouse door and nobody has to come and ask when their child plays again.",
        ],
      },
    ],
    faq: [
      {
        q: "What format guarantees everyone the same number of games?",
        a: "Everyone-plays-everyone, always. Groups then a playoff guarantees the group games to everybody, then the top teams get more.",
      },
      {
        q: "Can I run it without keeping score?",
        a: "You can leave results unentered and use it purely as a schedule and a screen, though the tables will stay empty.",
      },
    ],
    related: [
      "12-team-group-stage-and-playoff",
      "school-sports-day-generator",
      "futsal-tournament-generator",
      "guide/how-to-run-a-one-day-tournament",
    ],
  },

  {
    slug: "school-sports-day-generator",
    sport: "school sport",
    title: "School Sports Day Generator — Schedule, Tables and a Hall Screen",
    h1: "School sports day generator",
    description:
      "Plan a school sports day: classes drawn into groups, matches spread across the courts you have, results on the hall screen. Free.",
    lede:
      "Classes or houses drawn into groups, matches spread across every court and pitch you can get hold of, and a screen in the hall so nobody has to announce anything.",
    preset: "groups",
    teams: 16,
    courts: "courts",
    sections: [
      {
        heading: "The constraint is space, not format",
        body: [
          "A sports day is decided by how many courts you can get and how long the timetable gives you. The format screen quotes matches and a finish time against the courts and teams you actually enter, so you can find the shape that fits the slot rather than discovering at 2pm that it does not.",
        ],
      },
      {
        heading: "No account, and nothing to install",
        body: [
          "It runs in a browser and there is no signup in front of it, which matters when the person running it is a teacher with a school laptop and no ability to install anything. Put the projector link on the hall screen and the phone link on a printed QR by the door.",
        ],
      },
    ],
    faq: [
      {
        q: "Can several teachers enter results?",
        a: "Yes. Each one scans a QR code and runs their court from their own phone — no accounts to create, no names to type in. Handing out the codes stays the organiser's.",
      },
      {
        q: "Do I need to install anything?",
        a: "No. It is a website, on any browser, including a school-managed one.",
      },
    ],
    related: [
      "16-team-group-stage-and-playoff",
      "kids-football-tournament-schedule",
      "tournament-projector-display",
      "guide/how-many-courts-do-i-need",
    ],
  },
];

export const SPORT_PAGES: Page[] = SPORTS.map((spec) => ({
  slug: spec.slug,
  kind: "sport",
  title: spec.title,
  h1: spec.h1,
  description: spec.description,
  lede: spec.lede,
  generator: { preset: spec.preset, teams: spec.teams, sport: spec.sport },
  facts: factsFor(spec.preset, spec.teams),
  sections: spec.sections,
  faq: spec.faq,
  related: spec.related,
}));
