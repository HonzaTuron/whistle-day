/**
 * Whistle.day against the tools people are already using.
 *
 * Two rules for everything on these pages.
 *
 * The first is that every claim about Whistle.day has to be true today, including
 * the unflattering ones — no registration, no check-in, no payments, no
 * ratings, no bracket reset. A comparison page that only lists wins is an
 * advert, and the reader can tell within a paragraph.
 *
 * The second is that claims about other people's products are kept structural
 * and general. Feature lists and prices change without telling us, and a
 * comparison table that is a year out of date is worse than not having one —
 * so these describe what a category of tool is shaped like rather than
 * asserting what a competitor's current tier includes, and they say out loud
 * that the reader should check.
 */

import type { Page } from "./types";

/** Repeated at the foot of every comparison, because it is always true. */
const CHECK_FOR_YOURSELF = {
  heading: "Check the current details yourself",
  body: [
    "Other products change their tiers, their limits and their prices without telling anybody, and this page is maintained by the people who made one of the things on it. Everything above about Whistle.day is accurate today; everything about anybody else is a description of the shape of the tool rather than a claim about what is in their current plan.",
    "If a specific limit matters to your decision, check it on their site before you decide.",
  ],
};

export const COMPARISON_PAGES: Page[] = [
  {
    slug: "vs/challonge",
    kind: "comparison",
    title: "Whistle.day vs Challonge — Free Alternative, No Ads, No Account",
    h1: "Whistle.day vs Challonge",
    description:
      "A free Challonge alternative with no ads and no signup, built to run the day rather than just draw the bracket. An honest comparison.",
    lede:
      "Challonge is the default answer for \"free bracket maker\" and it is good at that job. Whistle.day is aimed at the four hours after the bracket is drawn — courts, live scores, a projector in the hall — and it does not put ads or a signup wall in front of any of it.",
    sections: [
      {
        heading: "Where Whistle.day is different",
        body: [
          "No account to start. The wizard works immediately; an email can be attached afterwards if you want to open the tournament on another device.",
          "No ads anywhere, including on the public views. This is the reason most people go looking for a Challonge alternative in the first place.",
          "A projector view built for a hall. A screen that rotates through live matches, group tables, the bracket and each court's schedule, sized to be read from across a room, that nobody has to stand and drive.",
          "Court scheduling. Matches are assigned to courts and times, and each court's upcoming matches go on the wall — which is the part of running a physical tournament that a bracket image does not help with at all.",
          "Staged formats that seed themselves. Groups feeding a playoff, with the bracket drawn in advance and filling itself in as each group's table becomes final.",
          "A phone per court. A referee scans a QR code and runs their own court — no account, no name typed into a form — so results arrive from the courts rather than queueing at one person's desk.",
          "It keeps scoring with no signal. Results queue on the device and send themselves when the wifi comes back, which in a sports hall is not a hypothetical.",
        ],
      },
      {
        heading: "Where Challonge is stronger",
        body: [
          "Ubiquity. It is the format everybody in online competitive gaming already knows, and a Challonge link needs no explanation.",
          "Participant self-service. Challonge's model has participants signing up and reporting their own matches, which is the right shape for an online tournament run across time zones. Whistle.day assumes somebody is running the day and entering results, which is the right shape for a hall and the wrong shape for a Discord.",
          "An established API and integrations, and years of accumulated tooling around it.",
        ],
      },
      {
        heading: "What Whistle.day does not have",
        body: [
          "Player registration and check-in. Teams are entered by the organiser; there is no sign-up form.",
          "Self-reported scores. Results are entered by whoever is running it.",
          "Payments, ratings, or a public directory of tournaments.",
          "A bracket reset in a double-elimination grand final.",
        ],
      },
      {
        heading: "Which to use",
        body: [
          "If your tournament is online and the participants report their own results, use Challonge. If your tournament is in a building with courts and a screen on the wall, Whistle.day was built for that day specifically.",
        ],
      },
      CHECK_FOR_YOURSELF,
    ],
    faq: [
      {
        q: "Is Whistle.day free like Challonge?",
        a: "Yes, and without ads. The only paid feature is sponsor logos on the projector's closing panel, which is for clubs who sell that space.",
      },
      {
        q: "Can I import a Challonge bracket?",
        a: "No. There is no import from any other tool at the moment.",
      },
      {
        q: "Does Whistle.day have an API?",
        a: "Yes — it is a PocketBase backend with a documented REST API, plus a public read-only endpoint for the display view.",
      },
    ],
    related: [
      "alternatives/free-tournament-bracket-software",
      "vs/toornament",
      "esports-tournament-bracket",
      "tournament-generator",
    ],
  },

  {
    slug: "vs/toornament",
    kind: "comparison",
    title: "Whistle.day vs Toornament — Simpler, Free, Built for a Hall",
    h1: "Whistle.day vs Toornament",
    description:
      "Toornament is a full esports platform with registration and permissions. Whistle.day is a smaller tool for running a physical tournament day.",
    lede:
      "Toornament is a platform: registrations, permissions, brackets, an API, and the administrative apparatus a season or a circuit needs. Whistle.day is a single-day tool with no administrative apparatus at all.",
    sections: [
      {
        heading: "Different scopes, not different quality",
        body: [
          "If you are running a competition with a registration period, an entry list to approve, staff with different permissions and a public tournament page, Toornament is built for that and Whistle.day is not.",
          "If you are running a hall on Saturday, most of that machinery is overhead — and setting it up is the thing that stops somebody using proper software at all and going back to a spreadsheet.",
        ],
      },
      {
        heading: "Where Whistle.day is different",
        body: [
          "Setup is four questions on a phone: a name, the teams, the courts, and how long the day should be. There is nothing to configure before the tournament exists.",
          "The format screen quotes matches and hours rather than asking about pool counts and advancement rules, which are answers to a question the organiser has not asked yet.",
          "The projector view. A self-rotating screen for a hall, with court schedules, live scores and tables — the physical-venue half that an online-first platform does not need to solve.",
          "No account before you start.",
        ],
      },
      {
        heading: "What Whistle.day does not have",
        body: [
          "Registration, check-in, participant accounts, or role-based staff permissions.",
          "A public tournament directory or organiser profile pages.",
          "Match scheduling across days, seasons, or multiple linked events.",
        ],
      },
      CHECK_FOR_YOURSELF,
    ],
    faq: [
      {
        q: "Can Whistle.day handle a multi-day tournament?",
        a: "Yes in the sense that nothing expires, but there is no calendar or day-by-day scheduling — matches carry a time and that is it.",
      },
      {
        q: "Can players register themselves?",
        a: "No. The organiser enters the teams.",
      },
    ],
    related: ["vs/challonge", "vs/battlefy", "alternatives/free-tournament-bracket-software"],
  },

  {
    slug: "vs/battlefy",
    kind: "comparison",
    title: "Whistle.day vs Battlefy — Esports Platform or a Tool for the Room",
    h1: "Whistle.day vs Battlefy",
    description:
      "Battlefy hosts online esports competitions end to end. Whistle.day runs a tournament happening in a room, with a screen on the wall.",
    lede:
      "Battlefy is an esports hosting platform — registration, brackets, match reporting, the public page. Whistle.day runs the day in front of you, including a LAN event, and stops well short of being a platform.",
    sections: [
      {
        heading: "Online tournaments vs tournaments in a room",
        body: [
          "The defining question is who enters the results. On an online platform the players do, because there is no one else there. In a hall or at a LAN somebody is running it, and the software's job is to make that person's afternoon quick rather than to coordinate strangers.",
          "Whistle.day is built entirely around the second case: a phone in somebody's hand, results entered as they come back from the stations, and a screen showing everybody what is happening.",
        ],
      },
      {
        heading: "Where Whistle.day is useful for esports",
        body: [
          "A LAN or a college event, where the tournament is physically in a room with a projector. Double elimination is a first-class format, and the display view works as a full-screen source for a stream because it is designed to be read at a distance anyway.",
          "It is free with no ads on the public views, which for a student event is often the whole decision.",
        ],
      },
      {
        heading: "What Whistle.day does not have",
        body: [
          "Player registration, check-in, team invites, or self-reported match results.",
          "Game integrations, anti-cheat hooks, or prize distribution.",
          "A bracket reset in the grand final.",
        ],
      },
      CHECK_FOR_YOURSELF,
    ],
    faq: [
      {
        q: "Can I use Whistle.day for an online tournament?",
        a: "You can, but somebody has to enter the results centrally. There is no self-reporting.",
      },
      {
        q: "Does it work as a stream overlay?",
        a: "The display view is a full-screen web page designed to be read at a distance, which captures cleanly as a source. There is no dedicated overlay mode with transparency.",
      },
    ],
    related: ["vs/challonge", "esports-tournament-bracket", "double-elimination-bracket-generator"],
  },

  {
    slug: "vs/brackethq",
    kind: "comparison",
    title: "Whistle.day vs Bracket HQ — Beyond Drawing the Bracket",
    h1: "Whistle.day vs Bracket HQ",
    description:
      "Bracket HQ makes and shares a bracket quickly. Whistle.day draws it too, then schedules courts, takes scores and puts it on a screen.",
    lede:
      "Bracket HQ is a fast, clean bracket maker — you want a bracket, you get a bracket. Whistle.day starts there and keeps going into the part where the tournament is actually played.",
    sections: [
      {
        heading: "If the bracket is all you need",
        body: [
          "Then a dedicated bracket maker is the right tool and Whistle.day is more than you need. Genuinely: if the job is to draw sixteen names into a knockout and send somebody a link, use the simplest thing that does it.",
        ],
      },
      {
        heading: "What Whistle.day adds when it is a real tournament day",
        body: [
          "Group stages that feed a playoff, with the bracket seeded from the final tables automatically.",
          "Court and time assignment, with a warning when a team is double-booked.",
          "Live tables recomputed after every result, with the tiebreaker that separated a tie printed underneath.",
          "A projector view for the hall and a phone view for everybody else, both from a QR code.",
          "Swiss, which draws its own next round when the previous one finishes.",
        ],
      },
      CHECK_FOR_YOURSELF,
    ],
    faq: [
      {
        q: "Is Whistle.day harder to set up?",
        a: "Marginally — it asks for courts and how long the day should be as well as the teams. That is four questions rather than two.",
      },
    ],
    related: [
      "single-elimination-bracket-generator",
      "alternatives/free-tournament-bracket-software",
      "tournament-generator",
    ],
  },

  {
    slug: "vs/tournamentsoftware-com",
    kind: "comparison",
    title: "Whistle.day vs Tournament Software — For Club Days, Not Federations",
    h1: "Whistle.day vs tournamentsoftware.com",
    description:
      "Tournament Software runs federation-level racket sport competitions with rankings and licences. Whistle.day runs a club day off a phone.",
    lede:
      "Tournamentsoftware.com is the incumbent for badminton and other racket sports, and it is built around what a national federation needs: member licences, rankings, sanctioned events, entry systems. Whistle.day is built around what a club Saturday needs.",
    sections: [
      {
        heading: "When you need the incumbent",
        body: [
          "If the event is sanctioned, if results feed a national ranking, or if entries come through a federation membership system, you almost certainly have to use whatever the federation mandates. That is not a software comparison, it is a rule.",
        ],
      },
      {
        heading: "When Whistle.day is the better tool",
        body: [
          "A club tournament, a school event, a corporate day, an internal ladder — anything where nobody is checking a licence number. Setup is four questions rather than an event configuration, and it runs entirely from a phone.",
          "The draw sheet goes on a screen in the hall and fills itself in as the desk enters results, which saves the walk over to write a name into a box.",
        ],
      },
      {
        heading: "What Whistle.day does not have",
        body: [
          "Member licences, national rankings, sanctioning, or entry systems tied to a federation.",
          "Multi-event days with entries across singles, doubles and mixed in one entry form — each event is a separate tournament.",
          "Consolation draws and plate competitions.",
        ],
      },
      CHECK_FOR_YOURSELF,
    ],
    faq: [
      {
        q: "Can I run several events on the same day?",
        a: "Yes, as separate tournaments, each with its own link and screen. There is no combined entry form across them.",
      },
      {
        q: "Does it produce ranking points?",
        a: "No. There is no rating or ranking system.",
      },
    ],
    related: ["badminton-tournament-draw", "table-tennis-tournament-generator", "vs/rankedin"],
  },

  {
    slug: "vs/rankedin",
    kind: "comparison",
    title: "Whistle.day vs Rankedin — Club Platform or One-Day Tool",
    h1: "Whistle.day vs Rankedin",
    description:
      "Rankedin is a club and league platform for racket sports with player profiles and rankings. Whistle.day is a free tool for running one day.",
    lede:
      "Rankedin is built around players having accounts, profiles and a ranking that follows them between events. Whistle.day has no concept of a player who exists outside the tournament they are entered in.",
    sections: [
      {
        heading: "The difference is whether players have accounts",
        body: [
          "On a club platform, a player is a persistent identity — a profile, a history, a rating. That is what makes leagues and ladders work over a season, and it is genuinely valuable if you run a club.",
          "In Whistle.day a team is a row in one tournament. Nobody signs up, nothing follows them to the next event, and there is no rating. That is a real limitation and it is also why the wizard takes a minute.",
        ],
      },
      {
        heading: "Where Whistle.day fits",
        body: [
          "One-off events, mixed-ability club days, corporate tournaments and anything where making twenty people create accounts is the thing that would kill it.",
          "And the hall screen: a self-rotating projector view with court schedules, live scores and tables, which is a physical-venue feature rather than a club-management one.",
        ],
      },
      {
        heading: "What Whistle.day does not have",
        body: [
          "Player profiles, ratings, rankings, or history across tournaments.",
          "League seasons, club membership, or court booking.",
        ],
      },
      CHECK_FOR_YOURSELF,
    ],
    faq: [
      {
        q: "Do players need an account?",
        a: "No. Only the organiser has one, and it is created in the background.",
      },
      {
        q: "Can I run a season-long league?",
        a: "A league is a round-robin group with no playoff, so mechanically yes. There is no season or division structure above it.",
      },
    ],
    related: ["padel-tournament-generator", "vs/tournamentsoftware-com", "league-table-generator"],
  },

  {
    slug: "vs/tournify",
    kind: "comparison",
    title: "Whistle.day vs Tournify — Two Tools for the Same Kind of Day",
    h1: "Whistle.day vs Tournify",
    description:
      "Both run one-day tournaments with a live screen for the venue. The differences are pricing, format flexibility and how setup works.",
    lede:
      "Tournify and Whistle.day are aimed at the same day: a one-day tournament in a venue, with a screen showing what is happening. This is the closest comparison on this list, and the differences are in the details.",
    sections: [
      {
        heading: "Where Whistle.day is different",
        body: [
          "Free for everything except sponsor logos on the projector's closing panel. There is no team cap, no tournament cap and no feature behind a tier.",
          "Stages in any order, with later stages seeded from earlier ones' tables — groups then Swiss then a playoff is expressible, not just groups then a playoff.",
          "Swiss as a first-class format, with the next round drawing itself when the previous one finishes.",
          "Setup asks how long the day should be rather than how many groups you want, and quotes matches and hours against the teams and courts you entered.",
          "Open source, and self-hostable — the backend is a single Go binary.",
        ],
      },
      {
        heading: "Where you should look at Tournify",
        body: [
          "It is a mature product with years of one-day tournaments behind it, and maturity is worth something on the day. Whistle.day is new; the smoke suite plays a full tournament out end to end on every change, but that is not the same as a thousand Saturdays.",
          "If you need something specific — a particular sport's scoring rules, a particular kind of export — check whether it is there before switching.",
        ],
      },
      CHECK_FOR_YOURSELF,
    ],
    faq: [
      {
        q: "Is Whistle.day really free with no team limit?",
        a: "Yes. The only paid thing is sponsor slots on the projector's closing panel.",
      },
      {
        q: "Can I self-host it?",
        a: "Yes. The backend is PocketBase used as a Go framework and compiles to one binary.",
      },
    ],
    related: [
      "alternatives/free-tournament-bracket-software",
      "alternatives/open-source-tournament-software",
      "tournament-projector-display",
    ],
  },

  {
    slug: "alternatives/free-tournament-bracket-software",
    kind: "roundup",
    title: "Free Tournament Bracket Software — The Honest Roundup",
    h1: "Free tournament bracket software",
    description:
      "What the free tournament tools are actually good at, where each one fits, and which to pick for an online event or a day in a hall.",
    lede:
      "Most of these tools are free at the size an amateur tournament runs at. The useful question is not which is cheapest but which is shaped like your day — and the biggest fork is whether the tournament is online or in a room.",
    sections: [
      {
        heading: "The first question: who enters the results?",
        body: [
          "If the players do, because the tournament is spread across the internet, you want a platform with participant accounts and match reporting — Challonge, Toornament and Battlefy are all built this way.",
          "If one person does, because everybody is in the same building, you want something that makes that person's afternoon fast: courts, a scoring screen that works on a phone, and a display for the room. That is a different tool, and there are far fewer of them.",
        ],
      },
      {
        heading: "The second question: is a bracket the whole job?",
        body: [
          "Sometimes it genuinely is. You want sixteen names in a knockout and a link to share — a dedicated bracket maker like Bracket HQ does that in under a minute and anything more is overhead.",
          "It stops being the whole job the moment you have group stages feeding a playoff, more than one court running at once, or a table that people will argue about.",
        ],
      },
      {
        heading: "The third question: what does free actually mean here",
        body: [
          "Free with ads on the pages your participants see. Free up to a team cap. Free but the display feature is paid. Free for one tournament at a time. All four are common, and the limit tends to be discovered on the morning of the event.",
          "Whistle.day's answer: everything is free with no cap and no ads, and the only paid feature is sponsor logos on the projector's closing panel, which exists for clubs who sell that space.",
        ],
      },
      {
        heading: "Where Whistle.day fits",
        body: [
          "A tournament in a building, run from a phone, with a screen on the wall. Groups, knockouts, double elimination, Swiss, and stages in any order. Free with no account, no ads and no cap.",
          "Not the right choice if you need player registration, self-reported scores, ratings, or a public tournament directory — none of which exist.",
        ],
      },
      CHECK_FOR_YOURSELF,
    ],
    faq: [
      {
        q: "What is the best free bracket maker?",
        a: "For an online tournament where players report their own results, Challonge. For a day in a hall with courts and a screen, Whistle.day. For just a bracket and nothing else, any dedicated bracket maker.",
      },
      {
        q: "Are any of them genuinely unlimited?",
        a: "Whistle.day has no cap on teams or tournaments. Check the others' current limits before the day rather than during it.",
      },
    ],
    related: [
      "vs/challonge",
      "vs/tournify",
      "alternatives/open-source-tournament-software",
      "tournament-generator",
    ],
  },

  {
    slug: "alternatives/open-source-tournament-software",
    kind: "roundup",
    title: "Open Source Tournament Software — Self-Hosted and Free",
    h1: "Open source tournament software",
    description:
      "Self-hostable tournament software: what to look for, and how Whistle.day is built — one Go binary, PocketBase as a framework, no external services.",
    lede:
      "If you want to run tournament software you control — on a club's own server, or on a laptop in a hall with no internet at all — the thing that matters most is how many moving parts it has.",
    sections: [
      {
        heading: "What to look for in something self-hosted",
        body: [
          "One process rather than five. A tool that needs a database server, a cache, a queue and a web server is a tool that will be down when you need it and that nobody at the club can fix.",
          "A file-backed database, so the backup is a file you can copy.",
          "No dependency on an external service to render or compute anything, or the offline case is not really offline.",
        ],
      },
      {
        heading: "How Whistle.day is built",
        body: [
          "The backend is PocketBase used as a Go framework rather than as a downloaded binary — the tournament logic is compiled in, so `go build` produces one server with the generators, standings and slot resolution inside it. SQLite underneath, so the data is a file.",
          "The frontend is a static build served by the same process. There is nothing else to run: no separate database, no cache, no queue, no worker.",
          "The generators are Go and there is exactly one implementation of them. They used to be duplicated in TypeScript so the browser could preview a draw; that is gone, and preview goes through the server with a dry-run flag. Two implementations of bracket seeding is how brackets drift.",
        ],
      },
      {
        heading: "Running it yourself",
        body: [
          "Build the binary, run the migrations, serve. The whole test suite is `go vet`, the unit tests and a smoke run that boots a real server on a temporary data directory and plays an entire tournament through the REST API — a two-pool group stage, a playoff seeded from it, then a double elimination and a Swiss out to the end.",
          "That last part is the only way to find out whether a bracket deadlocks or a round ever fails to draw itself, which is why it is the check that matters.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I run it offline?",
        a: "You can run the server on a local machine and have phones on the same wifi reach it. It is not a progressive web app that works with no server at all.",
      },
      {
        q: "What is the licence?",
        a: "Open source. Check the repository for the current licence text before building on it.",
      },
      {
        q: "What does the backup look like?",
        a: "A SQLite data directory. Copy it.",
      },
    ],
    related: [
      "alternatives/free-tournament-bracket-software",
      "vs/tournify",
      "tournament-generator",
    ],
  },
];
