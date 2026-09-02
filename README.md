# Whistle.day

Tournament organiser with arbitrary stage ordering — groups, playoff, Swiss, in
any sequence — and a public projector view.

**Status: a whole tournament runs off a phone — or off as many phones as there
are courts.** Name it, say what is being played, add the teams one by one, pick
how the day should run, and you get a link and a QR code. Then run the day: put matches on courts, mark
what is being played, and enter results as they come in. The tables rebuild,
the playoff seeded from them fills itself in, the next Swiss round draws
itself, and the wall keeps up on its own. Hand a referee a second QR code and
they run their court from their own phone.

The repository, the package scope (`@seedly/engine`), the Go module and the
local superuser are all still on the project's old name. Renaming them is a
day's mechanical work with nothing to learn from it, so it is outstanding
rather than done; nothing below reads on it either way.

```
seedly/
├── docs/DATA-MODEL.md       ← start here
├── backend/                  PocketBase as a Go framework
│   ├── migrations/           the schema
│   └── internal/tournament/  generation, standings, slot resolution
├── packages/engine/          shared TypeScript types (no logic)
└── scripts/smoke.ts          end-to-end check against a live server
```

## The data model in one sentence

A tournament is an ordered list of **stages**; each stage has **slots**
(positions that learn their participant later) and **fixtures** between them.
Rationale and trade-offs in [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

## Requirements

| | |
|---|---|
| Go | 1.27+ — the floor is PocketBase's, not ours |
| Bun | 1.4.0 — pinned in `.bun-version` and `packageManager` |
| PocketBase | v0.40.1, as a Go dependency — not a downloaded binary |

PocketBase is used as a **Go framework**. `go build` produces a server with the
tournament logic compiled in. Its JS hooks run in goja, which has no npm and no
Node APIs, and this logic needs real transactions and real tests.

The Go floor is a hard one: PocketBase v0.40 moved to `encoding/json/v2`, which
needs 1.27. `backend/go.mod` says `go 1.27` and there is no `toolchain` line, so
the default `GOTOOLCHAIN=auto` fetches it on the first build and an older Go on
the path is not a problem worth solving by hand.

## Getting started

```bash
bun install
bun run pb:build      # compile backend/pocketbase
bun run pb:migrate    # apply the schema
bun run pb:superuser  # admin@seedly.local / seedlyadmin1
```

Then, in three terminals:

```bash
bun run pb:serve   # backend + admin UI on :8090
bun run seed       # a demo tournament: 8 teams, groups, a live semi-final
bun run web        # screens on :5173
```

- Set one up — <http://localhost:5173/new>
- Projector — <http://localhost:5173/display/hala-1>
- Phone — <http://localhost:5173/m/hala-1>

Re-running `bun run seed` replaces the demo rather than adding a second one.

## Screens

| Route | For |
|---|---|
| `/new` | The organiser: name, sport, teams, courts, format, and a link for the wall. |
| `/t/:id` | Running the day: courts, times, what is live, a score for each, how the day is scored, and how the wall is set up. |
| `/join/:token` | The other end of a crew QR code: say who you are, tap once, start refereeing. |
| `/account` | Put an email on the device account, or sign in on another device. |
| `/display/:token` | The projector: unattended, rotates itself, read from across a hall. |
| `/m/:token` | A phone: tabs, scrolling, one person looking for one thing. |

They are separate routes because they share almost nothing but data — see
[apps/web/README.md](apps/web/README.md).

## Checks

```bash
bun run check   # typecheck + go vet/test + smoke
```

| Command | What it covers |
|---|---|
| `bun run typecheck` | TypeScript 7 |
| `bun run web:test` | 20 tests over the offline queue's collapse and overlay rules |
| `bun run pb:test` | `go vet` + 129 unit tests: generators, pairing, tiebreaks, outcomes |
| `bun run smoke` | 194 assertions against a real PocketBase on a temp data dir |

The smoke run is the one that matters. It boots the server, generates a
two-pool group stage and a playoff seeded from it, plays every group fixture
over the REST API, and asserts that the tables, the bracket and the projector
payload all come out right. It then plays a double elimination and a Swiss
stage out to the end, which is the only way to find out whether a bracket
deadlocks or a round ever fails to draw itself.

## How a tournament runs

```bash
# 1. groups
POST /api/stages/{groups}/generate?dry_run=1   # preview the draw
POST /api/stages/{groups}/generate             # commit it

# 2. playoff, seeded from the groups
#    stages.config = { "seedFrom": { "stage": "<groups>", "advancePerPool": 2 } }
#    add "bestOfNext": 4 to take the best four third-placed teams as well
POST /api/stages/{playoff}/generate

# 3. play. Nothing else to call — closing a fixture does the rest, including
#    drawing the next round of a Swiss stage.
#    This is the one write /t/:id makes.
PATCH /api/collections/fixtures/records/{id}
      { "status": "finished", "home_score": 2, "away_score": 0 }

# 4. put it on the wall
GET /api/display/{token}
```

Closing a fixture triggers the whole chain: derive the winner from the score,
push it into the slots that name the fixture as their source, recompute the
pool tables, and — once a pool is complete — fill the playoff slots waiting on
its final positions.

### Endpoints beyond the collection API

| | |
|---|---|
| `POST /api/stages/{stage}/generate` | Generate pools, slots and fixtures. `?dry_run=1` returns the plan without writing, so preview and commit run the same generator. Refuses to overwrite played fixtures. |
| `POST /api/stages/{stage}/resolve` | Re-resolve a stage. The repair path for corrected scores and for slots written after the fixture they source from. Idempotent. |
| `POST /api/stages/{stage}/pair` | Draw a Swiss stage's next round. Normally unnecessary — finishing a round is what draws the next one — so this is the repair path. Idempotent; answers `{"round": -1}` when there is nothing to draw, and `rematch: true` when the field had run out of fresh opponents. |
| `POST /api/entries/{entry}/withdraw` | Take a team out. `policy` is `forfeit` or `void` and has no default. Closes everything they had left and retallies every stage in one transaction. |
| `POST /api/entries/{entry}/reinstate` | Put one back, undoing exactly what taking them out did and nothing else. |
| `GET /api/staff/invite/{token}` | What a join code is for — a name and a role, nothing else. Public, so the join screen can say what is being accepted before anyone accepts it. |
| `POST /api/staff/join` | Accept one, as whoever is signed in on this device. Idempotent; re-scanning a different role's code changes the role rather than adding a second row. |
| `GET /api/display/{token}` | The whole projector screen in one response. Public — the token is the only credential. Read it with `If-None-Match`; an unchanged tournament answers 304. |
| `GET /api/realtime` | PocketBase's stream. A screen subscribes to `tournament/{id}` and is told when to re-read the line above — the nudge carries no data of its own. |

## Behaviour worth knowing about

- **English and Czech, and the wall can be aimed at one of them.** Every screen
  reads in either, with no i18n dependency — two typed catalogues in
  `apps/web/src/locales/` and twenty lines of interpolation, because
  `Intl.PluralRules` already knows Czech's four plural forms. `cs` is typed
  against `en`, so a missing key is a compile error rather than a dotted path
  on a wall. A `?lang=cs` on a link wins over what the browser prefers, which
  is the only way to aim a projector: the laptop driving it is as likely as not
  to be in English, and the hall is not.
- **The names the app wrote travel as facts, not sentences.** "Winner QF1" is
  composed hours before it is read, and a projector cannot translate prose —
  only look a message up. So a slot stores its kind and its arguments beside
  the English, and whoever draws it does the wording. What a person typed — a
  tournament, a team, a court — has no kind and is never touched.
- **The sport is the only scoring question anybody is asked.** Three points for
  a win with a draw possible is right for football and wrong for every sport
  played in a hall, so the wizard asks what is being played on the same screen
  as the name — one tap, with a right answer already selected — and the points,
  the walkover credit and the tiebreak order follow from it. What follows is
  still editable, from "Scoring" on `/t/:id`, because a league that plays for
  two points is not a preset going wrong. `tournaments.scoring` is what all of
  it writes, and the server has always read it; until now nothing but a
  hardcoded default ever wrote it.
- **A level score is refused where a level score is not a result.** Two cases,
  and only one of them is a rulebook's. A tournament whose scoring says
  `drawsAllowed: false` will not store one, because the alternative is a table
  quietly crediting a draw in a sport that has none. A knockout will not store
  one whatever its scoring says, because somebody has to go through — a level
  score there leaves `winner` empty, and the first anyone knows is a projector
  still showing "Winner SF1" an hour after SF1 was played. The field is a
  pointer on the wire: absent means draws are fine, which is what every
  tournament written before it existed meant.
- **A result is recorded on the phone before it is sent.** A hall's wifi drops
  for a minute at a time and nobody is going to stop scoring while it comes
  back, so every write from the match sheet goes into a durable queue and is
  sent from there. The sheet closes on the tap rather than on a round trip,
  which is what a person standing at the side of a court was owed anyway, and
  happens to be the only thing available when the signal has gone. What is
  queued is the intent rather than the request — "2–0, with these sets" — so
  replaying it runs the same write as the online path, with the read it depends
  on back in place. A match rescored three times offline drains as one write,
  and the queue stops at the first failure so the server never sees the second
  of two results without the first.
- **Offline, a result closes its own match and nothing else.** No slot is
  filled, no pool table rebuilt, no playoff place promoted — all of that is the
  server's, derived from every fixture at once, and a client guessing at it
  would be wrong exactly where this system can least afford it. So the bracket
  stands still until the queue drains, which is the truth of the situation
  rather than a picture of one. The organiser's screen also keeps the last
  board it saw, so a reload mid-outage is a match list rather than an error.
  Taking a team out is deliberately *not* queued: it decides who gets drawn
  into the next Swiss round, and one sitting in a queue for ten minutes is a
  round paired around somebody who has already gone home.
- **Corrections re-propagate.** Editing a score hours later reruns the chain,
  including the tables. Standings are recomputed from scratch rather than
  accumulated, because incremental accumulation is exactly where a corrected
  score produces a table that no longer matches its own fixtures.
- **Byes settle themselves.** A fixture whose opponent slot is a *declared* bye
  is decided as soon as the other side is known. A slot merely waiting on an
  earlier result looks identical, so the distinction is explicit.
- **A Swiss round draws itself when the one before it finishes**, from the
  table as it stood at that moment and never from the round being drawn. Only
  round one is written up front, because the rest of them are not knowable yet.
  Correcting a result redraws the round it fed — but only while nothing from
  that round onwards has been played, since matches cannot be unplayed to match
  a corrected table.
- **A Swiss bye scores; a bracket bye does not.** They are the same record and
  mean opposite things: a free pass to the next round, versus the round itself.
  Scoring the second one zero would send whoever sat out to the bottom of the
  table for having been the odd one out, so it takes the points for a win.
- **Playoff slots wait for a complete pool.** A table is provisional until
  every fixture in the pool is settled, and promoting a provisionally-first
  team into the bracket would be the worst bug this system could have.
- **Head-to-head is computed among the tied group only**, from the fixtures
  those entries played against each other — which is why ranking is recursive
  rather than one comparator chain.
- **A stage has a table as well as its pools**, for the one question a pool
  table cannot answer: which of the third-placed teams were the best. It runs
  tier by tier — every pool's winner, then every runner-up, then every third —
  so a runner-up never outranks a winner, and positions 9..12 of a four-pool
  stage *are* the third places. Within a tier, results against anyone finishing
  below the smallest pool's last place are disregarded, so teams out of a pool
  of four and a pool of three are compared over the same number of matches.
- **The rotation closes on a credit.** Every screen ends on a "Powered by
  Whistle.day" panel, and on the sponsor slots from `displays.theme.sponsors` as
  well while `users.subscription_until` on the tournament's owner is still in
  the future. The filtering is the server's: an unsubscribed tournament sends
  no sponsors at all, so there is nothing on a public endpoint for a screen to
  un-hide, and no account can sell itself the upgrade — the date sits on a
  record its owner may otherwise write, so a hook refuses that write.
- **A team going home is two questions, not one.** Whether they are still *in*
  decides what happens next — who gets drawn into the next Swiss round, whose
  remaining fixtures are still going to be played. Whether their results
  *count* decides what the table says about everyone else. `forfeit` answers
  the first and not the second: what they played stands, and everything left is
  a walkover to whoever was due to face them. `void` answers both: every match
  they were ever in comes out, for their opponents too, which is the honest
  answer when somebody pulls out mid-group and half the pool has played them
  and half has not. Neither is a default worth guessing at, so the server
  refuses a withdrawal that does not say which. Keeping the two sets apart is
  what stops the obvious bug — a withdrawn team quietly paired into round four
  because the code that drew it only knew about the ones whose results had been
  struck.
- **A Swiss round already drawn is not torn up.** Their match in it becomes a
  walkover to the opponent; the rounds after it are drawn from a table they are
  no longer in. A pairing that has been published and put on court is not
  improved by being redrawn around the person who left.
- **Taking a team out is reversible, exactly.** `fixtures.forfeited_by` records
  that a fixture was settled by somebody's exit rather than by anybody playing.
  Reversing by shape instead — clearing every scoreless walkover involving them
  — would also wipe a walkover the organiser recorded deliberately an hour
  earlier, which is a real result destroyed by an undo that was only asked to
  fix a mis-tap.
- **A crew joins by QR, and claims by email.** The referee is standing next to
  the organiser, so the invitation is something held up and scanned: proximity
  is the authentication, and anyone close enough to scan the code is someone
  already being handed a court. There is one code per role rather than per
  person — typing names into a phone in a hall is the friction the code exists
  to avoid — and the name is asked for at the far end, by the person who knows
  it. It lands on the `staff` row rather than the account, because the users
  collection lets an account view itself and nobody else, so an owner holding
  a complete log of who changed which result could otherwise render none of
  those names. Email is the upgrade, not the entry: a referee who works every
  weekend claims their device account at `/account` and signs in anywhere,
  which is the same bargain the organiser's own account makes.
- **Minting an invite is owner-only, and deliberately not `staffOnly`.** An
  invite mints staff, so anything looser would be a way around `staff`'s own
  owner-only create rule — a scorer who could write there could issue
  themselves an organiser token. The cost is that a co-organiser cannot invite
  anyone, which is the right way round for that mistake to fall.
- **Every fixture side is renderable.** When a slot has no entry yet the
  projector payload sends its label instead — "Winner SF1", "1. A", "TBD" — so
  a screen never has to draw a blank box.

## Generation lives on the server

The generators used to be duplicated in TypeScript so the browser could preview
a draw without a round trip. They are now Go only, and preview goes through
`?dry_run=1`. Two implementations of bracket seeding is how brackets drift;
`packages/engine` is types only.

## What is not built yet

1. **Ladder.** `stages.format` accepts it and nothing generates it. Round
   robin, single and double elimination and Swiss all do.
2. **A best-of-next bracket can draw two teams from one pool together.** The
   ordinary qualifiers are laid out so that cannot happen; which pools the
   best-of-next teams come from is not known until the groups have been played,
   and the bracket is drawn before that. Competitions that care fix it with a
   published table of every possible combination.
3. **Schedule conflicts are surfaced, not prevented.** The organiser is warned
   when a team is already down for another match at the same time; nothing
   stops them going ahead, because reshuffling a schedule passes through
   states that are briefly wrong on purpose.
4. **Nobody can be *added* once a stage is generated.** Taking a team out is
   built — see the withdrawal note above — but putting a new one in is not.
   The wizard takes the teams and the generator takes them all, so a late
   arrival still means starting the draw again. It is the harder half: adding
   to a drawn round robin means extending a pool or byeing it, and adding to a
   bracket is worse.
5. **Roles are recorded, not enforced.** `staff.role` is set by which code
   someone scanned and shown in the crew list, and every crew member can do
   everything `/t/:id` offers. The distinction that *is* enforced is owner
   versus crew: handing out codes and removing people are the owner's alone.
6. **Nothing sells a subscription.** `users.subscription_until` is what the
   sponsor slots read, and the only things that set it are an admin and
   whatever writes the record server-side. There is no checkout, no provider
   and no webhook.
7. **`scoring.bestOf` is written and never read.** The sport presets store it —
   3 for volleyball, 1 for everything else — and no Go code has a field for it,
   so nothing knows a match is over when a side has won two sets. The match
   sheet counts the sets that were entered and the organiser decides when to
   save. Making it real means the sheet ending a match on its own and refusing
   a result that does not match the format, which reaches into the set-by-set
   entry path rather than sitting beside it.
