# @seedly/web

Two public screens, and the two the organiser drives them from.

| Route | For |
|---|---|
| `/new` | The organiser setting a tournament up, on a phone, in a hall. |
| `/t/:id` | Running the day: the match list, a score for each, and how the day is scored. |
| `/account` | Claiming the device account, and signing in on another device. |
| `/display/:token` | The projector: unattended, rotates itself, read from across a hall. |
| `/m/:token` | A phone: held by one person looking for one thing. |
| `/` | Start a tournament, or paste a token to open a screen. |

## Why two routes and not one responsive layout

They share almost nothing but data. A projector cycles panels on a timer, is
driven by nobody most of the day, and is sized in `vmin` so it fills a 1280×720
or a 1920×1080 the same way. A phone has tabs, scrolls, and is sized in `rem`.
Collapsing them into one component would mean every layout rule carrying a
"which screen is this" condition.

What they *do* share lives in `src/lib/` and `src/api/` — the payload hook, the
bracket round shape, the tiebreak wording, name formatting. Round titles were
briefly duplicated and immediately drifted: the phone kept labelling the final
round "Semi-finals" after the projector was fixed. That is why `lib/bracket.ts`
exists.

## Data

Everything comes from `GET /api/display/:token` — one request, no auth. See
`src/api/display.ts`.

- **The server says when.** The screen opens `GET /api/realtime`, subscribes to
  `tournament/{id}` — the id comes from its first payload — and re-reads the
  endpoint whenever the server nudges it. A point tapped at the side of a court
  is on the wall a fifth of a second later, which is what a hall that just
  watched the rally expects of a scoreboard.
- **The nudge carries nothing.** It says there is news; the payload still comes
  from the one endpoint, with one set of rules, one ETag and one place for a
  bug to live. Sending the assembled screen down the socket would be a second
  way to build it and a second way to get it wrong.
- **Nudges are coalesced.** One result is a fixture, two tables and a slot —
  four writes and four nudges — so the read waits 200ms for the burst to end
  and sees a finished state rather than four half-applied ones.
- **A connection is news in itself.** Any `PB_CONNECT` that did not follow a
  fresh read — the browser reopening a dropped stream, or the first one a
  screen that came up on its cache ever gets — triggers a read. Whatever
  happened while there was no socket arrived with no nudge, and a wall marked
  stale would otherwise wear "reconnecting" until the next slow poll. Measured
  on a killed server brought back: two seconds, against thirty-two for the
  poll.
- **A failed stream is rebuilt by the next read that gets through.**
  `EventSource` retries a connection that dropped, but not one that failed —
  a proxy answering 500 while the backend restarts, or a captive portal
  returning its own page, ends that stream for good. So a read that succeeds
  reopens a socket the browser has given up on, and a 304 does it too.
- **The poll is still there, at 60s.** A stream through a venue's wifi is not a
  thing to bet a tournament on, and its failure is the quiet one: the socket
  looks open and stops delivering. A minute is far too slow to run a hall on
  and far too fast to leave a wall wrong for the rest of the day.
- Every read sends `If-None-Match`, so an unchanged tournament costs a 304.
- On a failed request the last good payload stays on screen and is marked
  stale. A blank projector in a sports hall is worse than a slightly old one.
- **A reload with no signal is not a black wall either.** Every payload is kept
  in IndexedDB under its token — `api/cache.ts`, the same file the organiser's
  board cache lives in — and put up immediately on the way in, marked stale
  until the read that follows confirms it. Precaching the shell is what lets a
  projector start from the device; this is what it has to draw once it has.
- The stored tag goes back with the stored payload and never on its own: a tag
  with nothing behind it would earn a 304 with no body and nothing to draw. A
  screen that comes up on the cache also subscribes straight away, since a read
  that answers 304 brings no payload to learn the tournament id from.
- Nothing older than twelve hours is drawn from the cache. This is for the
  reload at eleven o'clock, not for yesterday's finals going back up at nine
  the next morning — a screen with no signal and no fresh board says so.
