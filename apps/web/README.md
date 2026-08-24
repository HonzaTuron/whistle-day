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

They share almost nothing but data. A projector cycles panels on a timer, has
no interaction, and is sized in `vmin` so it fills a 1280×720 or a 1920×1080
the same way. A phone has tabs, scrolls, and is sized in `rem`. Collapsing them
into one component would mean every layout rule carrying a "which screen is
this" condition.

What they *do* share lives in `src/lib/` and `src/api/` — the payload hook, the
bracket round shape, the tiebreak wording, name formatting. Round titles were
briefly duplicated and immediately drifted: the phone kept labelling the final
round "Semi-finals" after the projector was fixed. That is why `lib/bracket.ts`
exists.

## Data

Everything comes from `GET /api/display/:token` — one request, no auth. See
`src/api/display.ts`.

- Polls every 4s with `If-None-Match`, so an unchanged tournament costs a 304.
- On a failed request the last good payload stays on screen and is marked
  stale. A blank projector in a sports hall is worse than a slightly old one.
- A 404 stops the polling: a bad token will not fix itself.

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

**The format screen asks about time, not about pools.** The three presets in
`lib/presets.ts` are quoted in matches and hours against the teams and courts
actually entered, because "16 matches, about three hours" is the decision an
organiser is really making. Pool counts and advancement are derived from the
team count.

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
the time it is recorded, and the score may be an hour away.

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

## Notes on the projector

- **Empty panels are dropped, not shown blank.** A hall with no live match
  should not stare at an empty "Now playing" for fifteen seconds.
- **Unresolved bracket slots show their label** — "Winner SF1", "1. A" — in
  italic grey. The server words these; the client never invents them.
- **A tie is explained.** When a table needed more than points to rank, the
  criteria that actually separated it are printed underneath. That sentence is
  the difference between a table and an argument.
- **The rotation bar fills over one panel's dwell time**, so the room can see
  the screen is about to change.
