import type { Message } from "../lib/i18n";

/**
 * Every sentence the app says, in English.
 *
 * This file is the shape: `cs.ts` is typed against it, so a key added here
 * without a Czech form is a compile error rather than an English sentence
 * turning up in the middle of a Czech screen. Keys are `area.thing`, and the
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
  // landing
  // -------------------------------------------------------------------------
  "landing.tagline": "Run a tournament off a phone and put it on the wall.",
  "landing.resume": "Back to {name}",
  "landing.setUp": "Set up a tournament",
  "landing.signIn": "Sign in",
  "landing.howTitle": "How it works",
  "landing.step1Title": "Set it up",
  "landing.step1Body":
    "Name your tournament, add the teams, pick the format. Done in under a minute — no account needed.",
  "landing.step2Title": "Run the day",
  "landing.step2Body":
    "Put matches on courts, mark what is being played, enter results as they come in. All from your phone.",
  "landing.step3Title": "Put it on the wall",
  "landing.step3Body":
    "A projector screen that updates itself — tables rebuild, the bracket fills in, the next Swiss round draws itself.",
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
    "Every round pairs like with like. No elimination — every team plays every round.",
  "landing.screenTitle": "Open a screen",
  "landing.screenNote":
    "Enter the token from the QR code by the door, or from the organiser screen.",
  "landing.tokenPlaceholder": "screen token",
  "landing.projector": "Projector",
  "landing.phone": "Phone",
  "landing.footer": "Whistle.day — free and open-source tournament organiser.",

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
  "wizard.courtsHint":
    "Matches run on all of them at once, so this is what decides how long the day takes.",
  "wizard.courtsNext": "How it's played",
  "wizard.courtsDefaultName": "Court {number}",
  "wizard.courtsFewer": "One fewer court",
  "wizard.courtsMore": "One more court",
  "wizard.courtsDuplicate": "Two courts have the same name.",
  "wizard.courtsBlank": "Every court needs a name.",

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
  "wizard.doneEnterResults": "Start entering results",
  "wizard.doneOpenProjector": "Open the projector screen",
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
  "sport.other": "Something else",
  "sport.other.hint": "Three for a win, one for a draw. Change it later if that is wrong.",

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
  "match.starts": "Starts",
  "match.onCourtNow": "On court now",
  "match.takeOff": "Take it off",
  "match.onCourtSaved": "On {court} — saved. Tap it again to take it off court.",
  "match.noCourtYet": "Not on a court yet. Tap one and it is saved straight away.",
  "match.savesOnTap":
    "Court, time and the points below all save as they are tapped. The result is the one thing that waits for Save.",
  "match.clash": "{team} is also down for {code} at {time}{court}.",
  "match.clashCourt": " on {court}",
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
  "crew.scanThis": "Have them scan this — there is nothing to sign up for.",
  "crew.pickRole": "Pick what they will be doing and a code appears.",
  "crew.replace": "Replace this code",
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
  "screen.stage": "Stage",
  "screen.group": "Group",
  "screen.scopeNote":
    "A second screen by the door showing one court is what this is for. The main wall wants all of it.",
  "screen.colour": "Colour",
  "screen.accent": "Accent colour",
  "screen.reset": "Reset",

  "panel.now_playing": "Now playing",
  "panel.now_playing.hint": "The live matches.",
  "panel.stage_progress": "Stage progress",
  "panel.stage_progress.hint": "How far the day has got.",
  "panel.court_schedule": "Court schedule",
  "panel.court_schedule.hint": "What is on each court.",
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
