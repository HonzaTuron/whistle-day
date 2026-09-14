/**
 * The questions people ask on the way to needing a tournament generator.
 *
 * These are the pages that earn links rather than conversions: "how many Swiss
 * rounds for 16 players" is asked by somebody who has not decided what to use
 * yet, and answering it properly is how you become the page that gets cited.
 *
 * Each one answers the question in the first paragraph. The tool comes after,
 * not before — a guide that makes somebody scroll past a signup box to find
 * the answer is an advert, and it will be treated as one.
 */

import { swissRounds } from "../lib/presets";
import type { Page } from "./types";

/** ceil(log2(n)), floored at three, as the Swiss default does it. */
const roundsTable = [8, 16, 24, 32, 48, 64, 128]
  .map((n) => `${n} players → ${swissRounds(n)} rounds`)
  .join("; ");

export const GUIDE_PAGES: Page[] = [
  {
    slug: "guide/how-swiss-pairing-works",
    kind: "guide",
    title: "How Swiss Pairing Works — Explained With an Example",
    h1: "How Swiss pairing works",
    description:
      "A Swiss tournament pairs players on the same score each round, avoids rematches, and eliminates nobody. Worked example and round counts.",
    lede:
      "In a Swiss tournament everybody plays every round and nobody is knocked out. Each round pairs people on the same record — win and you meet a winner, lose and you meet somebody who lost — so the field sorts itself into order without anybody going home.",
    sections: [
      {
        heading: "Round one is the only one drawn in advance",
        body: [
          "Round one is paired at random, or by seed if you have one. Every round after it is paired from the standings as they stand when the previous round finishes — which means it cannot be drawn in advance, because it depends on results that have not happened.",
          "This is the property that makes Swiss work and the one that trips people up: you cannot publish the whole schedule on the morning of the tournament. You can publish round one and the number of rounds, and that is it.",
        ],
      },
      {
        heading: "A worked example: eight players, three rounds",
        body: [
          "Round one pairs the eight at random. Four win and four lose.",
          "Round two pairs the four winners against each other and the four losers against each other. After it there are two players on 2–0, four on 1–1, and two on 0–2.",
          "Round three pairs within those groups: the two unbeaten play each other, the four on 1–1 pair off, and the two winless play each other. After three rounds exactly one player can be 3–0, which is the point — that is why three rounds is the right number for eight players.",
          "Nobody has been eliminated. Everybody has played three matches. The table is ordered by points, and the tiebreakers sort out the players who finished level.",
        ],
      },
      {
        heading: "Rematches, and what happens when it runs out",
        body: [
          "The pairing avoids putting two players together twice. On a small field over a long tournament it will eventually run out of fresh opponents at the right score, and at that point it has to either pair somebody against a different score or repeat a meeting.",
          "Neither is wrong — it is what happens when a Swiss runs long against a small field — but it should be surfaced rather than silently done. Whistle.day reports a rematch when it has to make one.",
        ],
      },
      {
        heading: "Byes score a point",
        body: [
          "An odd field means one player sits out each round. In a Swiss that bye takes the points for a win, which surprises people who are used to brackets, where a bye scores nothing and is simply a free pass.",
          "The reason is that a Swiss bye is a lost opportunity to gain points. Scoring it zero would send whoever happened to be the odd one out to the bottom of the table for something they had no part in. In a bracket the same record means the opposite thing — the round itself, skipped — so it scores nothing. Same word, opposite meaning, which is worth knowing if you ever look at the underlying data.",
        ],
      },
      {
        heading: "What Swiss is good for",
        body: [
          "Fields too big for a round robin and too valuable to knock out. Thirty-two teams playing everyone-plays-everyone is 496 matches, which is not a day. Thirty-two teams in a straight knockout means sixteen of them have finished by mid-morning. Five Swiss rounds gives all thirty-two the same five matches and produces a credible order.",
          "It is weakest when you need a definitive winner: a Swiss table can leave two players level at the top on every tiebreaker you have. That is why most Swiss tournaments finish with a small playoff.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I publish the whole schedule in advance?",
        a: "No — only round one and the number of rounds. Every later round depends on results that have not happened yet.",
      },
      {
        q: "Is Swiss only for chess?",
        a: "It was invented for chess and is named after a Swiss tournament in 1895, but it works for anything with a large field and limited time. It is common in esports and in racket sports with big entry lists.",
      },
    ],
    related: [
      "guide/how-many-swiss-rounds",
      "swiss-tournament-generator",
      "chess-swiss-tournament-generator",
      "guide/group-stage-vs-swiss",
    ],
  },

  {
    slug: "guide/how-many-swiss-rounds",
    kind: "guide",
    title: "How Many Swiss Rounds? The Rule and a Table",
    h1: "How many Swiss rounds do you need?",
    description:
      "The standard answer is ceil(log2(players)): 8 players → 3 rounds, 16 → 4, 32 → 5, 64 → 6. Why that is the rule, and when to break it.",
    lede:
      "The rule is ceil(log2(players)) — the fewest rounds that can still leave exactly one player unbeaten. Eight players is three rounds, sixteen is four, thirty-two is five, sixty-four is six.",
    facts: [
      { label: "The rule", value: "ceil(log2(players))", note: "Rounded up." },
      { label: "16 players", value: "4 rounds" },
      { label: "32 players", value: "5 rounds" },
      { label: "64 players", value: "6 rounds" },
    ],
    sections: [
      {
        heading: "Why that number",
        body: [
          "Each round halves the number of unbeaten players. Start with 32: after one round 16 are unbeaten, after two 8, after three 4, after four 2, after five exactly 1. Five rounds is the first point at which the tournament can produce a single unbeaten player, and that is the standard definition of \"enough rounds\".",
          "Run fewer and you are guaranteed to finish with several players on the same perfect record and nothing but tiebreakers to separate them. Run more and the extra rounds are spent sorting out the middle of the table, which may well be what you want.",
        ],
      },
      {
        heading: "The table",
        body: [
          roundsTable + ".",
          "Whistle.day floors this at three, because a two-round Swiss has not sorted anything out, and caps it at the number of available opponents, because you cannot play more rounds than there are people to play.",
        ],
      },
      {
        heading: "When to run more rounds than the rule",
        body: [
          "When the whole table matters, not just the top. A league using Swiss to rank forty teams for next season's divisions cares about 20th place, and the minimum round count leaves the middle of the table barely separated.",
          "When you have the time and people came to play. The rule is a minimum for producing a winner, not a recommendation for a good day out.",
        ],
      },
      {
        heading: "When to run fewer",
        body: [
          "When a playoff is going to decide it anyway. If the top four go through to semi-finals, the Swiss only has to identify a credible top four, and one round below the rule will usually do that.",
          "The risk is ties. Fewer rounds means more players on the same score and more weight on the tiebreakers, so make sure the tiebreakers you have configured are ones you are willing to defend.",
        ],
      },
    ],
    faq: [
      {
        q: "How many rounds for 16 players?",
        a: "Four. That is ceil(log2(16)), the fewest that can leave one player unbeaten.",
      },
      {
        q: "How many rounds for 100 players?",
        a: "Seven, since ceil(log2(100)) is 7. Large open tournaments often run eight or nine to separate the field properly.",
      },
      {
        q: "Does an odd number of players change it?",
        a: "No. Somebody gets a bye each round, and the bye scores as a win.",
      },
    ],
    related: [
      "guide/how-swiss-pairing-works",
      "16-player-swiss-tournament",
      "32-player-swiss-tournament",
      "swiss-tournament-generator",
    ],
  },

  {
    slug: "guide/group-stage-tiebreakers-explained",
    kind: "guide",
    title: "Group Stage Tiebreakers Explained — Head-to-Head and the Rest",
    h1: "Group stage tiebreakers explained",
    description:
      "How teams level on points are separated: head-to-head among the tied teams only, then score difference. Why order matters, and the three-way tie.",
    lede:
      "Two teams level on points are separated by a list of criteria applied in order. Which criteria, and in which order, is a decision — and it is the decision that determines who goes through, so it is worth making before the tournament rather than during the argument.",
    sections: [
      {
        heading: "The usual order",
        body: [
          "Points, then head-to-head, then score difference, then points scored. That is the common default and it is what Whistle.day ships with.",
          "The other common order puts score difference before head-to-head — this is what most football leagues do, including the Premier League. Neither is more correct; they answer different questions. Head-to-head first says \"you beat them, so you finish above them\". Score difference first says \"you had a better tournament overall\".",
        ],
      },
      {
        heading: "Head-to-head is computed among the tied teams only",
        body: [
          "This is the part that is most often got wrong. When three teams are level on points, head-to-head means a mini-table built only from the matches those three played against each other — not their full records.",
          "It matters because a team can have a great overall record and a poor one against the specific teams it is tied with. Building the mini-table from the full fixture list would just re-derive the points they were already tied on.",
        ],
      },
      {
        heading: "The three-way tie, and why ranking is recursive",
        body: [
          "Three teams level on points, and the mini-table between them separates one but leaves two still level. What now?",
          "The correct answer is to apply the whole criteria list again, from the top, to the two that remain — and to rebuild the head-to-head mini-table from just those two, which is now simply the match they played against each other.",
          "That is why ranking is recursive rather than one comparator chain. A single sort function comparing pairs cannot express \"first separate the group of three, then re-run the whole thing on whatever is still tied\". Getting this wrong produces tables that are subtly inconsistent — A above B, B above C, C above A — which is exactly the sort of thing that gets noticed at a trophy presentation.",
        ],
      },
      {
        heading: "Print the reason",
        body: [
          "Whatever order you choose, the table should say which criterion actually separated a tie. \"Why are they above us\" is the question that starts arguments in a hall, and a table that cannot answer it is a table somebody will dispute.",
          "Whistle.day records which criteria were applied to place each row and prints them under any table that needed more than points. That sentence is the difference between a table and an argument.",
        ],
      },
      {
        heading: "Comparing across groups is a different problem",
        body: [
          "When you need the best third-placed teams across several groups — to top up a bracket — you cannot just compare their raw records, because a team in a group of five played four matches and a team in a group of four played three.",
          "The standard fix, and the one Whistle.day uses, is to disregard results against whoever finished below the smallest group's last place. Everybody is then compared over the same number of matches. It runs tier by tier as well — every group's winner, then every runner-up, then every third — so a runner-up can never outrank a winner.",
        ],
      },
    ],
    faq: [
      {
        q: "Should head-to-head come before goal difference?",
        a: "It is a choice. FIFA World Cup groups use goal difference first; UEFA competitions use head-to-head first. Decide before the tournament and publish it.",
      },
      {
        q: "What if teams are level on everything?",
        a: "Most rulebooks end with a coin toss or a drawing of lots. Whistle.day's last criterion is the seed, which is deterministic and defensible, but you can configure a draw.",
      },
      {
        q: "How do you compare teams from groups of different sizes?",
        a: "Disregard results against the teams finishing below the smallest group's last position, so everyone is compared over the same number of matches.",
      },
    ],
    related: [
      "group-stage-knockout-generator",
      "league-table-generator",
      "live-tournament-standings-screen",
      "guide/group-stage-vs-swiss",
    ],
  },

  {
    slug: "guide/how-to-seed-a-bracket",
    kind: "guide",
    title: "How to Seed a Bracket — Snake Seeding and Bye Placement",
    h1: "How to seed a bracket",
    description:
      "Seeding puts the best teams on opposite sides so they meet last. How the standard bracket positions work, and where the byes go.",
    lede:
      "Seeding exists so the two best teams meet in the final rather than in round one. The standard layout puts seed 1 at the top of the draw and seed 2 at the bottom, then fills in so that every round pairs the highest remaining seed against the lowest.",
    sections: [
      {
        heading: "The standard positions",
        body: [
          "In an eight-team bracket the first-round pairings are 1 v 8, 4 v 5, 3 v 6, 2 v 7 — in that order down the sheet. Seeds 1 and 2 are in opposite halves, 1 and 4 in opposite quarters, and so on.",
          "The property this produces: assuming no upsets, the quarter-finals are 1v8, 2v7, 3v6, 4v5; the semi-finals are 1v4 and 2v3; and the final is 1v2. Every round is the best remaining against the worst remaining.",
        ],
      },
      {
        heading: "Where byes go",
        body: [
          "A bracket holds a power of two and entry lists rarely are one. The difference is made up with byes, and they go to the top seeds — seed 1 first, then 2, then 3.",
          "This is not just convention. It is the only placement that does not distort the draw: a bye handed to a random position gives a free round to whoever happened to be next to it, which is a bigger advantage than any seeding decision you might make elsewhere.",
          "So twelve teams in a bracket of sixteen means the top four seeds skip round one, and the other eight play for the right to meet them.",
        ],
      },
      {
        heading: "Seeding from a group stage",
        body: [
          "When the bracket is fed by groups, the seeding is already decided: group winners are seeded above runners-up, and the layout puts winners against runners-up from different groups.",
          "The thing to get right is that two teams from the same group should not meet again in the first knockout round — they have just played each other. The standard cross-pairing (winner of A against runner-up of B, winner of B against runner-up of A) handles this for an even number of groups.",
          "It breaks down when the bracket is topped up with the best third-placed teams, because which groups those come from is not known until the groups have been played, and the bracket is drawn before that. Competitions that care about this — the Euros, for one — solve it with a published table of every possible combination.",
        ],
      },
      {
        heading: "When not to seed",
        body: [
          "When you have no basis for it. Seeding from a guess is worse than a random draw, because it looks authoritative and it is not. If it is the first time these teams have met, draw at random and say so.",
        ],
      },
    ],
    faq: [
      {
        q: "What are the first-round pairings for 16 teams?",
        a: "1v16, 8v9, 5v12, 4v13, 3v14, 6v11, 7v10, 2v15 — which puts 1 and 2 in opposite halves and pairs the best remaining against the worst remaining in every round.",
      },
      {
        q: "Who gets the byes?",
        a: "The top seeds, in order. It is the only placement that does not hand a free round to an arbitrary team.",
      },
      {
        q: "Should I seed a fun tournament?",
        a: "Usually not. A random draw is fairer than a seeding nobody can justify, and it avoids the conversation about why somebody was seeded where they were.",
      },
    ],
    related: [
      "single-elimination-bracket-generator",
      "16-team-single-elimination-bracket",
      "guide/single-vs-double-elimination",
      "badminton-tournament-draw",
    ],
  },

  {
    slug: "guide/byes-in-a-round-robin",
    kind: "guide",
    title: "Byes in a Round Robin — Handling an Odd Number of Teams",
    h1: "Byes in a round robin",
    description:
      "An odd number of teams means one sits out each round. How the rotation works, why it takes an extra round, and why a bye is not a match.",
    lede:
      "With an odd number of teams there is no way to pair everybody at once, so one team sits out each round. Over the tournament each team gets exactly one bye, and the round robin takes one more round than an even field of the same size.",
    facts: [
      { label: "Even field", value: "teams − 1 rounds", note: "Everybody plays every round." },
      { label: "Odd field", value: "teams rounds", note: "One team sits out each round." },
      { label: "Matches", value: "teams × (teams − 1) ÷ 2", note: "The same either way." },
    ],
    sections: [
      {
        heading: "The rotation",
        body: [
          "The standard method is to add a phantom team — call it \"bye\" — making the field even, and then run the normal circle rotation. Whoever is drawn against the phantom that round sits out.",
          "Because the rotation moves every team through every position, each team meets the phantom exactly once, which is why everybody gets exactly one bye and no one gets two.",
        ],
      },
      {
        heading: "Why the fixture count does not change",
        body: [
          "A bye is not a match. Seven teams still play 21 matches — every pair once — and every team still plays six. The only thing that changes is that it takes seven rounds instead of six, because one of the seven slots in each round is empty.",
          "So an odd field costs you time, not fairness. Everybody plays the same number of matches against the same opponents.",
        ],
      },
      {
        heading: "A round robin bye is not a bracket bye and not a Swiss bye",
        body: [
          "Three different things share the word. In a round robin, a bye is a rest — it scores nothing and affects nothing, because everybody gets one.",
          "In a bracket it is a free pass to the next round, and it scores nothing because the round itself was skipped.",
          "In a Swiss it takes the points for a win, because not everybody gets one and the team that did should not be punished in the table for having been the odd one out. Same word, three meanings, and the difference matters when you are looking at why a table came out the way it did.",
        ],
      },
      {
        heading: "Scheduling around it",
        body: [
          "The practical annoyance is that the team sitting out is standing around. If you have a spare court, schedule their bye round early or late rather than in the middle, or run a two-leg format so the gaps are spread out.",
        ],
      },
    ],
    faq: [
      {
        q: "How many rounds for 7 teams?",
        a: "Seven — one more than the six an eight-team field would need — because one team sits out each round.",
      },
      {
        q: "Does a bye count as a win?",
        a: "Not in a round robin. Everybody gets exactly one, so scoring it would change nothing except the numbers. In a Swiss it does count as a win.",
      },
      {
        q: "Should I add a filler team to make it even?",
        a: "No. A phantom team is exactly what the rotation already does internally, and adding a real filler team distorts the table.",
      },
    ],
    related: [
      "round-robin-generator",
      "7-team-round-robin-schedule",
      "5-team-round-robin-schedule",
      "guide/how-swiss-pairing-works",
    ],
  },

  {
    slug: "guide/group-stage-vs-swiss",
    kind: "guide",
    title: "Group Stage vs Swiss — Which Format for Your Tournament",
    h1: "Group stage or Swiss?",
    description:
      "Groups guarantee a fixed number of matches and a clean bracket. Swiss handles bigger fields in less time. A decision table and the trade-offs.",
    lede:
      "Groups if the field is small enough to split into pools of four or five and you want a clean bracket afterwards. Swiss if the field is too big for that and you still want nobody knocked out.",
    facts: [
      { label: "Groups suit", value: "8–32 teams", note: "Pools of four or five, then a playoff." },
      { label: "Swiss suits", value: "16+ teams", note: "Where a round robin would be too long." },
      { label: "Groups give", value: "A fixed schedule", note: "Publishable in advance." },
      { label: "Swiss gives", value: "Fewer matches", note: "For the same field size." },
    ],
    sections: [
      {
        heading: "The case for groups",
        body: [
          "You can publish the whole schedule in advance. Every team knows when they play and against whom before they arrive, which matters when people are travelling or when courts are booked by the hour.",
          "It produces a clean bracket. Two from each of four groups is eight teams, which is a quarter-final, which is a tidy afternoon.",
          "And it is what everybody already understands. Nobody needs the format explained.",
        ],
      },
      {
        heading: "The case for Swiss",
        body: [
          "It scales. Thirty-two teams in groups of four is eight groups and 48 group matches; thirty-two teams in a Swiss is five rounds of sixteen, which is 80 matches — but each team plays five rather than three, and you do not need eight groups' worth of separate tables.",
          "More importantly, it produces a meaningful ranking of the whole field rather than eight separate small ones. If you need to know who finished 12th, groups cannot tell you and Swiss can.",
          "And it self-balances: a team that wins early meets harder opponents, so the record at the end means something in a way a group record does not when one group was much stronger than another.",
        ],
      },
      {
        heading: "The group-of-death problem",
        body: [
          "The main weakness of groups is that the draw decides a lot. Four strong teams in one group means two of them go home while a weaker team advances from elsewhere. Everybody accepts this in football and it is still unfair.",
          "Swiss does not have this problem by construction, because there is no draw to be unlucky in — you are paired against whoever is on your record.",
        ],
      },
      {
        heading: "The Swiss weaknesses",
        body: [
          "You cannot publish the schedule. Only round one and the round count, which is a real problem for a tournament where people want to know when they are playing.",
          "It needs a round to finish before the next can be paired, so a slow court holds up the whole field. Groups do not care — every match in a group can be played whenever a court is free.",
          "And it is less familiar. You will explain it.",
        ],
      },
      {
        heading: "The short answer",
        body: [
          "Under about sixteen teams, use groups. Over about thirty-two, use Swiss. In between, use groups if the schedule needs publishing and Swiss if the ranking needs to be meaningful.",
          "And in both cases, finish with a small playoff. A Swiss table can leave two teams level on everything, and a group stage that ends without a final feels like it stopped rather than finished.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I run groups and then Swiss?",
        a: "Yes — stages are an ordered list and any order works. It is unusual but there is nothing stopping it.",
      },
      {
        q: "Which is faster?",
        a: "Groups, usually, for a small field: three group matches each beats five Swiss rounds. Swiss wins for large fields, where the alternative is a very large number of groups.",
      },
    ],
    related: [
      "group-stage-knockout-generator",
      "swiss-tournament-generator",
      "multi-stage-tournament-builder",
      "guide/how-many-swiss-rounds",
    ],
  },

  {
    slug: "guide/single-vs-double-elimination",
    kind: "guide",
    title: "Single vs Double Elimination — Which Bracket to Run",
    h1: "Single or double elimination?",
    description:
      "Double elimination costs about twice the matches and almost never produces a winner nobody believes in. When the extra time is worth it.",
    lede:
      "Single elimination is the shortest tournament there is. Double elimination costs roughly twice the matches and buys a much more credible winner. The decision is almost entirely about how much court time you have.",
    facts: [
      { label: "Single elim", value: "teams − 1 matches", note: "Plus a third-place match." },
      { label: "Double elim", value: "≈ 2 × teams − 2", note: "Everybody but the winner loses twice." },
      { label: "8 teams", value: "8 vs 14 matches" },
      { label: "16 teams", value: "16 vs 30 matches" },
    ],
    sections: [
      {
        heading: "What single elimination gets wrong",
        body: [
          "One bad match ends a tournament. If the two best teams are drawn against each other in round one, one of them finishes last-equal, and the bracket has produced a result that nobody watching believes.",
          "Seeding reduces this but cannot remove it, because seeding is only as good as the information behind it, and in most one-day tournaments there is none.",
          "It is also a poor day out. Half the field has finished after one match.",
        ],
      },
      {
        heading: "What double elimination costs",
        body: [
          "About twice the matches, which on two courts at 25 minutes a slot is the difference between a morning and most of a day. That is the whole argument against it.",
          "It is also harder to explain and harder to schedule, because the losers bracket has to stay in step with the winners bracket and a delay in one holds up the other.",
        ],
      },
      {
        heading: "The middle option nobody considers",
        body: [
          "Groups then a single-elimination playoff usually beats both. It guarantees everybody three matches, the group stage parallelises perfectly across courts, and the bracket at the end is short because only the top teams are in it.",
          "Eight teams in two groups of four then semi-finals is 16 matches — the same as an eight-team double elimination minus two — and it gives every team three guaranteed games instead of two.",
          "Double elimination is the right answer mainly when the field cannot be split into groups sensibly, or when the convention of the sport expects it, which in esports it does.",
        ],
      },
    ],
    faq: [
      {
        q: "How much longer does double elimination take?",
        a: "About twice as long for the same field. Eight teams is 14 matches instead of 8; sixteen teams is 30 instead of 16.",
      },
      {
        q: "Is there a bracket reset in the grand final?",
        a: "Some rulebooks give the winners-bracket finalist the advantage of needing to be beaten twice. Whistle.day plays one grand final.",
      },
      {
        q: "What about groups then a knockout?",
        a: "Usually the best answer for a one-day tournament — more guaranteed matches than double elimination, in less time.",
      },
    ],
    related: [
      "double-elimination-bracket-generator",
      "single-elimination-bracket-generator",
      "group-stage-knockout-generator",
      "esports-tournament-bracket",
    ],
  },

  {
    slug: "guide/how-many-courts-do-i-need",
    kind: "guide",
    title: "How Many Courts Do I Need? Tournament Time Estimates",
    h1: "How many courts do I need?",
    description:
      "Work out court requirements from your team count and format. Why round robins parallelise and knockouts do not, with worked numbers.",
    lede:
      "Take the number of matches, divide by the number of courts, multiply by how long a match takes including changeover. That is the floor — and for a knockout it is an optimistic one, because each round has to wait for the one before it.",
    generator: { preset: "groups" },
    facts: [
      { label: "Rule of thumb", value: "matches ÷ courts × 25 min" },
      { label: "Round robins", value: "Parallelise almost perfectly" },
      { label: "Knockouts", value: "Stop benefiting past teams ÷ 2 courts" },
    ],
    sections: [
      {
        heading: "The arithmetic",
        body: [
          "Twelve teams in three groups of four is 18 group matches plus a playoff. On two courts at 25 minutes a slot that is about four hours; on four courts, about two and a half.",
          "The 25 minutes is not the match — it is the match plus getting the next pair on, finding the referee and writing the score down. Estimating on match length alone is the single most common way a tournament overruns.",
        ],
      },
      {
        heading: "Round robins parallelise, knockouts do not",
        body: [
          "In a round robin any match can be played whenever a court is free, so four courts really is about a quarter of the time of one. Doubling the courts genuinely halves the day.",
          "A knockout cannot do this. The quarter-finals cannot start until the round of sixteen has finished, so the last few rounds run on fewer and fewer courts however many you have. An eight-team knockout on eight courts still takes three rounds — you cannot go faster than the tree.",
          "The practical consequence: more courts than half your team count is wasted on a knockout, and never wasted on a round robin.",
        ],
      },
      {
        heading: "The other constraints",
        body: [
          "Referees, usually. Two courts with one qualified referee is one court. Count officials before you count courts.",
          "Scoring capacity. If one person is entering all the results from a phone, four courts finishing at once is a queue. This is less of a problem than it used to be, but it is real.",
          "And the hall booking, which is the constraint that actually decides it. Work backwards from when you have to be out.",
        ],
      },
      {
        heading: "A shortcut",
        body: [
          "Rather than calculating, enter your teams and courts in the wizard and read the estimate off the format screen. It quotes matches and a rough duration for every format against the numbers you actually entered, which is faster than doing this on paper and less likely to be wrong.",
        ],
      },
    ],
    faq: [
      {
        q: "How long does a tournament match take?",
        a: "Allow 25 minutes per slot for most indoor court sports — the match plus getting the next pair on. Adjust for your sport and check it against last year.",
      },
      {
        q: "Do more courts always help?",
        a: "For a round robin or a group stage, yes, almost linearly. For a knockout, no — past half your team count the extra courts sit empty.",
      },
    ],
    related: [
      "multi-court-tournament-scheduler",
      "guide/how-to-run-a-one-day-tournament",
      "tournament-generator",
    ],
  },

  {
    slug: "guide/how-to-run-a-one-day-tournament",
    kind: "guide",
    title: "How to Run a One-Day Tournament — A Practical Walkthrough",
    h1: "How to run a one-day tournament",
    description:
      "Everything from picking a format to the trophy presentation: timings, court allocation, results, and the things that actually go wrong.",
    lede:
      "The format is the easy decision. What makes or breaks a one-day tournament is the schedule, who enters the results, and having somewhere everybody can see what is happening without asking you.",
    sections: [
      {
        heading: "Work backwards from when you have to be out",
        body: [
          "The hall booking is the real constraint, not the format. Take your finish time, subtract the presentation, subtract a buffer of at least half an hour, and that is the tournament.",
          "Then divide: matches available equals hours × courts × slots per hour. At 25 minutes a slot, two courts for five hours is 24 matches. That number decides your format, not the other way round.",
        ],
      },
      {
        heading: "Pick a format that guarantees matches",
        body: [
          "For most one-day tournaments, groups then a playoff. It guarantees every team three matches before anybody is knocked out, parallelises well, and still ends with a final.",
          "Avoid a straight knockout unless the day is genuinely short. Half your entrants having driven over to play once is how you lose them for next year.",
          "If the field is large, Swiss. If it is small and the morning is long, everyone plays everyone.",
        ],
      },
      {
        heading: "Build in slack you will need",
        body: [
          "Something will overrun. A five-set match, a first-aid stop, a team stuck in traffic. If your schedule has no slack, the overrun compounds all day and you finish an hour late.",
          "The usual fix is a scheduled gap in the middle — lunch, or a break between the group stage and the playoff — which absorbs whatever the morning lost. It also gives you the moment to redraw if you have to.",
        ],
      },
      {
        heading: "Decide who enters results, before the day",
        body: [
          "The most common failure is not the format, it is that results pile up on scraps of paper at a desk and the tables are an hour behind by lunchtime. By then nobody knows who is qualifying and the playoff draw is late.",
          "Either one person enters everything from a phone as it comes in, or each court reports to a single point. What does not work is everyone assuming somebody else has it.",
        ],
      },
      {
        heading: "Put it on a wall",
        body: [
          "The single biggest reduction in questions asked of the organiser is a screen showing what is live, the tables and what is on next. Every question somebody does not have to ask you is thirty seconds you get back, and over a day that is most of an hour.",
          "A QR code on the door doing the same job for phones is the second biggest.",
        ],
      },
      {
        heading: "The tiebreakers, before you need them",
        body: [
          "Decide the order — head-to-head or score difference first — and publish it with the fixtures. Deciding it after two teams have finished level is how a tournament ends in an argument, because whichever you pick will look like it was picked to favour somebody.",
        ],
      },
      {
        heading: "The last half hour",
        body: [
          "Have the trophies out and the results checked before the final finishes. The presentation is what people remember and it is invariably rushed, because the final ran over and the caretaker wants the hall.",
        ],
      },
    ],
    faq: [
      {
        q: "What format is best for a one-day tournament?",
        a: "Groups then a playoff, for almost any field between eight and thirty-two teams. It guarantees matches, uses courts well, and ends with a final.",
      },
      {
        q: "How much time should I leave as slack?",
        a: "At least half an hour, and preferably a scheduled break in the middle that can absorb an overrunning morning.",
      },
      {
        q: "What goes wrong most often?",
        a: "Results not being entered as they happen. By lunchtime nobody knows the state of the tables and the playoff draw is late.",
      },
    ],
    related: [
      "guide/how-many-courts-do-i-need",
      "group-stage-knockout-generator",
      "run-a-tournament-from-your-phone",
      "tournament-projector-display",
    ],
  },
];
