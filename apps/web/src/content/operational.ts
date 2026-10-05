/**
 * The pages about running the day rather than drawing it.
 *
 * A bracket maker gives you an image. The four hours after that — which match
 * is on which court, what is live, who won, what that did to the table — are
 * the part nobody else covers, and they are the part somebody searches for
 * once they have already tried a bracket maker and found it did not help.
 *
 * These pages describe screens that exist, in the terms the screens are
 * actually built in. Everything claimed here is in `apps/web/README.md`.
 */

import type { Page } from "./types";

export const OPERATIONAL_PAGES: Page[] = [
  {
    slug: "tournament-projector-display",
    kind: "operational",
    title: "Tournament Projector Display: A Screen That Runs Itself",
    h1: "Tournament display for a projector",
    description:
      "Put live scores, group tables and the bracket on a projector in your hall. It rotates itself, needs nobody driving it, and is free.",
    lede:
      "Open one link on a laptop, put it full screen on the projector, and walk away. It shows what is live, the tables, the bracket and what is on next, rotating on a timer, and it updates itself as results go in.",
    generator: { preset: "groups", teams: 12 },
    sections: [
      {
        heading: "Unattended is the whole design",
        body: [
          "Nobody stands at the laptop. The screen cycles its panels on a timer and the bar along the top fills over each one's dwell so the room can see it is about to change. If the organiser wants a particular panel up, such as \"put the pool B table back\", the segments in that bar are buttons, and clicking one jumps to it and restarts the dwell. Rotation carries on afterwards, so a screen nobody touches again goes back to being unattended.",
          "Panels with nothing in them are dropped rather than shown blank. A hall with no live match should not stare at an empty \"Now playing\" for fifteen seconds.",
        ],
      },
      {
        heading: "Light, not dark, and that is deliberate",
        body: [
          "A projector has no black: an unlit pixel is whatever the lamp leaks onto the wall, so under sports-hall lighting a dark scoreboard washes out to grey and takes its text with it, while a light one simply gets brighter. Light is therefore the default and dark is the one you have to ask for, which is the opposite of how this choice usually runs.",
          "Dark is the right answer for a room that has been dimmed for the finals. It is offered, with the reason attached, because the decision is made on a phone indoors where dark always looks better in the hand than it will on the wall.",
        ],
      },
      {
        heading: "Set up from the phone in your pocket",
        body: [
          "Which panels appear and in what order is one list on the organiser's screen, and every change saves as you make it. The wall is the preview: the server nudges it the moment the write lands, so somebody standing in front of the projector with a phone sees what a setting does rather than guessing and walking over.",
          "A rotation of one panel is a pinned screen. There is no separate mode to learn.",
        ],
      },
      {
        heading: "It survives the venue wifi",
        body: [
          "The screen is told when to re-read rather than polling for changes, so a point tapped at the side of a court is on the wall about a fifth of a second later. But a stream through a venue's wifi is not a thing to bet a tournament on, and its failure is the quiet one: the socket looks open and stops delivering. So there is a 60-second poll underneath it as well.",
          "On a failed request the last good screen stays up and is marked stale. A blank projector in a sports hall is worse than a slightly old one.",
        ],
      },
    ],
    faq: [
      {
        q: "What do I need to run it?",
        a: "Any laptop or smart TV with a browser, and the link. No account, no install, no extension.",
      },
      {
        q: "Does somebody have to operate it?",
        a: "No. It rotates on its own and updates itself. The organiser can jump to a panel from their phone if they want to.",
      },
      {
        q: "Can I put my club's colours on it?",
        a: "Yes: an accent colour and a logo. The accent is capped for contrast when it is used as text, so a pale club colour stays readable rather than disappearing into the background.",
      },
      {
        q: "Can I put sponsor logos on it?",
        a: "Yes, on the closing panel of the rotation. That is the one paid feature; everything else is free.",
      },
    ],
    related: [
      "live-tournament-standings-screen",
      "tournament-bracket-on-a-tv",
      "qr-code-tournament-results",
      "tournament-generator",
      "guide/how-to-find-sponsors-for-a-tournament",
    ],
  },

  {
    slug: "live-tournament-standings-screen",
    kind: "operational",
    title: "Live Tournament Standings Screen: Tables That Update Themselves",
    h1: "Live tournament standings screen",
    description:
      "Show live group tables and league standings on a screen in your venue. Rebuilt after every result, with tiebreakers explained. Free.",
    lede:
      "Group tables and league standings on a screen, rebuilt every time a result goes in, with the reason a tie was separated printed underneath the table that needed it.",
    generator: { preset: "everyone", teams: 8 },
    sections: [
      {
        heading: "Rebuilt from scratch, every time",
        body: [
          "Standings are recomputed from the fixtures rather than accumulated as results arrive. That is the slower way to do it and it is the only correct one: incremental accumulation is exactly where a corrected score produces a table that no longer matches its own fixtures.",
          "So a score fixed two hours later produces the table that would have existed if it had been right the first time, on the wall, within a second.",
        ],
      },
      {
        heading: "A tie is explained on the screen",
        body: [
          "When a table needed more than points to rank, the criteria that actually separated it are printed underneath it. \"Why are they above us\" is the question that starts arguments in a hall, and a table on a wall that cannot answer it is a table somebody will dispute at the presentation.",
          "Head-to-head is computed among the tied teams only, from the fixtures those teams played against each other, which is why it can separate three teams that are level with each other but not level with anybody else.",
        ],
      },
      {
        heading: "Qualification is marked",
        body: [
          "Teams in a position that goes through to the next stage are marked as such, and the mark only appears once the table is final. A provisional table never promotes anybody, on the screen or in the bracket.",
        ],
      },
    ],
    faq: [
      {
        q: "How quickly does the screen update?",
        a: "About a fifth of a second after the result is entered. The server tells the screen to re-read rather than the screen polling for changes.",
      },
      {
        q: "Can I show only one group?",
        a: "Yes: a screen can be scoped to one stage, one group or one court. That is the second screen by the door rather than the main wall.",
      },
    ],
    related: [
      "league-table-generator",
      "tournament-projector-display",
      "guide/group-stage-tiebreakers-explained",
    ],
  },

  {
    slug: "tournament-bracket-on-a-tv",
    kind: "operational",
    title: "Put a Tournament Bracket on a TV: Live and Self-Updating",
    h1: "Tournament bracket on a TV",
    description:
      "Show a live tournament bracket on a TV or big screen. It fills itself in as results come in, and needs nobody to drive it. Free.",
    lede:
      "Open the link on the TV's browser, or cast a laptop to it, and the bracket is on the screen, filling itself in as results are entered, with the rounds named by how far they are from the final.",
    generator: { preset: "knockout", teams: 16 },
    sections: [
      {
        heading: "Every cell is drawn, played or not",
        body: [
          "A bracket on a screen before the tournament starts is mostly empty, and the empty half is what people look at. Positions without a team carry the label the server wrote for them, \"Winner SF1\", \"1. A\", in italic grey, so the screen reads as a plan rather than as a grid of blanks. The client never invents those words; they come down with the data.",
        ],
      },
      {
        heading: "Rounds are named by distance from the end",
        body: [
          "The last round is the Final, the one before it the Semi-finals, and so on back. Naming them by how many fixtures they contain instead is the bug that labels a final round \"Semi-finals\" when there is a third-place match sharing it, which is why the round titles live in one shared file rather than in each screen.",
        ],
      },
      {
        heading: "Sized for distance",
        body: [
          "The whole screen is laid out in viewport units rather than pixels, so it fills a 1280×720 TV and a 1920×1080 projector the same way, and the type is sized to be read from the far end of a room rather than from a desk.",
        ],
      },
    ],
    faq: [
      {
        q: "Does it work on a smart TV browser?",
        a: "Yes, if the TV has a browser that can open a URL. Casting a laptop tab works too and tends to be less painful to type a link into.",
      },
      {
        q: "Can I show only the bracket and nothing else?",
        a: "Yes: a rotation with one panel in it is a pinned screen.",
      },
    ],
    related: [
      "tournament-projector-display",
      "single-elimination-bracket-generator",
      "16-team-single-elimination-bracket",
    ],
  },

  {
    slug: "qr-code-tournament-results",
    kind: "operational",
    title: "QR Code Tournament Results: Share the Draw With Everyone",
    h1: "QR code tournament results",
    description:
      "Every tournament gets a QR code that opens live results on a phone. Print it once, stick it on the door, stop being asked. Free.",
    lede:
      "Setting a tournament up ends with a link and a QR code. Print it, stick it by the door, and everybody in the building can see the fixtures, the tables and what is on next without coming to ask you.",
    generator: { preset: "groups", teams: 12 },
    sections: [
      {
        heading: "The phone view is not the projector view shrunk",
        body: [
          "They share almost nothing but data. A projector cycles panels on a timer, is driven by nobody most of the day, and is sized to be read across a hall. A phone has tabs, scrolls, and is held by one person looking for one specific thing, usually when their own team plays next.",
          "So they are separate screens rather than one responsive layout, because collapsing them would mean every layout rule carrying a \"which screen is this\" condition.",
        ],
      },
      {
        heading: "No account for anybody who scans it",
        body: [
          "The token in the URL is the only credential, and the endpoint behind it is public. Nobody who scans the code has to sign up, install anything or be added to a list.",
          "That also means the code is the access: anybody who has it can read the tournament. There is nothing private in it (fixtures, names and scores), but it is worth knowing before you post it publicly.",
        ],
      },
      {
        heading: "Two codes, and they do different jobs",
        body: [
          "One opens the phone view, for players and parents. The other opens the projector view, for whatever screen is in the room. They are separate tokens so that handing out the first does not hand out the ability to put something on the wall.",
        ],
      },
    ],
    faq: [
      {
        q: "Do people need the app?",
        a: "There is no app. The code opens a web page.",
      },
      {
        q: "Does the code change?",
        a: "No. Print it once at the start of the day and it works for the whole tournament.",
      },
      {
        q: "Can I stop people seeing it?",
        a: "A draft tournament is not readable at all: the endpoint answers 404 until you launch it. After that, anybody with the token can read it.",
      },
    ],
    related: [
      "run-a-tournament-from-your-phone",
      "tournament-projector-display",
      "tournament-generator",
    ],
  },

  {
    slug: "run-a-tournament-from-your-phone",
    kind: "operational",
    title: "Run a Tournament From Your Phone: Setup to Final Whistle",
    h1: "Run a tournament from your phone",
    description:
      "Set up, schedule and score a whole tournament from a phone. No laptop, no desk, no account. Free, and the wall keeps up on its own.",
    lede:
      "Name it, add the teams one at a time, say how many courts and how long you have. That is the setup. Then run the day from the same phone: put matches on courts, mark what is being played, enter results as they come in.",
    generator: { preset: "groups", teams: 12 },
    howTo: [
      {
        name: "Name the tournament and add the teams",
        text: "Every team is saved the moment it is typed, so a locked screen or an incoming call can't lose the list. Leaving and coming back picks up where you left off.",
      },
      {
        name: "Say how many courts and how long you have",
        text: "The format screen quotes the ways to run the day in matches and hours against the teams and courts you entered, \"28 matches, about four hours on two courts\", rather than asking about pools or Swiss rounds directly.",
      },
      {
        name: "Put matches on courts as you decide",
        text: "Court and start time save on tap, separately from the result, since assigning a court is a decision that happens before the score does.",
      },
      {
        name: "Enter results as they come in",
        text: "A result is a status and two numbers, with points by set optional underneath. Tables, brackets and the next round are rebuilt from every fixture at once as results land.",
      },
      {
        name: "Hand a court to a referee, if you want a second phone scoring",
        text: "A referee scans a QR code and runs their own court from their own phone. Proximity to the code is the only authentication, and there's nothing to type or sign up for.",
      },
    ],
    sections: [
      {
        heading: "It writes as you go",
        body: [
          "The tournament exists from the second screen onwards, and every team is saved the moment it is typed. Twenty names held in a tab that a locked screen or an incoming call can discard is a betrayal that only shows up at the worst possible moment.",
          "Which is also why leaving and coming back works. The half-finished tournament is remembered on the device, so the first screen offers to pick it up.",
        ],
      },
      {
        heading: "No signup in front of the wizard",
        body: [
          "An account is created quietly in the background while you are typing the first name, because a signup form in front of somebody holding a clipboard in a sports hall is where this would lose them. You are offered the chance to put a real email on it afterwards, once there is something worth keeping, and that is also how you open the tournament on a second device.",
        ],
      },
      {
        heading: "The format screen asks about time, not about pools",
        body: [
          "It does not ask how many groups you want or how many teams advance. It offers the ways to run a day, each quoted in matches and hours against the teams and courts you actually entered: \"28 matches, about four hours on two courts\" is the decision an organiser is really making. Pool counts, Swiss rounds and advancement are derived from there.",
        ],
      },
      {
        heading: "Scoring at the side of the court",
        body: [
          "A result is a status and two numbers. Under it, optionally, the points set by set, written as they are entered rather than saved at the end, because somebody tapping a point per rally will not press Save between rallies. The plus and minus send a step rather than a number, so two taps inside one frame both count.",
          "Court and start time save on tap rather than with the result, because putting a match on a court is a decision that has already happened by the time it is recorded, and the score may be an hour away.",
        ],
      },
      {
        heading: "It keeps working when the hall's wifi does not",
        body: [
          "Every write from the match sheet goes into a durable queue on the device and is sent from there, so the sheet closes on the tap rather than on a round trip. What is queued is the intent, \"2-0, with these sets\", rather than the request, so replaying it later runs exactly the same write as the online path. A match rescored three times offline drains as one write.",
          "What it does not do is guess. Offline, a result closes its own match and nothing else: no slot filled, no table rebuilt, no playoff place promoted. All of that is derived from every fixture at once and is the server's, so the bracket stands still until the queue drains. That's the truth of the situation rather than a picture of one.",
          "Setting a tournament up, adding or removing a team, and minting a join code all still need a signal, and say so. Adding a team is deliberately not queued: it changes who gets drawn into the next Swiss round, and a queued arrival would pair a round around a field that is wrong in either direction.",
        ],
      },
      {
        heading: "A second person on a second phone",
        body: [
          "A referee scans a QR code, says who they are, and runs their court from their own phone. Proximity is the authentication: anyone close enough to scan the code the organiser is holding up is somebody already being handed a court, so there is nothing to type and no account to make.",
          "There is one code per role rather than per person, because typing names into a phone in a hall is the friction the code exists to avoid. Roles are recorded rather than enforced: every crew member can do everything the results screen offers. What is enforced is owner versus crew: handing out codes and removing people are the owner's alone.",
        ],
      },
    ],
    faq: [
      {
        q: "Do I need a laptop at all?",
        a: "Only if you want the projector view on a screen, and even then the laptop just opens a link. Everything is driven from the phone.",
      },
      {
        q: "What if my phone dies?",
        a: "Put an email on the account and you can sign in on another device and carry on. Everything is on the server, not on the phone.",
      },
      {
        q: "Can somebody else enter results?",
        a: "Yes: hand a referee a QR code and they run their court from their own phone. There is one code per role rather than per person, and the name is asked for at the far end by whoever is scanning it.",
      },
    ],
    related: [
      "tournament-generator",
      "qr-code-tournament-results",
      "multi-court-tournament-scheduler",
      "guide/how-to-run-a-one-day-tournament",
    ],
  },

  {
    slug: "referee-scoring-app",
    kind: "operational",
    title: "Referee Scoring App: A Phone Per Court, No Accounts",
    h1: "A phone per court",
    description:
      "Hand each referee a QR code and they score their own court from their own phone. No accounts, no app to install, free.",
    lede:
      "The organiser holds up a QR code, the referee scans it, types their name, and starts refereeing. No account to create, no app to install, and no queue of paper scraps building up at one person's desk.",
    generator: { preset: "groups", teams: 16 },
    sections: [
      {
        heading: "Why results pile up at a desk",
        body: [
          "The commonest way a one-day tournament goes wrong is not the format. It is that results come back to a desk on scraps of paper, and by lunchtime the tables are an hour behind, nobody knows who is qualifying, and the playoff draw is late.",
          "That happens because entering results is one person's job, and that person is also the one being asked when the next match is. Spreading the entering across the people already standing at the courts is the fix, and the reason it usually is not done is that giving five volunteers logins is more work than writing on paper.",
        ],
      },
      {
        heading: "Proximity is the authentication",
        body: [
          "The referee is standing next to the organiser, so the invitation is something held up and scanned. Anyone close enough to scan the code is somebody already being handed a court, which is a better check than a password nobody will remember.",
          "There is one code per role rather than per person, because typing names into a phone in a hall is exactly the friction the code exists to avoid. The name is asked for at the far end, by the person who knows it, and it lands on the crew record rather than on an account, so the organiser holding a log of who changed which result can actually render those names.",
        ],
      },
      {
        heading: "Roles are recorded, not enforced",
        body: [
          "Every crew member can do everything the results screen offers. The role says what somebody was handed a code for and shows up in the crew list; it does not lock anything.",
          "The distinction that is enforced is owner versus crew: handing out codes and removing people are the owner's alone. Anything looser would be a way around that: a scorer who could write to the crew list could issue themselves an organiser code.",
        ],
      },
      {
        heading: "It keeps working when the wifi does not",
        body: [
          "Five phones on a sports hall's wifi is exactly where a connection gives out. Every write from the match sheet goes into a durable queue on the device and sends itself when the signal comes back, so the sheet closes on the tap rather than on a round trip.",
          "What is queued is the intent, \"2-0, with these sets\", rather than the request, so replaying it later runs the same write as the online path. Offline a result closes its own match and nothing else: no table rebuilt, no playoff place promoted. That is the server's, worked out from every fixture at once, so the bracket stands still until the queue drains rather than showing a guess.",
        ],
      },
      {
        heading: "Email is the upgrade, not the entry",
        body: [
          "A referee who works every weekend can claim their device account and sign in anywhere, which is the same bargain the organiser's own account makes. Nobody has to do it to referee one afternoon.",
        ],
      },
    ],
    faq: [
      {
        q: "Do referees need to make an account?",
        a: "No. They scan a code, type their name, and start. Claiming an account with an email is optional and only worth it for somebody who does this regularly.",
      },
      {
        q: "How many people can score at once?",
        a: "There is no limit. One code can be scanned by as many people as you hand it to, which is why minting codes is the owner's alone.",
      },
      {
        q: "Can a referee change another court's results?",
        a: "Yes. Roles are recorded rather than enforced: every crew member can do everything the results screen offers. If that matters for your event, hand out fewer codes.",
      },
      {
        q: "What if a referee's phone loses signal?",
        a: "Results queue on the device and send themselves when it comes back. The tables and bracket wait until the queue drains rather than showing a guess.",
      },
      {
        q: "Is there an app to install?",
        a: "No. It is a web page, and it can be added to a home screen if somebody wants it there.",
      },
    ],
    related: [
      "run-a-tournament-from-your-phone",
      "multi-court-tournament-scheduler",
      "qr-code-tournament-results",
      "guide/how-to-run-a-one-day-tournament",
    ],
  },

  {
    slug: "multi-court-tournament-scheduler",
    kind: "operational",
    title: "Multi-Court Tournament Scheduler: Spread Matches Across Courts",
    h1: "Multi-court tournament scheduler",
    description:
      "Assign matches to courts and times, see clashes before they happen, and show each court's schedule on the wall. Free, no account.",
    lede:
      "Put each match on a court and a time from your phone. The wall shows every court's next few matches, and you are warned when a team is already down for something else at the same time.",
    generator: { preset: "groups", teams: 16 },
    sections: [
      {
        heading: "Clashes are surfaced, not prevented",
        body: [
          "When you put a team on a court at a time they are already booked for, you are told, and then allowed to do it anyway. That is deliberate: reshuffling a schedule passes through states that are briefly wrong on purpose, and software that refuses the intermediate step makes the reshuffle impossible.",
          "So it is a warning rather than an error, and it stays visible until the clash is gone.",
        ],
      },
      {
        heading: "A court's schedule is a scoreboard, not a list",
        body: [
          "On the wall, each court gets fixed-width columns (code, home, score, away) because each row is its own grid, and content-sized columns put every row's score wherever that row's names happened to end. A live match shows the sets it has won with the set in progress underneath.",
          "A match that has not started shows \"vs\" rather than the 0-0 it carries on the wire, which on a wall reads as a goalless draw somebody has already played.",
        ],
      },
      {
        heading: "How many courts you need",
        body: [
          "The format screen quotes a finish time against the courts you enter, so the answer is two or three attempts rather than a calculation. A round robin parallelises almost perfectly: four courts really is about a quarter of one court. A knockout does not, because each round waits for the one before it, so past a certain point more courts stop helping.",
        ],
      },
    ],
    faq: [
      {
        q: "Does it schedule automatically?",
        a: "It generates the fixture list and you assign courts and times. There is no automatic timetabler that fills the whole day for you.",
      },
      {
        q: "Can courts have names?",
        a: "Yes: \"Court 1\", \"Hall B\", \"Pitch 3\", whatever the venue calls them. That is what appears on the wall.",
      },
    ],
    related: [
      "run-a-tournament-from-your-phone",
      "tournament-projector-display",
      "guide/how-many-courts-do-i-need",
    ],
  },

  {
    slug: "mcp",
    kind: "operational",
    title: "MCP Server for Tournaments: Set One Up by Prompt",
    h1: "Run a tournament through an AI agent",
    description:
      "Whistle.day is also an MCP server. Point Claude, ChatGPT or any MCP client at it and an agent can set up, draw and score a tournament.",
    lede:
      "Whistle.day is also an MCP server: the same 21 tools its own screens are built on, over one HTTP endpoint. Point an agent at it and it can create a tournament, add teams and courts, draw a stage, settle matches, and hand you back a link and a QR code, without anybody touching the wizard.",
    facts: [
      {
        label: "Tools",
        value: "21",
        note: "create, draw, score, publish: nothing the app's own screens can't also do",
      },
      { label: "Endpoint", value: "/api/mcp", note: "one URL, Streamable HTTP" },
      {
        label: "Account",
        value: "None to make",
        note: "the first tool call mints one, remembered by the connection",
      },
      {
        label: "Sign-in",
        value: "Optional",
        note: "OAuth 2.1 with PKCE, for reaching an account you already have",
      },
    ],
    sections: [
      {
        heading: "Claude Desktop and Claude Code",
        body: [
          "Claude Code adds a remote server from the command line, one command and nothing to edit by hand:",
          "Claude Desktop and claude.ai take the same URL as a custom connector, **Settings → Connectors → Add custom connector**, or the equivalent block in `claude_desktop_config.json`:",
        ],
        code: [
          {
            label: "Claude Code",
            code: "claude mcp add --transport http whistleday https://whistle.day/api/mcp",
          },
          {
            label: "claude_desktop_config.json",
            code: '{\n  "mcpServers": {\n    "whistleday": {\n      "type": "http",\n      "url": "https://whistle.day/api/mcp"\n    }\n  }\n}',
          },
        ],
      },
      {
        heading: "ChatGPT",
        body: [
          "**Settings → Connectors → Advanced → Developer mode**, then create a connector: give it a name, paste the URL below, and set authentication to OAuth to work on your own account, or to none to start from nothing. ChatGPT lists the 21 tools once it connects.",
        ],
        code: [{ code: "https://whistle.day/api/mcp" }],
      },
      {
        heading: "Cursor, Windsurf, Cline, or anything else that reads an MCP config",
        body: [
          "The same shape every one of them expects for a remote server: no command, no local process, just the URL in `mcp.json`:",
        ],
        code: [
          {
            label: "mcp.json",
            code: '{\n  "mcpServers": {\n    "whistleday": {\n      "url": "https://whistle.day/api/mcp"\n    }\n  }\n}',
          },
        ],
      },
      {
        heading: "Or skip the URL entirely",
        body: [
          "Whistle.day is listed on [Smithery](https://smithery.ai/servers/turon-honza/whistle-day), so a client that installs from there gets the connection made for it rather than a URL to paste.",
        ],
      },
      {
        heading: "What an agent actually does with it",
        body: [
          "`create_tournament` is the only tool that asks for nothing first: it makes a temporary account and the connection remembers it, so every other tool works from then on with nothing to pass around. Two prompts, `plan_a_tournament` and `enter_the_results`, lay out the rest of the sequence: add the teams, add the courts, create a stage and generate its draw, publish, open a display. The second one is for the day itself: find what is live, settle it, move on.",
          "Nothing here is a shortcut version of the app. `generate_stage` takes a `dry_run` so an agent can preview a draw before committing to it, and `update_fixture` triggers the same re-resolve the results screen does, so the tables, the next Swiss round and the playoff seeded from them come out right either way.",
        ],
      },
      {
        heading: "What the 21 tools cover",
        body: [
          "**Setup:** `create_tournament` (with sport presets for football, volleyball, chess, tennis, and more), `add_entry` (teams and seeds), `add_court` (pitches, tables, and display ordering), and `list_tournaments`.",
          "**Draws and formats:** `create_stage` (round robin, single elimination, double elimination, Swiss), `generate_stage` with `dry_run` previews, `list_stages`, and `list_pools`.",
          "**Scoring and live play:** `list_fixtures` (filter by live or ready), `update_fixture` (set scores, mark walkovers, assign courts), `resolve_stage` to recalculate standings and advance winners, and `get_stage_table` / `list_standings` for group and cross-pool tables.",
          "**Delivery:** `publish_tournament` to take the day public, `create_display` for spectator projector panels, and `create_handoff` so a human organiser can claim full control.",
        ],
      },
      {
        heading: "No credential in the conversation, on purpose",
        body: [
          "The temporary account is tied to the connection's own session id, a header the transport carries and the model never sees. No tool returns a token and none asks for one, so a transcript that leaks has nothing in it that opens a tournament.",
          "The cost is that a connection ends, and a client that reconnects is a stranger. `create_handoff` is how a tournament outlives it: it mints a link for whoever is actually running the day, they set an email and a password, and the agent's access stops the moment they do.",
        ],
      },
      {
        heading: "Sign in once instead",
        body: [
          "That temporary account is the right default for an agent setting up today's tournament from nothing, but it means `list_tournaments` on a fresh connection is always empty: there is nothing yet for it to find. A person who already has a Whistle.day account can sign in once in a browser and connect an agent to that account instead: most clients (Claude, ChatGPT) discover this automatically and offer a plain **Sign in** button rather than the URL above.",
          "Once connected that way, an agent reaches everything that account owns or crews, the same tournaments the web app itself shows after signing in, not a narrower set, and `create_tournament` builds new ones under that real account rather than a fresh throwaway one. Nothing about what a tool can do changes; only whose tournaments it can see does.",
        ],
      },
      {
        heading: "Writing code instead of prompting",
        body: [
          "The tools sit on an ordinary HTTP API, and a script can call it directly: read a published tournament's tables and fixtures without an account, preview a draw, enter results, or pull a whole projector screen in one request. The [API reference](/api/docs) lists every endpoint with example requests and responses, and the same reference is available as an [OpenAPI document](/api/openapi.json) for generating a client.",
        ],
        code: [
          {
            label: "curl",
            code: "curl -X POST https://whistle.day/api/preview \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"format\": \"round_robin\", \"teams\": 4}'",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Does an agent need an account first?",
        a: "No. `create_tournament` makes a temporary one automatically and the connection remembers it, unless the connection already signed in as a real account, in which case the tournament is created there.",
      },
      {
        q: "Can it see other people's tournaments?",
        a: "No, either way. An anonymous connection reaches only the tournaments it made itself. A signed-in connection reaches exactly what that account owns or is crew on, the same as signing in on the web, and nothing beyond it.",
      },
      {
        q: "What transport does it use?",
        a: "Streamable HTTP: one endpoint answers POST for a request, GET for the stream, and DELETE to end a session. No SSE fallback to configure separately.",
      },
      {
        q: "Is it free?",
        a: "Yes: the MCP server calls the same tournament engine the free web app runs on.",
      },
      {
        q: "Is there an HTTP API as well?",
        a: "Yes. The MCP tools are a layer over a JSON API that anything can call, documented at [/api/docs](/api/docs) and as OpenAPI at [/api/openapi.json](/api/openapi.json).",
      },
      {
        q: "My agent reconnected and can't find the tournament it made. What then?",
        a: "A temporary account lasts as long as the connection that made it. To keep a tournament, have the agent call `create_handoff` before it disconnects and open the link, or sign in first so everything is created on your own account. A session token issued by an earlier version of the server still works in the `X-Whistle-Session` header.",
      },
    ],
    related: [
      "run-a-tournament-from-your-phone",
      "referee-scoring-app",
      "tournament-projector-display",
    ],
  },
];