- A 404 stops the reading, closes the stream and drops the cached payload: a
  bad token will not fix itself, and the board behind a revoked link is not
  that screen's to show on the next reload.

Reconnecting is the browser's job — `EventSource` retries on its own — but a
new connection is a new PocketBase client id with no subscriptions on it, so
the screen subscribes on every `PB_CONNECT` rather than once.

Vite proxies `/api` to `127.0.0.1:8090`, so the screens and the API are
same-origin and the token in the URL is all that is ever needed.

## When the hall has no signal

A sports hall's wifi drops for a minute at a time and its 4G is whatever gets
through a concrete roof, and the organiser is not going to stop scoring while
it sorts itself out. Three pieces, each doing one thing.

**`api/outbox.ts` — the writes.** Every write from the match sheet goes into a
durable queue before the sheet closes and is sent from there. What is queued is
the *intent* — "this match finished 2–0, with these sets" — and not the
request, because `saveGames` reads the rows that exist before deciding whether
to create, patch or delete them, and offline there is nothing to read and no
record id to patch. Replaying an intent runs the ordinary `api/organiser` write
with the read back in place, so there is one write path whether or not there
was a signal.

Two writes to one fixture are collapsed by lane. `result`, `walkover`, `clear`
and `live` all set `status`, so only the last of them means anything — a match
rescored three times offline drains as one write. Court and time are a separate
lane, because moving a match to court two and entering its score twenty minutes
later must both land. The two lanes touch disjoint columns, so their order does
not matter.

The queue sends oldest first and **stops at the first failure**. Two fixtures
in the same pool are not collapsed together, and carrying on past a failure
would send the second and leave the first — a table rebuilt from a pool missing
the earlier of two results it should have had. Draining in order means the
server always sees a prefix of what happened.

**A refusal is not an outage.** A knockout will not store a level score, and
neither will a tournament whose scoring says draws are not a result; both come
back 400. Retrying those forever would leave "1 result waiting" on screen all
afternoon with nothing explaining why, so a 4xx comes out of the queue and goes
in front of the organiser instead. A 401 is the one exception, since the token
expires on its own schedule and re-authenticating fixes it.

**`api/cache.ts` — the reads.** The last board is kept in IndexedDB — in the
same database as the screens' payloads, in a store of its own — and drawn
immediately on the way in, then replaced by whatever the server says. A reload
mid-outage is a match list, not a spinner and then an error. It is a cache and
nothing more: never merged out of, overwritten by every successful load, and
worth one round trip if it is lost.

The two storages are the other way round on purpose. The outbox is a few
hundred bytes and losing it loses a result nobody else has, so it is in
localStorage, which is synchronous and durable before `enqueue` returns. The
board is most of a megabyte with five hundred fixtures expanded, and writing
that synchronously after every result would stutter the one screen that must
never feel slow.

**`lib/pending.ts` — what the organiser sees.** The server's board with the
queue laid over it, composed at render rather than written back into the cache:
a result the server later refuses would otherwise sit in storage looking
recorded forever. Applying an intent touches the fixture's own fields and
nothing else — no slots filled, no pool table rebuilt, no playoff place
promoted. All of that is derived server-side from every fixture at once, and a
client guessing at it would be wrong in the way this codebase least wants to be
wrong: invisibly, until the projector disagreed with the hall. So offline, a
match reads as recorded and the bracket it feeds stands still until the queue
drains. `winner` is the one exception and is display-only — a recorded match
that cannot say who won reads as broken — and the server overwrites it on
arrival.

It is deliberately not a general offline layer. **Taking a team out is not
queued**, because the answer changes who gets drawn into the next Swiss round,
and a withdrawal sitting in a queue for ten minutes is a round paired around
somebody who has already gone home. Neither are join codes, which mint a token
only the server can make, nor the settings sheets, nor the `/new` wizard. Those
still need a signal and say so.

`lib/pending.ts` is pure and is the part with tests — `bun test`.

## Two languages

