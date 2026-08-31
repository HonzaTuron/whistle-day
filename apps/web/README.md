# @seedly/web

Two public screens, and the two the organiser drives them from.

| Route | For |
|---|---|
| `/new` | The organiser setting a tournament up, on a phone, in a hall. |
| `/t/:id` | Running the day: the match list, and a score for each. |
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
- **The poll is still there, at 60s.** A stream through a venue's wifi is not a
  thing to bet a tournament on, and its failure is the quiet one: the socket
  looks open and stops delivering. A minute is far too slow to run a hall on
  and far too fast to leave a wall wrong for the rest of the day.
- Every read sends `If-None-Match`, so an unchanged tournament costs a 304.
- On a failed request the last good payload stays on screen and is marked
  stale. A blank projector in a sports hall is worse than a slightly old one.
- A 404 stops the reading and closes the stream: a bad token will not fix
  itself.

Reconnecting is the browser's job — `EventSource` retries on its own — but a
new connection is a new PocketBase client id with no subscriptions on it, so
the screen subscribes on every `PB_CONNECT` rather than once.

Vite proxies `/api` to `127.0.0.1:8090`, so the screens and the API are
same-origin and the token in the URL is all that is ever needed.

## Running it

```bash
bun run pb:serve   # terminal 1 — backend on :8090
bun run seed       # terminal 2 — a tournament worth looking at
bun run web        # terminal 3 — http://localhost:5173
```

Then open `http://localhost:5173/display/hala-1` or `/m/hala-1` — or
`/new` to set a tournament up from scratch.

## Setting a tournament up

`/new` is four questions and a QR code: a name, the teams one at a time, how
many courts, and how the day should run. Three things about it are worth
knowing before changing it.

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
- **Un-settling a fixture clears propagation.** Changing a settled fixture back
  to "ready" or "pending" clears every downstream slot that sourced its entry
  from it — the brackets unroll. Change the score instead, or flip the status
  and the slots follow.

Every change to a result is logged, and the sheet shows the log for the match
it is open on — but only when there is something to say. A match entered once
and left alone shows nothing, because the row above it already says what the
score is. The line that matters is the second one: "changed 3–1 to 2–4".

## Notes on the projector

- **Empty panels are dropped, not shown blank.** A hall with no live match
  should not stare at an empty "Now playing" for fifteen seconds.
- **Unresolved bracket slots show their label** — "Winner SF1", "1. A" — in
  italic grey. The server words these; the client never invents them.
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
