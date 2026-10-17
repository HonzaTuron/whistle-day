import type { Message } from "../lib/i18n";

/**
 * Every sentence the app says, in English.
 *
 * This file is the shape: `cs.ts` and `es.ts` are typed against it, so a key
 * added here without a translation is a compile error rather than an English
 * sentence turning up in the middle of another language. Keys are `area.thing`, and the
 * area matches the file the sentence is drawn in.
 *
 * A value is either a string or a set of plural forms. Use the plural form
 * whenever a number is interpolated with a noun beside it — English needs two
 * forms and Czech needs three, and a sentence written as `"{count} matches"`
 * cannot be translated into either.
 */
export const en = {
  // -------------------------------------------------------------------------
  // shared
  // -------------------------------------------------------------------------
  "common.loading": "Loading…",
  "common.done": "Done",
  "common.back": "Back",
  "common.close": "Close",
  "common.dismiss": "Dismiss",
  "common.cancel": "Cancel",
  "common.retry": "Retry",
  "common.remove": "Remove",
  "common.keep": "Keep",
  "common.copy": "Tap to copy",
  "common.copied": "Copied",
  "common.saving": "Saving…",
  "common.notSaved": "not saved",
  "common.moment": "One moment…",
  "common.team": "Team",
  "common.language": "Language",

  /*
   * A number with its noun, as a phrase rather than a sentence.
   *
   * Czech inflects the noun three ways — 1 tým, 2 týmy, 5 týmů — so a number
   * and a noun cannot be concatenated by the caller. And a sentence with two
   * counts in it ("16 teams on 2 courts") cannot be one plural message either,
   * because a message selects on one count. So the phrases are built here and
   * interpolated into the sentence whole.
   */
  "count.teams": {
    one: "{count} team",
    other: "{count} teams",
  },
  // The preposition belongs to the phrase, not to the sentence: Czech puts
  // "kurt" in the locative after "na", and only the phrase knows that.
  "count.courtsOn": {
    one: "on {count} court",
    other: "on {count} courts",
  },
  "count.courtsOn.pitches": {
    one: "on {count} pitch",
    other: "on {count} pitches",
  },
  "count.courtsOn.tables": {
    one: "on {count} table",
    other: "on {count} tables",
  },

  // Column heads on the tables. Abbreviated because a projector column is
  // three characters wide, and expanded in the title attribute instead.
  "table.played": "P",
  "table.won": "W",
  "table.drawn": "D",
  "table.lost": "L",
  "table.sets": "Sets",
  "table.points": "Pts",
  "table.playedFull": "Played",
  "table.wonFull": "Won",
  "table.drawnFull": "Drawn",
  "table.lostFull": "Lost",
  "table.pointsFull": "Points",

  // -------------------------------------------------------------------------
  // errors
  // -------------------------------------------------------------------------
  "error.unreachable": "Cannot reach the scoring system.",
  "error.generic": "Something went wrong.",
  "error.notWork": "That did not work.",
  "error.notSaved": "Could not save that.",
  "error.notQueued": "That could not be saved.",
  "error.nothingHere": "Nothing here.",
  "error.request": "Request failed ({status}).",
  "error.badScreenLink": "This screen link is not valid.",
  "error.refusedResults": {
    one: "{count} result was refused: {messages}",
    other: "{count} results were refused: {messages}",
  },

  // -------------------------------------------------------------------------
  // the bar across the top of the landing and marketing pages
  // -------------------------------------------------------------------------
  "nav.label": "Site sections",
  "nav.formats": "Formats",
  "nav.guides": "Guides",
  "nav.screens": "Screens",
  "nav.print": "Print",
  "nav.compare": "Compare",
  "nav.mcp": "MCP",
  "nav.setUp": "Set up",
  "nav.privacy": "Privacy",
  "nav.terms": "Terms",
  "nav.deletion": "Data deletion",

  // -------------------------------------------------------------------------
  // landing
  // -------------------------------------------------------------------------
  "landing.title": "Whistle.day — Free Tournament Organiser",
  "landing.description":
    "Free tournament organiser. Draw groups, brackets or a Swiss, run the day from your phone, and put the results on a projector. No account, no ads.",
  "landing.eyebrow": "Live scores, on the wall",
  "landing.tagline": "Run a tournament off a phone and put it on the wall.",
  "landing.resume": "Back to {name}",
  "landing.setUp": "Set up a tournament",
  "landing.signIn": "Sign in",
  "landing.howTitle": "How it works",
  "landing.step1Title": "Set it up",
  "landing.step1Body":
    "Name your tournament, add the teams, pick the format. Done in under a minute, no account needed.",
  "landing.step2Title": "Run the day",
  "landing.step2Body":
    "Put matches on courts, mark what is being played, enter results as they come in. All from your phone.",
  "landing.step3Title": "Put it on the wall",
  "landing.step3Body":
    "A projector screen that updates itself: tables rebuild, the bracket fills in, the next Swiss round draws itself.",
  "landing.demoCourt": "Court 2",
  "landing.demoLive": "Live",
  "landing.demoHome": "Harbour Hawks",
  "landing.demoAway": "Old Mill",
  "landing.demoCaption":
    "A match on the projector: Harbour Hawks and Old Mill are level at one set each, and the third set is being played at 11-8.",
  "landing.statSetupValue": "60s",
  "landing.statSetupLabel": "to a link and a QR code",
  "landing.statFreeValue": "0",
  "landing.statFreeLabel": "accounts, ads or caps",
  "landing.statFormatsValue": "4",
  "landing.statFormatsLabel": "formats, in any order",
  "landing.statLiveValue": "0.2s",
  "landing.statLiveLabel": "from the net to the wall",
  "landing.formatsTitle": "Formats",
  "landing.formatRoundRobin": "Round Robin",
  "landing.formatRoundRobinBody":
    "Every team plays every other. Groups feed into the playoff.",
  "landing.formatSingleElim": "Single Elimination",
  "landing.formatSingleElimBody":
    "Lose once and you are out. Classic bracket, straight through.",
  "landing.formatDoubleElim": "Double Elimination",
  "landing.formatDoubleElimBody":
    "A second chance: drop into the losers bracket and fight your way back.",
  "landing.formatSwiss": "Swiss",
  "landing.formatSwissBody":
    "Every round pairs like with like. No elimination: every team plays every round.",
  "landing.formatMore": "See how it runs",
  "landing.sportsTitle": "Whatever is being played",
  "landing.sportsNote":
    "A draw does not care what the ball is. Same day, same phone. Here's the page for yours.",
  "landing.sportVolleyball": "Volleyball",
  "landing.sportBeach": "Beach volleyball",
  "landing.sportPadel": "Padel",
  "landing.sportPickleball": "Pickleball",
  "landing.sportBadminton": "Badminton",
  "landing.sportTableTennis": "Table tennis",
  "landing.sportFutsal": "Futsal",
  "landing.sportChess": "Chess",
  "landing.sportEsports": "Esports",
  "landing.screenTitle": "Open a screen",
  "landing.screenNote":
    "Enter the token from the QR code by the door, or from the organiser screen.",
  "landing.tokenPlaceholder": "screen token",
  "landing.projector": "Projector",
  "landing.phone": "Phone",
  "landing.agentsTitle": "Works for agents too",
  "landing.agentsNote":
    "Whistle.day is also an MCP server — point Claude, ChatGPT or any MCP client at it and an agent can create a tournament, add teams and courts, draw a stage and settle matches on its own.",
  "landing.agentsLink": "See the MCP server",
  "landing.apiLink": "API reference",
  "landing.footer": "Whistle.day, a free tournament organiser.",
  "landing.smithery": "Whistle.day on Smithery",

  // -------------------------------------------------------------------------
  // account
  // -------------------------------------------------------------------------
  "account.signedIn": "Signed in",
  "account.keepTitle": "Keep your tournament",
  "account.signInTitle": "Sign in",
  "account.signedInAs":
    "As {email}. Sign in with that anywhere else to pick your tournaments up there.",
  "account.keepBody":
    "The way back into your tournament lives in this browser and nowhere else — whether you set it up or were handed a code at the door. An email and a password give it somewhere else to live.",
  "account.keepBodyNamed":
    "The way back into {name} lives in this browser and nowhere else — whether you set it up or were handed a code at the door. An email and a password give it somewhere else to live.",
  "account.signInBody":
    "Nothing has been set up on this device. Sign in and whatever you run from another one comes with you.",
  "account.looking": "Looking…",
  "account.noTournaments": "No tournaments on this account yet.",
  "account.email": "Email",
  "account.password": "Password",
  "account.save": "Save access",
  "account.haveAccount": "I already have an account",
  "account.keepInstead": "Keep this device's tournament instead",
  "account.switchWarning":
    "Signing in as somebody else leaves anything set up on this device behind. It stays live on the wall; this browser just stops being the way in.",
  "account.claimRefused":
    "That address cannot be saved on this device. If it is already your account, sign in with it — anything set up here stays live and this browser stops being the way in.",
  "account.signOut": "Sign out",
  "account.deleteTitle": "Account deleted",
  "account.deleteButton": "Delete account",
  "account.deleteConfirmTitle": "Delete this account?",
  "account.deleteConfirmPrompt": {
    one: "This permanently deletes your account and {count} tournament you own. There is no way to recover them.",
    other: "This permanently deletes your account and {count} tournaments you own. There is no way to recover them.",
  },
  "account.deleteConfirmButton": "Yes, permanently delete",
  "account.deleted":
    "Your account and all associated data have been permanently deleted.",
  "account.termsNotice": "By continuing, you agree to our",
  "account.termsOfService": "Terms of Service",
  "account.privacyPolicy": "Privacy Policy",
  "account.and": "and",
  // The club an account runs its tournaments as, and its public page.
  "club.title": "Club page",
  "club.intro":
    "One address for all your club's tournaments, like whistle.day/c/your-club. Takes a minute, and nothing goes on it until you say so.",
  "club.name": "Club name",
  "club.address": "Address",
  "club.addressHint":
    "Lowercase letters, numbers and dashes. It cannot be changed later, because it is what ends up on the poster.",
  "club.addressRefused":
    "That address is taken or cannot be used. Try another one.",
  "club.create": "Create the page",
  "club.save": "Save",
  "club.changeLogo": "Change the club logo",
  "club.colour": "Club colour",
  "club.colourReset": "Use the default",
  "club.listTitle": "On the club page",
  "club.listHint":
    "Ticking a tournament makes it public: anybody with the club's address can open its results.",
  "club.listEmpty": "Tournaments you own will be listed here.",
  "club.listDraft": "not started, hidden until it is",
  "club.listRefused":
    "Only the owner of the tournament can put it on the club page.",
  "club.setUp": "Set up a club page",
  // Setting up a club page: screens/ClubSetup.tsx.
  "clubSetup.nameTitle": "What is your club called?",
  "clubSetup.nameHint": "It heads the page, and the address is made from it.",
  "clubSetup.namePlaceholder": "Riverside Badminton Club",
  "clubSetup.changeAddress": "Change",
  "clubSetup.addressShort": "At least 3 letters or numbers",
  "clubSetup.addressChecking": "Checking…",
  "clubSetup.addressFree": "Free",
  "clubSetup.addressTaken": "Taken, try another",
  "clubSetup.listTitle": "Put tournaments on it?",
  "clubSetup.listPublish": {
    one: "Put {count} tournament on the page",
    other: "Put {count} tournaments on the page",
  },
  "clubSetup.listSkip": "Not now",
  "clubSetup.doneEyebrow": "Your club page is ready",
  "clubSetup.doneNote": "Tournaments you tick on the account screen show up here.",
  "clubSetup.doneOpen": "Open the page",
  "clubSetup.doneStyle": "Add a logo and colour",
  "club.missing": "No club at this address",
  "club.missingBody": "Check the link, or ask whoever sent it.",
  "club.empty": "Nothing has been listed here yet.",
  "club.current": "On now and coming up",
  "club.past": "Past tournaments",
  // Being handed a tournament somebody else set up.
  "claim.title": "{tournament} is yours",
  "claim.body":
    "This tournament was set up on an account nobody owns yet. Put an email and a password on it and it is yours — the draw, the results and the screens, all of it.",
  "claim.accept": "Take it",
  "claim.once":
    "The link works once. Whoever set the tournament up loses access the moment you do this.",
  "claim.deadTitle": "This link is not valid any more",
  "claim.deadBody":
    "It has been used, or it expired, or it was never a link at all. Ask whoever sent it for another one.",
  "claim.failed": "That did not work. Nothing has changed — try again.",
  "claim.finishing": "Taking it…",

  // An AI agent asking to connect to a signed-in account (the MCP OAuth flow).
  "connect.title": "{client} wants to connect",
  "connect.unnamedClient": "An app",
  "connect.body":
    "It will be able to see and manage tournaments you own or are staff on — the same as signing in on the web.",
  "connect.signInPrompt": "Sign in first to allow this.",
  "connect.signInLink": "Sign in",
  "connect.approve": "Allow",
  "connect.deny": "Not now",
  "connect.denied": "Declined. You can close this tab.",
  "connect.deadTitle": "This link is not valid any more",
  "connect.deadBody":
    "It has been used, or it expired, or it was never a link at all. Go back to whatever you were connecting and try again.",
  "connect.failed": "That did not work. Nothing has changed — try again.",

  // Getting back into a claimed account: forgot-password, and the nudge to
  // confirm an address so a reset can reach it.
  "recover.forgotTitle": "Reset your password",
  "recover.forgotBody":
    "Type the email your account is on and we will send a link to set a new password.",
  "recover.forgotLink": "Forgot your password?",
  "recover.sendLink": "Send the link",
  "recover.backToSignIn": "Back to sign in",
  "recover.sent":
    "If that address has an account, a reset link is on its way. Give it a minute, and check the spam folder.",
  "recover.sendFailed": "That could not be sent just now. Try again in a moment.",
  "recover.mismatch": "The two passwords are not the same.",
  "recover.resetTitle": "Choose a new password",
  "recover.resetBody": "For the account the reset link was sent to.",
  "recover.newPassword": "New password",
  "recover.confirmPassword": "Type it again",
  "recover.setPassword": "Set password",
  "recover.doneTitle": "Password changed",
  "recover.doneBody": "Sign in with your email and the new password.",
  "recover.toSignIn": "Sign in",
  "recover.deadTitle": "This link has expired",
  "recover.deadBody":
    "A reset link lasts under an hour and works once. Ask for a fresh one from the sign-in screen.",
  "recover.tryAgain": "Back to sign in",
  "recover.verifyNudge":
    "This email is not confirmed yet, so a password reset would have nowhere to go.",
  "recover.verifyResent": "Sent. Look for the confirmation link in your inbox.",
  "recover.resend": "Send it again",

  // The two pages the recovery emails link to.
  "verify.doneTitle": "Email confirmed",
  "verify.doneBody": "This address can now bring you back to the account.",
  "verify.deadTitle": "This link has expired",
  "verify.deadBody":
    "Confirmation links do not last forever. Sign in and send a new one from your account.",
  "verify.toAccount": "Go to your account",

  "account.continueWith": "Continue with {provider}",
  "account.or": "or",
  "account.oauthFailed":
    "That did not finish. Nothing has changed — anything set up on this device is still here, and you can try again or use an email and a password.",

  // A tournament's own state, as the account list shows it.
  "status.draft": "draft",
  "status.live": "live",
  "status.finished": "finished",
  "status.archived": "archived",

  // -------------------------------------------------------------------------
  // join
  // -------------------------------------------------------------------------
  "join.nothing": "Nothing to join",
  "join.expired": "This invitation has expired, or was never valid.",
  "join.invalid": "This invitation is not valid.",
  "join.askForFresh": "Ask whoever is running the day for a fresh code.",
  "join.asked": "You have been asked to {role}",
  "join.yourName": "Your name",
  "join.namePlaceholder": "Jana",
  "join.nameHint": "So the others can tell who entered a result. You can leave it blank.",
  "join.joining": "Joining…",
  "join.start": "Join and start",
  "join.failed": "Could not join this tournament.",
  "join.warning":
    "You are joining on this device, without an account. Clearing this browser is the one thing that will lock you out.",

  // What the invitation says the person is being asked to do.
  "join.roleOrganizer": "help run it",
  "join.roleReferee": "referee",
  "join.roleScorer": "keep score",

  // -------------------------------------------------------------------------
  // the wizard
  // -------------------------------------------------------------------------
  "wizard.step": "Step {current} of {total}",
  "wizard.nameTitle": "What's it called?",
  "wizard.nameHint": "You can change this later — nothing here is final until you start.",
  "wizard.namePlaceholder": "Autumn Cup",
  "wizard.nameNext": "Add the teams",
  "wizard.nameBusy": "Just a second…",
  "wizard.sportLegend": "What's being played?",
  "wizard.resume": "{name} is half set up on this device{teams}.",
  "wizard.resumeTeams": {
    one: " — {count} team in",
    other: " — {count} teams in",
  },
  "wizard.resumeContinue": "Pick that up",
  "wizard.resumeDiscard": "Start something new",

  "wizard.teamsTitle": "Team {number}",
  "wizard.teamsHint": "Add them one at a time. The order you add them in is the seeding.",
  "wizard.teamsPlaceholder": "Team name",
  "wizard.teamsAdd": "Add team",
  "wizard.teamsDuplicate": "You already have a team called that.",
  "wizard.teamsShortLabel": "Shown on the projector",
  "wizard.teamsRemove": "Remove {name}",
  "wizard.teamsMore": "{count} more to get going",
  "wizard.teamsEnough": {
    one: "That's everyone — {count} team",
    other: "That's everyone — {count} teams",
  },

  "wizard.courtsTitle": "How many courts?",
  "wizard.courtsTitle.pitches": "How many pitches?",
  "wizard.courtsTitle.tables": "How many tables?",
  "wizard.courtsHint":
    "Matches run on all of them at once, so this is what decides how long the day takes.",
  "wizard.courtsNext": "How it's played",
  "wizard.courtsDefaultName": "Court {number}",
  "wizard.courtsDefaultName.pitches": "Pitch {number}",
  "wizard.courtsDefaultName.tables": "Table {number}",
  "wizard.courtsFewer": "One fewer court",
  "wizard.courtsFewer.pitches": "One fewer pitch",
  "wizard.courtsFewer.tables": "One fewer table",
  "wizard.courtsMore": "One more court",
  "wizard.courtsMore.pitches": "One more pitch",
  "wizard.courtsMore.tables": "One more table",
  "wizard.courtsDuplicate": "Two courts have the same name.",
  "wizard.courtsDuplicate.pitches": "Two pitches have the same name.",
  "wizard.courtsDuplicate.tables": "Two tables have the same name.",
  "wizard.courtsBlank": "Every court needs a name.",
  "wizard.courtsBlank.pitches": "Every pitch needs a name.",
  "wizard.courtsBlank.tables": "Every table needs a name.",

  "wizard.formatTitle": "How should it run?",
  "wizard.formatHint": "{teams} {courts}.",
  "wizard.formatLegend": "Format",
  "wizard.formatStart": "Start the tournament",
  "wizard.formatCost": {
    one: "≈ {count} match · about {duration}",
    other: "≈ {count} matches · about {duration}",
  },
  "wizard.formatNeeds": {
    one: "Needs at least {count} team.",
    other: "Needs at least {count} teams.",
  },
  "wizard.formatNote":
    "Seeded in the order you added the teams, so the first two you entered cannot meet before the final.",
  "wizard.launchStages": "Setting it up…",
  "wizard.launchDraw": "Making the draw…",
  "wizard.launchScreen": "Opening a screen…",
  "wizard.launchPublish": "Going live…",

  "wizard.doneEyebrow": "Live now",
  "wizard.doneFallbackName": "Your tournament",
  "wizard.doneCaption": "Scan for the schedule, tables and results",
  "wizard.doneEnterResults": "Admin — start the tournament",
  "wizard.doneOpenProjector": "Open the projector screen",
  "wizard.doneProjectorNote": "What it shows is editable once the day is running.",
  "wizard.doneCopyProjector": "Copy the projector link",
  "wizard.doneProjectorCopied": "Projector link copied",
  "wizard.doneWarning":
    "This tournament is managed from this device — this browser is the only one that can change it.",
  "wizard.doneWarningLink": "Put an email on it",
  "wizard.doneWarningTail": "and it will survive a lost phone.",

  // -------------------------------------------------------------------------
  // formats offered by the wizard
  // -------------------------------------------------------------------------
  "preset.knockout.title": "Straight knockout",
  "preset.knockout.tag": "Shortest",
  "preset.knockout.blurb":
    "Lose once and you are out. The quickest way to a winner, and the least playing time for whoever draws badly.",
  "preset.knockout.shape": "{round} through to the final, plus a third-place match",
  "preset.knockout.three":
    "Not with three teams: one would go straight to the final without playing.",

  "preset.double.title": "Double elimination",
  "preset.double.tag": "Two lives",
  "preset.double.blurb":
    "Lose once and you drop into the losers bracket; lose twice and you are out. Nobody goes home on one bad game, and the day still ends with one winner.",
  "preset.double.shape":
    "a winners bracket, the losers bracket that catches everyone it knocks out, and a grand final between them",

  "preset.groups.title": "Groups, then playoff",
  "preset.groups.tag": "Recommended",
  "preset.groups.blurb":
    "Everyone gets a few guaranteed matches, the top two of each group carry on. What most one-day tournaments do.",
  "preset.groups.shape": "{groups}, then {round} for the top two of each",
  "preset.groups.even": {
    one: "{count} group of {size}",
    other: "{count} groups of {size}",
  },
  "preset.groups.uneven": {
    one: "{count} group of {sizes}",
    other: "{count} groups of {sizes}",
  },
  "preset.groups.sizesJoin": " and ",

  "preset.swiss.title": "Swiss rounds",
  "preset.swiss.tag": "Big fields",
  "preset.swiss.blurb":
    "No groups and nobody knocked out. Everyone plays the same number of matches, each one against a team on the same record — win and you meet a winner, lose and you meet somebody who lost. The table sorts itself out, and the top four play it off.",
  "preset.swiss.shape": {
    one: "{count} round for all {teams}, then semi-finals for the top four",
    other: "{count} rounds for all {teams}, then semi-finals for the top four",
  },

  "preset.everyone.title": "Everyone plays everyone",
  "preset.everyone.tag": "Longest",
  "preset.everyone.blurb":
    "One table, no knockout. Every team plays every other and the table decides it — nobody goes home after two matches.",
  "preset.everyone.shape": {
    one: "one group of {teams}, {count} match each, the table decides",
    other: "one group of {teams}, {count} matches each, the table decides",
  },

  "preset.everyoneTwice.title": "Everyone plays everyone twice",
  "preset.everyoneTwice.tag": "Home and away",
  "preset.everyoneTwice.blurb":
    "The same single table, played twice through — every pair meets once each way. The fairest result a day can give, when there is time for it.",
  "preset.everyoneTwice.shape": {
    one: "one group of {teams}, {count} match each, home and away",
    other: "one group of {teams}, {count} matches each, home and away",
  },

  // How far a knockout reaches, said as the round it starts at.
  "round.final": "a final",
  "round.semis": "semi-finals",
  "round.quarters": "quarter-finals",
  "round.of16": "the round of 16",
  "round.of32": "the round of 32",
  "round.of": "a round of {size}",

  // The same rounds, as a heading over a bracket column.
  "bracket.final": "Final",
  "bracket.semis": "Semi-finals",
  "bracket.quarters": "Quarter-finals",
  "bracket.round16": "Round of 16",
  "bracket.round32": "Round of 32",
  "bracket.roundOf": "Round of {size}",
  "bracket.thirdPlace": "Third place",

  "duration.minutes": "{minutes} min",
  "duration.hours": "{hours} h",
  "duration.hoursMinutes": "{hours} h {minutes} min",

  // -------------------------------------------------------------------------
  // sports and how a table is worked out
  // -------------------------------------------------------------------------
  "sport.volleyball": "Volleyball",
  "sport.volleyball.hint": "Sets decide it, and no match ends level.",
  "sport.football": "Football",
  "sport.football.hint": "Three for a win, one for a draw.",
  "sport.basketball": "Basketball",
  "sport.basketball.hint": "Two for a win, one for a loss, and no draws.",
  "sport.tennis": "Tennis",
  "sport.tennis.hint": "Sets decide it, and no match ends level.",
  "sport.padel": "Padel",
  "sport.padel.hint": "Sets decide it, and no match ends level.",
  "sport.badminton": "Badminton",
  "sport.badminton.hint": "Sets decide it, and no match ends level.",
  "sport.table_tennis": "Table tennis",
  "sport.table_tennis.hint": "Sets decide it, and no match ends level.",
  "sport.handball": "Handball",
  "sport.handball.hint": "Two for a win, one for a draw.",
  "sport.other": "Something else",
  "sport.other.hint": "Three for a win, one for a draw. Change it later if that is wrong.",
  "wizard.setsLegend": "How many sets?",
  "wizard.setsOf": "Best of {count}",
  "wizard.setsSingle": "A single score decides it",
  "wizard.decidedLegend": "How is a match decided?",
  "wizard.customSportLegend": "Name it",
  "wizard.customSportPlaceholder": "Pickleball, dodgeball, chess…",
  "wizard.customDraws": "Draws allowed",

  "tiebreak.points": "Points",
  "tiebreak.points.hint": "The table's own column.",
  "tiebreak.head_to_head": "Head-to-head",
  "tiebreak.head_to_head.hint": "How the tied teams did against each other.",
  "tiebreak.score_diff": "Score difference",
  "tiebreak.score_diff.hint": "Scored minus conceded.",
  "tiebreak.score_for": "Scored",
  "tiebreak.score_for.hint": "Total scored, however many were let in.",
  "tiebreak.sub_diff": "Point difference",
  "tiebreak.sub_diff.hint": "Across the sets, where sets are kept.",
  "tiebreak.wins": "Wins",
  "tiebreak.wins.hint": "Matches won, ignoring how they were won.",
  "tiebreak.seed": "Seeding",
  "tiebreak.seed.hint": "The order the teams were entered in. Never a tie.",
  "tiebreak.draw": "Drawing lots",
  "tiebreak.draw.hint": "The last resort, decided off the app.",

  // The same criteria named inside a sentence rather than as a row in a list.
  "tiebreak.inline.points": "points",
  "tiebreak.inline.head_to_head": "head-to-head",
  "tiebreak.inline.score_diff": "set difference",
  "tiebreak.inline.score_for": "sets won",
  "tiebreak.inline.sub_diff": "point difference",
  "tiebreak.inline.wins": "wins",
  "tiebreak.inline.seed": "seeding",
  "tiebreak.inline.draw": "drawing lots",
  "tiebreak.note": "Level on points — separated by {criteria}.",
  "tiebreak.noteList": "{list}, then {last}",

  // -------------------------------------------------------------------------
  // the organiser's board
  // -------------------------------------------------------------------------
  "board.progress": {
    one: "{played} of {count} match in",
    other: "{played} of {count} matches in",
  },
  "board.screen": "Screen",
  "board.setUp": "Set up",
  "board.teams": "Teams",
  "board.scoring": "Scoring",
  "board.crew": "Crew",
  "board.sponsors": "Sponsors",
  "board.tabTodo": "To play",
  "board.tabDone": "Played",
  "board.emptyTodo": "Every match is in.",
  "board.emptyDone": "No results yet — the first one goes in from To play.",
  // The whole line, not a noun and a status glued together: Czech agrees the
  // verb with the number, so "1 result sending" and "3 results sending" are
  // different sentences rather than the same sentence with a different noun.
  "board.queueSending": {
    one: "{count} result sending…",
    other: "{count} results sending…",
  },
  "board.queueOffline": {
    one: "{count} result waiting for a signal",
    other: "{count} results waiting for a signal",
  },
  "board.queueWaiting": {
    one: "{count} result waiting to send",
    other: "{count} results waiting to send",
  },
  "board.sendNow": "Send now",
  "board.stale": "Showing the last board this phone saw.",
  "board.organiser": "Organiser",
  "board.someone": "Someone",
  "board.inviteFailed": "Could not make a join code.",
  "board.groupNamed": "Group {name}",
  "board.live": "{count} live",

  // -------------------------------------------------------------------------
  // one match
  // -------------------------------------------------------------------------
  "match.label": "Match",
  "match.walkover": "walkover",
  "match.walkoverShort": "w/o",
  "match.recorded": "already recorded",
  "match.live": "live",
  "match.liveBadge": "Live",
  "match.enter": "Enter",
  "match.waiting": "Waiting",
  "match.unsent": "On this phone, not sent yet",
  "match.court": "Court",
  "match.court.pitches": "Pitch",
  "match.court.tables": "Table",
  "match.starts": "Starts",
  "match.onCourtNow": "On court now",
  "match.onCourtNow.pitches": "On pitch now",
  "match.onCourtNow.tables": "On table now",
  "match.takeOff": "Take it off",
  "match.takeOff.pitches": "Take it off",
  "match.takeOff.tables": "Take it off",
  "match.onCourtSaved": "On {court} — saved. Tap it again to take it off court.",
  "match.onCourtSaved.pitches": "On {court} — saved. Tap it again to take it off the pitch.",
  "match.onCourtSaved.tables": "On {court} — saved. Tap it again to take it off the table.",
  "match.noCourtYet": "Not on a court yet. Tap one and it is saved straight away.",
  "match.noCourtYet.pitches": "Not on a pitch yet. Tap one and it is saved straight away.",
  "match.noCourtYet.tables": "Not on a table yet. Tap one and it is saved straight away.",
  "match.savesOnTap":
    "Court, time and the points below all save as they are tapped. The result is the one thing that waits for Save.",
  "match.savesOnTap.pitches":
    "Pitch, time and the points below all save as they are tapped. The result is the one thing that waits for Save.",
  "match.savesOnTap.tables":
    "Table, time and the points below all save as they are tapped. The result is the one thing that waits for Save.",
  "match.clash": "{team} is also down for {code} at {time}{court}.",
  "match.clashCourt": " on {court}",
  "match.clashCourt.pitches": " on {court}",
  "match.clashCourt.tables": " on {court}",
  "match.save": "Save result",
  "match.noShow": "Somebody didn't turn up",
  "match.clear": "Clear the result",
  "match.clearing": "Clearing…",
  "match.clearAsk": "Take this result off?",
  "match.clearNote":
    "{home} {homeScore}–{awayScore} {away} is deleted, and anything it put into a later round goes back to waiting.",
  "match.keepIt": "Keep it",
  "match.walkoverAsk": "Who takes the win?",
  "match.walkoverNote":
    "No score is recorded. In a group the winner takes the points for a win and nothing else.",
  "match.replaces":
    "Saving replaces the recorded result. The tables and anything seeded from them are rebuilt.",
  "match.setInPlay":
    "Set {number} is still in play, so it is not counted above. Saving ends the match and records {home}–{away}.",
  "match.bestOf": {
    one: "Best of {bestOf}: the match goes to whoever wins a set.",
    other: "Best of {bestOf}: the match goes to the first side to win {count} sets.",
  },
  "match.notOverYet": {
    one: "{home}–{away} does not end a best of {bestOf} — it is won at a set.",
    other: "{home}–{away} does not end a best of {bestOf} — it is won at {count} sets.",
  },
  "match.tooManySets": {
    one: "A best of {bestOf} is over at a set, so it cannot end {home}–{away}.",
    other: "A best of {bestOf} is over at {count} sets, so it cannot end {home}–{away}.",
  },
  "match.thatIsTheMatch": "That is the match: {home}–{away} to {name}.",
  "match.scoreFor": "Score for {name}",
  "match.oneFewerFor": "One fewer for {name}",
  "match.oneMoreFor": "One more for {name}",

  "sets.title": "Points in each set",
  "sets.add": "Add a set",
  "sets.number": "Set {number}",
  "sets.inPlay": "in play",
  "sets.remove": "Remove set {number}",
  "sets.sideLabel": "{name}, set {number}",
  "sets.oneFewer": "One fewer, {label}",
  "sets.oneMore": "One more, {label}",
  "sets.empty":
    "Optional, and saved as they are entered rather than with the result. Fill them in and the score above is counted from them, the tiebreak has the numbers it needs, and the wall shows the match set by set while it is on.",

  "history.entered": "entered {score}",
  "history.changed": "changed {was} to {now}",
  "history.cleared": "cleared {was}",
  "history.aWalkover": "a walkover",

  // -------------------------------------------------------------------------
  // who is playing
  // -------------------------------------------------------------------------
  "teams.label": "Teams",
  "teams.who": "Who is playing",
  "teams.intro":
    "Taking a team out closes every match they have left and rebuilds the tables. It can be undone.",
  "teams.isOut": "{name} is out",
  "teams.hasLeft": {
    one: "They have {count} match left. What happens to them is not the same question as what happens to the {name} results already on the sheet.",
    other:
      "They have {count} matches left. What happens to them is not the same question as what happens to the {name} results already on the sheet.",
  },
  "teams.nothingLeft":
    "They have played everything they were down for, so this only decides whether those results still count.",
  "teams.forfeitTitle": "They forfeit the rest",
  "teams.forfeitBody":
    "What they played stands. Every match they have left is a walkover to whoever was due to face them. Right when a team leaves late in the day.",
  "teams.voidTitle": "Strike their results",
  "teams.voidBody":
    "Every match they were ever in comes out of the table, for their opponents too. Right when a team pulls out early, so nobody is ranked on having happened to play them.",
  "teams.neverMind": "Never mind",
  "teams.outStruck": "Out · results struck",
  "teams.outForfeited": "Out · forfeited the rest",
  "teams.toPlay": {
    one: "{count} to play",
    other: "{count} to play",
  },
  "teams.putBack": "Put back",
  "teams.out": "Out",
  "teams.add": "Add",
  "teams.adding": "Adding…",
  "teams.addLabel": "Name of the team joining",
  "teams.addPlaceholder": "A team who has just turned up",
  "teams.addHint":
    "They go into the group with the least to catch up on and play everybody already in it. A knockout that has been played will not take one.",
  "teams.addDuplicate": "{name} is already playing.",
  "teams.joinedPool": {
    one: "{name} is in group {pool}, with {count} match to play.",
    other: "{name} is in group {pool}, with {count} matches to play.",
  },
  "teams.joinedField": "{name} is in, and will be drawn into the next round.",
  "teams.joinedRedrawn": "{name} is in, and {stage} has been drawn again.",
  "teams.joinedWaiting": "{name} is in, and will be in the draw when it is made.",

  // -------------------------------------------------------------------------
  // the crew
  // -------------------------------------------------------------------------
  "crew.label": "Crew",
  "crew.title": "Who is running this with you",
  "crew.intro":
    "Everyone here can enter results from their own phone. The role is who they are, not what they are allowed to touch.",
  "crew.empty": "Nobody yet — you are running this on your own.",
  "crew.add": "Add someone",
  "crew.referee": "Referee",
  "crew.refereeHint": "Runs matches and enters results.",
  "crew.scorer": "Scorer",
  "crew.scorerHint": "Keeps score, set by set.",
  "crew.organizer": "Co-organiser",
  "crew.organizerHint": "Runs the day alongside you.",
  "crew.scanThis": "Just scan the QR code — no registration required.",
  "crew.pickRole": "Pick what they will be doing and a code appears.",
  "crew.replace": "Replace code",
  "crew.working": "Working…",
  "crew.replaceNote":
    "Replacing it stops the old one working. Anyone already on the list stays — they came through the door, they are not it.",
  "crew.removeMember": "Remove {name}",
  "crew.thisPerson": "this person",

  // -------------------------------------------------------------------------
  // what the wall shows
  // -------------------------------------------------------------------------
  "screen.label": "Screen",
  "screen.fallbackName": "Screen",
  "screen.savedAsYouTap":
    "Saved as you tap, and the wall follows within a moment — it is the preview.",
  "screen.rotation": "What it shows, in order",
  "screen.move": "Move {name}",
  "screen.onePanel": "One panel, so the screen stays on it. The credit runs last.",
  "screen.dragToReorder": "Drag a handle to reorder. The credit runs last.",
  "screen.emptySkipped": "A panel with nothing to show is skipped on its own.",
  "screen.notShown": "Not shown",
  "screen.tapToRestore": "Tap one to put it back at the end.",
  "screen.dwell": "Each panel stays",
  "screen.dwellSeconds": "{seconds}s",
  "screen.onlyShow": "Only show",
  "screen.everyStage": "Every stage",
  "screen.everyGroup": "Every group",
  "screen.everyCourt": "Every court",
  "screen.everyCourt.pitches": "Every pitch",
  "screen.everyCourt.tables": "Every table",
  "screen.stage": "Stage",
  "screen.group": "Group",
  "screen.scopeNote":
    "A second screen by the door showing one court is what this is for. The main wall wants all of it.",
  "screen.scopeNote.pitches":
    "A second screen by the door showing one pitch is what this is for. The main wall wants all of it.",
  "screen.scopeNote.tables":
    "A second screen by the door showing one table is what this is for. The main wall wants all of it.",
  "screen.colour": "Colour",
  "screen.accent": "Accent colour",
  "screen.reset": "Reset",
  "screen.ground": "Background",
  "screen.groundLight": "Light",
  "screen.groundDark": "Dark",
  "screen.groundNote":
    "A projector has no black — with the hall lights on, a dark screen goes grey and the text goes with it. Dark is for a room that has been dimmed.",

  // -------------------------------------------------------------------------
  // who is on the closing panel
  // -------------------------------------------------------------------------
  "sponsors.label": "Sponsors",
  "sponsors.title": "Who's on the closing panel",
  "sponsors.intro":
    "Shown on the wall's last panel once your subscription is active. A name is enough to add one — a logo can follow later.",
  "sponsors.empty": "No sponsors yet.",
  "sponsors.addName": "Sponsor name",
  "sponsors.addTier": "Main partner, official ball…",
  "sponsors.addLogo": "Add a logo",
  "sponsors.add": "Add",
  "sponsors.adding": "Adding…",
  "sponsors.addHint": "PNG, JPG, SVG or WebP, up to 2MB.",
  "sponsors.changeLogo": "Change {name}'s logo",
  "sponsors.moveUp": "Move {name} up",
  "sponsors.moveDown": "Move {name} down",
  "sponsors.removeSponsor": "Remove {name}",

  "panel.now_playing": "Now playing",
  "panel.now_playing.hint": "The live matches.",
  "panel.stage_progress": "Stage progress",
  "panel.stage_progress.hint": "How far the day has got.",
  "panel.court_schedule": "Court schedule",
  "panel.court_schedule.pitches": "Pitch schedule",
  "panel.court_schedule.tables": "Table schedule",
  "panel.court_schedule.hint": "What is on each court.",
  "panel.court_schedule.hint.pitches": "What is on each pitch.",
  "panel.court_schedule.hint.tables": "What is on each table.",
  "panel.stage_table": "Cross-pool tables",
  "panel.stage_table.hint": "Every group ranked together.",
  "panel.standings": "Group tables",
  "panel.standings.hint": "One panel per group.",
  "panel.bracket": "Bracket",
  "panel.bracket.hint": "The knockout.",
  "panel.next_up": "Next up",
  "panel.next_up.hint": "The matches still to play.",
  "panel.results": "Latest results",
  "panel.results.hint": "What has just finished.",

  // -------------------------------------------------------------------------
  // how the table is worked out
  // -------------------------------------------------------------------------
  "scoring.label": "Scoring",
  "scoring.note":
    "Saved as you tap. Tables are rebuilt when the next result in a group lands, so one already on the wall keeps its points until then.",
  "scoring.sport": "Sport",
  "scoring.byHand": "Set by hand. Tapping a sport puts its own numbers back.",
  "scoring.points": "Points",
  "scoring.win": "Win",
  "scoring.draw": "Draw",
  "scoring.loss": "Loss",
  "scoring.drawsTitle": "Can a match end level?",
  "scoring.drawsAllowed": "Draws allowed",
  "scoring.somebodyWins": "Somebody wins",
  "scoring.draws": "Draws",
  "scoring.drawsYes": "A level score is a result, and both sides take the draw points.",
  "scoring.drawsNo": "A level score is refused when the result is saved.",
  "scoring.drawsTail":
    "A knockout match never ends level either way — somebody has to go through.",
  "scoring.formatTitle": "Sets per match",
  "scoring.oneGame": "One game",
  "scoring.bestOfSets": "Best of {bestOf}",
  "scoring.formatNote": {
    one: "A match is one score, and the match sheet records whatever is entered.",
    other:
      "A match ends when somebody has won {count} sets, and a result that says otherwise is refused.",
  },
  "scoring.walkoverTitle": "A walkover counts as",
  "scoring.score": "Score",
  "scoring.walkoverNote":
    "Credited to whoever turned up. Zero keeps an absence from flattering anyone's score difference; a rulebook that says 3-0 wants 3.",
  "scoring.tiebreakTitle": "When teams are level, rank on",
  "scoring.alwaysFirst": "Always first.",
  "scoring.tiebreakNote":
    "Drag a handle to reorder. Head-to-head is worked out among the tied teams only, from what they played against each other.",
  "scoring.notUsed": "Not used",
  "scoring.oneFewer": "{label}: one fewer",
  "scoring.oneMore": "{label}: one more",

  // -------------------------------------------------------------------------
  // the projector and the phone
  // -------------------------------------------------------------------------
  "projector.connecting": "Connecting…",
  "projector.nothingYet": "{name} — nothing to show yet",
  "projector.reconnecting": "reconnecting",
  "projector.mobileHint": "Live scores on your phone",
  "projector.partners": "Our partners",
  "projector.poweredBy": "Powered by Whistle.day",
  "projector.credit": "Scoring and screens for this tournament",
  "projector.crossPool": {
    one: "Cross-pool ranking — {count} entry shown",
    other: "Cross-pool ranking — {count} entries shown",
  },
  "projector.set": "set {number} · {home}–{away}",
  "projector.versus": "vs",
  "projector.versusShort": "v",

  "phone.offline": "offline",
  "phone.tabLive": "Live",
  "phone.tabGroups": "Groups",
  "phone.tabBracket": "Bracket",
  "phone.tabResults": "Results",
  "phone.nothingLive": "Nothing is being played right now.",
  "phone.nothingScheduled": "No matches scheduled.",
  "phone.noResults": "No results yet.",

  // -------------------------------------------------------------------------
  // names the app wrote into the database
  // -------------------------------------------------------------------------
  // Slot labels: what a bracket position says before anybody has qualified for
  // it. The server stores the kind and the arguments; these are the wording.
  "label.bye": "Bye",
  "label.tbd": "TBD",
  "label.winner_of": "Winner {code}",
  "label.loser_of": "Loser {code}",
  "label.pool_seed": "{pool}{position}",
  "label.pool_rank": "{rank}. {pool}",
  "label.best_of_rank": "{index} best {place}",

  // Pool names the generator writes. Group pools are called "A" and "B", which
  // is the same in every language and so has no key.
  "pool.main": "Main",
  "pool.winners": "Winners",
  "pool.losers": "Losers",
  "pool.final": "Final",
  "pool.consolation": "Consolation",
  "pool.swiss": "Swiss",

  // Stage names the wizard writes.
  "stage.groups": "Groups",
  "stage.group": "Group",
  "stage.playoff": "Playoff",
  "stage.swiss": "Swiss",
  "stage.double_elim": "Double elimination",

  // The screen the wizard opens.
  "display.mainScreen": "Main screen",

  // English ordinals, for "1st best 3rd". Czech writes "1." and needs none of
  // this, which is why the ordinal is formatted rather than concatenated.
  "ordinal.one": "{n}st",
  "ordinal.two": "{n}nd",
  "ordinal.few": "{n}rd",
  "ordinal.other": "{n}th",
} satisfies Record<string, Message>;