English and Czech, in `src/locales/`, with no i18n dependency. What a library
would sell us is a message format, a plural table and a loader; the platform
ships the plural table as `Intl.PluralRules` — which knows Czech better than
anything we would paste in — and with two locales in one bundle the loader is a
static import. What is left is interpolation, and that is twenty lines of
`src/lib/i18n.ts`.

The part worth having is the part a library cannot give: `en.ts` is the shape
and `cs.ts` is typed against it, so a key missing from one, or misspelled in a
component, fails the typecheck rather than showing an organiser a dotted path
in a hall.

- **Which language, in the order the answers are trustworthy.** `?lang=cs` in
  the URL, then what this browser was last told, then what it says it prefers,
  then English. The query parameter wins because it is the only way to *aim* a
  screen: the laptop driving a projector in Brno is as likely as not to be in
  English, and the wall should not be. It is remembered once used, so the link
  gets pasted with it on once rather than every reload.
- **The switch is two words, not a dropdown or a flag.** With two languages a
  dropdown is a click to find out what the options are, and a flag is a
  country — the people in a hall in Brno reading this in English are not
  English. It sits where somebody is already stopped and reading: the landing
  page, the account screen, the bottom of the phone view. It is deliberately
  absent from the organiser's board and the projector, which are screens
  somebody is working from.
- **`document.documentElement.lang` is set before the first render**, because a
  document whose lang disagrees with what is on it is read out in the wrong
  accent by a screen reader and hyphenated by the wrong rules. It is also the
  live mirror the few non-component callers read the locale from.
- **Czech is not English with the words swapped.** Four plural categories where
  English has two, and `one` is 1, `few` is 2–4, `other` is 0 and 5 up — a form
  that reads right for 3 does not read right for 5. Nouns after prepositions
  are not nominative, so a phrase that will be dropped into a sentence carries
  its own preposition rather than being glued on by the caller. And a bracket
  is a *pavouk*, a walkover a *kontumace*, seeding *nasazení* — what an
  organiser actually says out loud, not a translation they have to undo.
- **Times are formatted in the screen's language, not the browser's.** A laptop
  set to US English driving a Czech hall's projector should still put the
  schedule up the way the hall reads it.
- **Names the app wrote are translated; names a person typed are not.** A
  tournament, a team and a court are somebody's words and stay exactly as
  typed. A slot saying "Winner QF1" is ours, and arrives as a kind plus its
  arguments for `src/lib/labels.ts` to word — see *Names this app wrote* in
  `docs/DATA-MODEL.md`.

## Installing it

`vite-plugin-pwa` precaches the built assets, so a reload is not a white
screen: a phone in a pocket has its tab evicted, somebody pulls to refresh out
of habit, and on a hall's wifi either of those costs the app until the network
comes back. It also makes the app installable to a home screen, which gets most
of what wrapping it in a native shell would — without an install, a store
review between a fix and the hall, or losing the scan-and-go that `/join/:token`
is built around.

Nothing prompts and nothing reloads. A new build is fetched in the background
and waits (`skipWaiting: false`), and the browser hands over the next time the
app is started with no tab already open. A projector that has been on the wall
since nine o'clock should not reload itself to pick up a deploy.

`/api` is never cached. Writes must not be intercepted — a queued result
answered from a cache would look sent and never arrive — and
`/api/display/:token` is left alone too: it is read with `If-None-Match` and
answers 304, and a cache in the middle of a conditional request is a good way
to pin the wall to a payload from an hour ago. What a projector needs on a
reload is not a cached response but the last payload it drew, which the app
keeps itself and puts up marked stale — see **Data** above. Workbox only
handles what it has a route for, so everything else falls through to the
network exactly as before.

## Running it

```bash
bun run pb:serve   # terminal 1 — backend on :8090
bun run seed       # terminal 2 — a tournament worth looking at
bun run web        # terminal 3 — http://localhost:5173
```

Then open `http://localhost:5173/display/hala-1` or `/m/hala-1` — or
`/new` to set a tournament up from scratch.

## Setting a tournament up

`/new` is four questions and a QR code: a name and what is being played, the
teams one at a time, how many courts, and how the day should run. Four things
about it are worth knowing before changing it.

**The account is created behind the organiser's back.** Every write rule needs
`@request.auth.id`, and a signup form in front of someone holding a clipboard
in a sports hall is where the product would lose them. So `api/organiser.ts`
creates a user with a random address and password and keeps both in
localStorage.

`/account` is the other half of that bargain, offered late — once there is
something worth keeping. `POST /api/organiser/claim` puts a real email and
password on the same user record, which is why the tournament does not move or
change owner. It sidesteps PocketBase's email-change flow because that sends a
confirmation link and a hall laptop has no SMTP; the caller is already
authenticated as the account being claimed, so the request is its own proof. It
refuses on an account that already has an email, or it would be a way to take
over any account whose token leaked.

The same screen signs in, because on a second device it is the same question
from the other end. Opening it never creates an account — only the wizard does
that, and only when there is a tournament to own.

Which of the two it offers first is a guess from what is on the device, and it
guesses wrong for the person whose browser was cleared, who reinstalled, or who
set the tournament up on another phone: they arrive holding the right email and
the right password and are shown the claim form, because this device has an
unclaimed account of its own. A refused claim now puts the form into sign-in
with what was typed still in it and says what the next tap does. It is a tap
and not a silent sign-in, because leaving whatever this device owns behind is
the organiser's decision to make.

**A refused claim does not say why, on either side of the wire.** `email: Value
must be unique.` in a response is an answer to "does this address have an
account here", from a form that anybody can reach without one — asked a few
thousand times, that is a list of the addresses of everyone who runs a
tournament with this. The route returns the same sentence and an empty `data`
whether the address is taken or malformed, with the real error in the log; the
screen shows one sentence for every refusal and offers to sign in regardless,
which is what the person who typed their own address needs and tells a stranger
nothing. The two responses are byte-identical:

```
{"data":{},"message":"That address cannot be used here.","status":400}
```

**It writes as it goes.** The tournament exists as a `draft` from the second
screen onwards, and every team is saved as it is typed. Twenty names held in a
tab that a locked screen can discard is a betrayal that only shows up at the
worst possible moment. A draft answers 404 on `/api/display/{token}`, so
nothing half-built can reach a projector, and the draft id on the device is
what lets the first screen offer to pick it up again.

**The format screen asks about time, not about pools.** The presets in
`lib/presets.ts` are quoted in matches and hours against the teams and courts
actually entered, because "16 matches, about three hours" is the decision an
organiser is really making. Pool counts, Swiss rounds and advancement are
derived from the team count, and a preset only appears once there are enough
teams for it to mean anything.

**The sport is a second question and deliberately not a second screen.** It
sits under the name field as a row of chips, because it is one tap with a right
answer already selected — and because the alternative is a fifth screen asking
about scoring before anybody has a reason to care. It is the only question
about scoring anyone is asked: `lib/scoring.ts` turns the chip into the points,
the walkover credit and the tiebreak order that `tournaments.scoring` carries,
and the server reads that on every result. The default chip is the generic one
rather than the most popular one, since a day quietly scored as volleyball
because nobody tapped anything is worse than one scored as nothing in
particular.

The chip on a *resumed* draft follows the record rather than the other way
round, and `matchSport` matches on the scoring rather than on `sport` — a
volleyball day whose points were edited by hand is no longer the volleyball
preset and should not claim to be.

## Entering results

`/t/:id` is the match list and a score sheet, and it makes exactly one kind of
write: `PATCH /api/collections/fixtures/records/{id}` with a status and two
numbers. Everything downstream — the winner, the bracket, the tables, the
playoff slots waiting on a final position — is the server's, and the screen
reads the whole board back afterwards rather than predicting what changed. One
result can move two tables and fill four slots a stage away; a client guessing
at that would be wrong in ways nobody notices until the projector disagrees
with the hall.

What a row can carry besides a score: a court, a start time, and whether it is
on court right now. `live` is what the projector's "Now playing" panel reads —
every live fixture appears on it, however many there are — so that switch is
what puts a match on the wall. Court and time save on tap rather than with the
result: putting a match on a court is a decision that has already happened by
the time it is recorded, and the score may be an hour away. The sheet says so
in as many words, because a lit chip is otherwise the only evidence that a tap
was a write, and somebody who taps a court and then looks for Save has no way
to tell whether anything happened.

Under the score are the points, set by set, written to `games`. They are
optional and plenty of days are run without them, but they are not decoration:
`standings` sums them into sub_for / sub_against, which is the tiebreak that
separates two teams level on points and on sets, and the projector reads them
to show a live match set by set instead of as a bare 1–1.

They are written as they are entered, not with the result. Somebody standing
at the net tapping a point per rally will not press Save between rallies, and
the wall is the reason to enter them at all: the server nudges every screen
showing this tournament, so a tap here is a scoreline in the hall a moment
later. The last set
gets − and + for exactly that, in the live colour while it is the set on court;
the sets above it are typed, because a + beside a set that finished an hour ago
is an invitation to change a score nobody meant to touch.

Three details in that write worth keeping:

- **The buttons send a step, not a number.** Two taps inside one frame both
  read the value their row was drawn with, so `value + 1` twice means "make it
  19" twice and the second point of the rally is never scored. The count is
  done against what the last tap left behind.
- **It does not go through the board's write-then-reload.** The board shows the
  fixture's score, which points do not change, so reloading seven collections
  per rally would buy nothing. The write is debounced so a held + is one
  request, and flushed when the sheet closes so the last tap is never the one
  that got away.
- **Recording a result cancels whatever is pending.** Save, walkover and clear
  write these rows themselves and know something the timer does not — whether
  the match is over. A debounced write landing after a clear would recreate the
  rows it had just deleted.

Two rules keep them honest:

- **The match score is counted from the points, not typed beside them.** Once a
  set exists the steppers become a read-out. A screen that accepts 2–1 over
  three sets reading 25–20, 22–25, 19–25 is a screen that will eventually put a
  scoreline on a wall the hall can see is wrong.
- **A set is won when it is over, and the last set of a live match is not.**
  18–14 in the third is not a two-set lead; it is a third set somebody is ahead
  in, and the wall says 1–1 while it is being played. Saving is what ends the
  match, so the recorded result counts every set — the sheet says which score
  that will be before the button is pressed.
- **The format says when there is nothing left to enter.** `scoring.bestOf` is
  read now, so a best-of-three ends at two sets: the score steppers stop there,
  "Add a set" stops at the third, and Save is held until the score is one the
  match could have ended on, with the reason where the format line was. The
  server enforces the same rule, and `lib/bestof.ts` is the arithmetic said
  once for both — checking here is not belt and braces, because the result goes
  into a queue that may not drain for ten minutes and a refusal arriving after
  the teams have left is not one anybody can act on.

When the result is saved, the points go before the fixture, because the fixture
write is the one that rebuilds the tables and should be the last thing the
server sees.
Clearing a result and recording a walkover both delete them: sets left behind
by a match that no longer has a result would still be feeding a table it is no
longer part of.

Three consequences worth keeping:

- **A match with an unresolved side is not a disabled button.** It renders as
  text with the slot labels the server wrote — "Winner SF1", "1. A" — and no
  affordance at all, because it is waiting for someone rather than refusing to
  work.
- **Correcting a result runs the same chain as entering one.** The sheet says
  so before it saves. Tables are rebuilt from scratch, and a slot whose ranking
  changed is overwritten, so a score fixed two hours later lands where it would
  have if it had been right the first time.
- **A walkover is an outcome with no score.** The organiser names the winner;
  nothing is invented for the side that did not turn up. Every screen draws it
  as "w/o" through `lib/format.ts` — which exists because each of them used to
  format scores by hand, and the projector duly announced a 0:0 for a match
  nobody played.
- **The start time is the one thing on the sheet that is typed, and a
  half-typed time is not one.** A time input reports `""` until both fields are
  filled, so saving every change — right for the court chips, where a tap is a
  whole answer — wrote a cleared time the moment somebody typed the hour of
  10:45, and handed that empty value straight back to the input, wiping the
  hour they had just typed. `TimeField` holds what is being typed until it is a
  time; the fixture is the truth either side of that, and empty is only sent on
  the way out, because emptied-and-left means taking the time off a match while
  emptied mid-edit means changing it.
- **A level score can come back refused.** In a tournament scored without draws
  and in every knockout, the server will not store one. The sheet stays open
  with the score still in it and the banner carries the server's own sentence,
  which is the point of writing those messages for an organiser rather than for
  a log: "somebody has to go through" is actionable and "validation failed" is
  not.
- **Un-settling a fixture clears propagation.** Changing a settled fixture back
  to "ready" or "pending" clears every downstream slot that sourced its entry
  from it — the brackets unroll. Change the score instead, or flip the status
  and the slots follow.

Every change to a result is logged, and the sheet shows the log for the match
it is open on — but only when there is something to say. A match entered once
and left alone shows nothing, because the row above it already says what the
score is. The line that matters is the second one: "changed 3–1 to 2–4".

## Setting the day's scoring

"Scoring" on `/t/:id` is where the sport stops being a preset: the points, the
walkover credit, whether a match can end level, and the order the tiebreaks run
in. Like the screen sheet it saves on change, and like the screen sheet it
shares `lib/reorder.ts` — the tiebreak order and the panel rotation are the
same drag over a different list, and the round-titles lesson above is why that
is a hook rather than a second copy.

- **It does not re-tally.** `standings` is rebuilt when a result lands, so a
  table already on the wall keeps the points it was built with until the next
  fixture in its pool is settled. The sheet says so rather than firing a
  resolve of every stage off a settings tap, which is a far larger write than
  the one anybody asked for — `POST /api/stages/{stage}/resolve` is the button
  that already means it.
- **The draw column disappears when there are no draws.** A control that can
  only ever be set wrong is worse than one that is not there.
- **Sets per match is here because it now has teeth.** One game, best of three,
  best of five: whichever is picked is what the match sheet counts to and what
  the server will accept. A preset that says best of three is a good guess
  about volleyball and a wrong one about the hall playing single sets all
  morning to get forty teams through, and that hall should not have to argue
  with a Save button. Czech says the format as the sets that win it — "na dva
  vítězné sety" is best of three — so the chip is written from `count` there
  and from `bestOf` in English.
- **Points is drawn in the tiebreak list and cannot be moved.** A table ordered
  by anything before its own points column is not a table, so it is in the list
  for orientation and out of the drag.
- **A points column is a stepper, not a text field.** Nobody types a 3 on a
  phone in a hall, and a number input brings a keyboard up over the sheet. The
  buttons send a step rather than a value, the same way the match sheet's do.

## Setting the screen up

The wall is configured from the results screen — "Set up" beside the "Screen"
link — and every field saves on change, because the wall is the preview: the
server nudges it the moment the write lands, so an organiser standing in front
of the screen with a phone sees what a setting does rather than guessing and
walking over.

- **Which panels and in what order are one list, because they are one
  decision.** The row is the switch; the six-dot grip on the right is the
  handle, far enough from it that reaching for one cannot fire the other.
  Dragging is pointer events rather than HTML5 drag-and-drop, which does not
  exist on touch — and this screen is used on a phone. The same handle takes
  arrow keys, so the order is reachable without a pointer at all.
- **A rotation of one is a pinned screen.** `displays.mode` says the same
  thing in an older way, so the sheet writes `mode: "auto"` whenever it writes
  the list: two fields that can disagree about what is on the wall is one more
  than there should be. A screen pinned through the API still reads correctly
  here — it shows as a rotation with one panel in it.
- **Empty means all of them, in the running order.** An untouched screen
  stores no list, and putting the last panel back stores no list again: a
  default written out is a default that goes stale, and a screen set up today
  would never pick up a panel added next month. The cost is that arranging the
  order *is* saying "this list, this order", so a screen that has been
  arranged will not pick that panel up either. That is the trade an organiser
  is making by arranging it.
- **The closing credit is not in the list.** It ends every rotation and it is
  where the sponsors live, so it is not an organiser's to switch off.
- **A panel with nothing in it was already dropped.** These toggles are for
  the panels that would otherwise have something to show and are not wanted —
  which is worth saying on the screen, or the first thing an organiser does is
  switch off a panel that was never going to appear.

`scope` narrows a screen to one stage, group or court. It is the second screen
by the door, not the main wall.

## Notes on the projector

- **The wall is light; everything else in the app is dark.** A phone is held a
  foot from a face, often at night. A projector cannot throw black — only
  decline to send light — so a dark background arrives as whatever grey the
  hall's lights make of the screen, taking the contrast the palette assumed
  with it. `.screen` redefines the palette tokens and nothing else, so every
  rule under it, and every panel added later, is light without being told. The
  accent and the live orange are darker there than in the app: those values
  were picked to glow on near-black and are a pale wash on white at five
  metres. A per-display `theme.accent` is set inline and still wins.
- **Panels fill the frame, and the type follows how much there is.** Five
  matches at a fixed size left two thirds of the wall empty with the names no
  bigger than they are on a laptop. Rows and table now share the panel's
  height, and `--rows` — passed from the panel, because CSS cannot count its
  own children — scales the type between 2.3vmin and about 4.6vmin: five
  matches are read from the back of a hall, sixteen are a schedule somebody
  walks up to. Both are capped, so one result is a row and not a slab.
- **The padding is overscan.** Projectors bolted to a sports hall ceiling are
  not the ones anybody has calibrated, and the edge of the frame is the part
  they eat.
- **Empty panels are dropped, not shown blank.** A hall with no live match
  should not stare at an empty "Now playing" for fifteen seconds. Courts count
  for this even though they are not fixtures: a day with courts named and
  nothing put on them yet — which is every tournament between the `/new` wizard
  and the first assignment — drew a court schedule with no rows in it, so the
  panel is only in the rotation once some fixture is actually on a court.
- **Unresolved bracket slots show their label** — "Winner SF1", "1. A" — in
  italic grey. The server says which label it is and what goes in it; the
  client does the wording, so the wall says "Vítěz SF1" when the wall is Czech.
  The client never invents one it was not sent.
- **A tie is explained.** When a table needed more than points to rank, the
  criteria that actually separated it are printed underneath. That sentence is
  the difference between a table and an argument.
- **A court's matches are a scoreboard, not a list.** The court schedule's
  columns are fixed widths — code, home, score, away — because each row is its
  own grid, and content-sized columns put every row's score wherever that row's
  names happened to end. A live match shows the sets it has won with the set in
  progress underneath it; a match yet to start shows "vs" rather than the 0–0
  it carries on the wire, which on a wall reads as a goalless draw somebody has
  already played.
- **The rotation bar fills over one panel's dwell time**, so the room can see
  the screen is about to change. Its segments are buttons: clicking one jumps
  to that panel and restarts the dwell, which is how an organiser answers "put
  the pool B table back up" without waiting out the loop. Rotation carries on
  from there — a screen nobody touches again is back to unattended.
- **The rotation closes on a credit**, and on the sponsors when there are any.
  It is the one panel that is never empty, and the one that closes a locked
  mode too — a screen pinned to "now playing" is exactly where a sponsor slot
  is worth having, and a credit that only appears in `auto` is a credit nobody
  sees. A screen with nothing else on it still says "nothing to show yet"
  rather than rotating a logo at an empty hall.
- **The client never checks a subscription.** `payload.sponsors` is already
  filtered by what the tournament's owner is paying for, so the browser is
  never handed something it is trusted to hide. A logo that fails to load falls
  back to the sponsor's name: a broken-image icon at projector size is worse
  than plain type.
