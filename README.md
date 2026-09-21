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

```
whistleday/
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
| PocketBase | v0.40.3, as a Go dependency — not a downloaded binary |

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
bun run pb:superuser  # admin@whistleday.local / whistledayadmin1
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
| `bun run web:test` | 37 tests: the offline queue's collapse and overlay rules, what a match format lets a score end on, and which addresses count as a screen |
| `bun run pb:test` | `go vet` + 161 unit tests: generators, pairing, tiebreaks, outcomes, late entries |
| `bun run smoke` | 215 assertions against a real PocketBase on a temp data dir |

The smoke run is the one that matters. It boots the server, generates a
two-pool group stage and a playoff seeded from it, plays every group fixture
over the REST API, and asserts that the tables, the bracket and the projector
payload all come out right. It then plays a double elimination and a Swiss
stage out to the end, which is the only way to find out whether a bracket
deadlocks or a round ever fails to draw itself.

```bash
bun run stats                 # backend/pb_data/data.db
bun run stats -- /path/to/data.db
```

Not a check — the operating numbers, read out of the database read-only. How
far tournaments got, what people run, field and day sizes, screens, crew,
accounts still living in one browser, and how often a result had to be
corrected. Point it at a copy rather than at a server that is running a
tournament.

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
| `POST /api/entries/{entry}/admit` | Put a team in that was not there when the draw was made. Writes the matches they now owe a group, a seat in a Swiss table, or a bracket drawn again. Idempotent; refuses outright rather than half-applying when a knockout has already been played. |
| `GET /api/staff/invite/{token}` | What a join code is for — a name and a role, nothing else. Public, so the join screen can say what is being accepted before anyone accepts it. |
| `POST /api/staff/join` | Accept one, as whoever is signed in on this device. Idempotent; re-scanning a different role's code changes the role rather than adding a second row. |
| `POST /api/preview` | Draw a stage that does not exist: a format, a field size and a config in, a plan out. Public and unauthenticated because it reads and writes nothing, capped at 128 teams because a round robin is quadratic. Runs the same four generators a real stage does, which is what lets a marketing page show a bracket without being able to promise one the hall would not get. |
| `GET /api/display/{token}` | The whole projector screen in one response. Public — the token is the only credential. Read it with `If-None-Match`; an unchanged tournament answers 304. |
| `GET /api/realtime` | PocketBase's stream. A screen subscribes to `tournament/{id}` and is told when to re-read the line above — the nudge carries no data of its own. |

## An agent can run one too

`/api/mcp` is an MCP server over Streamable HTTP — one endpoint, `POST` for a
request, `GET` for the stream, `DELETE` to end a session. Twenty-one tools: the
same generate, resolve, score and publish the screens use. Two prompts —
`plan_a_tournament` and `enter_the_results` — that write out those tool
sequences in order, so a client that asks for `prompts/list` gets a plan
rather than a `method not found`.

`create_tournament` asks what is being played, for the same reason the wizard
does — three points for a win with a draw possible is right for football and
wrong for every sport played in a hall. The presets are
`backend/internal/tournament/sports.json`, which is also what the wizard's
chips are checked against, so the two cannot drift into scoring the same
volleyball day differently depending on who set it up.

An agent is treated as an organiser who has not signed up, because that is
what it is. `create_tournament` is the only tool that needs no credential; it
makes an account for that tournament and hands back a `session_token`, and
every other tool requires it. What that account may touch is decided by
`tournament.IsOperator`, the same function the REST routes use.

The token travels as a tool argument rather than an `Authorization` header,
which looks wrong and is not: the agent has no token when it opens the
connection, and the header a client is configured with cannot change because a
tool returned one. It also means what leaks, if the model's transcript leaks,
is one tournament — that is what an account per tournament is for.

A caller that *does* hold a token before it connects — a person reconnecting
to an existing tournament through a gateway like [Smithery](https://smithery.ai)
that binds a config value at connect time — has nowhere to put it as an
argument, so `caller()` also reads an `X-Whistle-Session` header when a call
carries no argument. A Smithery config schema with a single `sessionToken`
field mapped `x-from`/`x-to` onto that header is all it takes to expose it
there.

`create_handoff` ends it. The link goes to whoever is actually running the day,
they set an email and a password at `/claim/{token}`, and the account becomes
theirs — after which the agent's `session_token` stops working, which is the
point.

### Or: sign in as an account you already have

`backend/internal/oauth` makes this same server an OAuth 2.1 authorization
server (authorization code + mandatory PKCE, dynamic client registration —
`/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`,
`/oauth/register`, `/oauth/authorize`, `/oauth/token`), so a real organiser can
sign in once in a browser and hand an agent a token scoped to their existing
account instead of a fresh anonymous one. `caller()` tries an
`Authorization: Bearer` header — resolved by `oauth.ResolveAccessToken`
against this package's own database-backed tokens, not a PocketBase auth
JWT, because those cannot be individually revoked — as the second of its
three identity channels, between the `session_token` argument and
`X-Whistle-Session`. `tournament.IsOperator` decides what the resulting
account may touch either way, so a signed-in connection reaches exactly what
the account owns or crews, no more and no less.

Access and refresh tokens are opaque and short-lived (an hour) with a
sliding, rotating refresh (60 days); a refresh token redeemed twice — reuse —
revokes every token descended from that grant, not just the replayed one.
`/oauth/token` is the one form-encoded endpoint in an otherwise all-JSON API,
deliberately: it is what every OAuth client library posts. The browser side
of the flow — `/oauth/consent` — is an ordinary SPA route
(`apps/web/src/routes/oauth.consent.tsx`) that reuses `/account`'s existing
sign-in form via a `?next=` redirect, not a second one.

Two details taken from [the MCP authorization spec](https://modelcontextprotocol.io/specification/draft/basic/authorization)
rather than assumed: every token is bound to `/api/mcp` as its audience (RFC
8707) — a `resource` parameter naming anything else is refused at both
`/oauth/authorize` and `/oauth/token` — and every redirect back to a client
carries `iss` (RFC 9207), advertised via
`authorization_response_iss_parameter_supported`. One known, deliberate gap:
the spec's discovery flow assumes a client learns OAuth is available from a
401 challenge, and this server never 401s at the transport level, because
`create_tournament` has to keep working with no credential at all. A client
that only checks for `/.well-known/oauth-protected-resource` after a 401 may
not discover sign-in here — the `/mcp` page's own docs are the mitigation.

`create_tournament` notices which identity a connection carries: signed-in,
the tournament is created under that real account and no `session_token`
comes back — there's nothing new to keep — otherwise it falls back to minting
the anonymous device account exactly as before.

| | |
|---|---|
| `WHISTLEDAY_MCP_BEHIND_PROXY` | Set when a reverse proxy on the same host forwards to PocketBase over loopback while keeping the original `Host`. Without it mcp-go's DNS rebinding protection sees a loopback connection claiming to be `whistle.day` and answers 403. Leave it unset locally, where the protection is the one that matters. |

## Behaviour worth knowing about

- **English, Czech and Spanish, and the wall can be aimed at one of them.**
  Every screen reads in any of the three, with no i18n dependency — typed
  catalogues in `apps/web/src/locales/` and twenty lines of interpolation,
  because `Intl.PluralRules` already knows Czech's four plural forms and
  Spanish's two. `cs` and `es` are typed against `en`, so a missing key is a
  compile error rather than a dotted path on a wall. Spanish is one catalog
  for Spain and Spanish-speaking America: `es-ES` and `es-AR` are the same
  `es`. A `?lang=cs` or `?lang=es` on a link wins over what the browser
  prefers, which is the only way to aim a projector: the laptop driving it is
  as likely as not to be in English, and the hall is not.
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
  Whistle.day" panel, and on the tournament's `sponsors` — a proper collection,
  each row a name, an uploaded logo and a tier — as well while
  `users.subscription_until` on the tournament's owner is still in the future.
  The filtering is the server's: an unsubscribed tournament sends no sponsors
  at all, so there is nothing on a public endpoint for a screen to un-hide, and
  no account can sell itself the upgrade — the date sits on a record its owner
  may otherwise write, so a hook refuses that write.
- **A team that turns up late is put in, not started again.** The mirror of a
  withdrawal and the harder half of it: taking somebody out only has to close
  what they had left, while putting somebody in has to invent the matches they
  are going to play. What those are depends on the format, so it is three
  answers rather than one. A group takes them into whichever pool has the least
  to catch up on and writes one match against everybody already in it — each in
  a round of its own, appended at the end, because a team owing four matches
  cannot play four at once. A Swiss field takes them into the table and writes
  nothing: the next round is drawn from the table and they are now in it, on
  nothing, which is the only defensible answer for somebody who has not played
  rounds one and two. A bracket has no room at all — it is the shape of the
  whole competition, decided before anybody threw a ball — so it is drawn
  again, and only while nobody has played. Once somebody has, the answer is no,
  and it is refused before anything is written rather than applied to the
  groups and refused by the playoff. Somebody who has already gone home is not
  written in as an opponent: that fixture would close itself as a walkover the
  moment it was saved, crediting a newcomer with beating a team that was not
  there to be beaten.
- **A match knows when it is over.** `scoring.bestOf` was written by the sport
  presets from the day the wizard asked what was being played, and read by
  nobody: a best-of-three could be saved at 1–0 with the third set still to
  come, and the table took it as a result. The server now refuses any score the
  format cannot end on — not over yet, or over twice — and refuses a fourth set
  in a format that has three. What is enforced is the shape of the score rather
  than the presence of the points underneath it, because plenty of days are run
  on sets alone and 2–1 typed straight in is a complete result. The match sheet
  applies the same arithmetic before the write: the score steppers stop at the
  sets that win, "Add a set" stops when the format runs out, and Save is held
  until the score is one the match could have ended on. That last part is not
  belt and braces — a result goes into a queue that may not drain for ten
  minutes, and a refusal arriving after the teams have left is not one anybody
  can act on.
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
- **Schedule conflicts are surfaced, not prevented.** The organiser is warned
  when a team is already down for another match at the same time; nothing stops
  them going ahead, because reshuffling a schedule passes through states that
  are briefly wrong on purpose.
- **A hall is one IP address, so the rate limits are shaped around that.** Two
  hundred phones behind one NAT make the usual advice — a blanket cap on
  `/api/` — exactly wrong: PocketBase's own default of 300 per 10 seconds is
  generous until it is the whole venue's budget, and the first thing to break
  is the phone the referee is holding. So the projector endpoint, the realtime
  stream and the collection API have no rule at all, and the four that do
  guard places a stranger can make this server work or store something:
  `*:auth`, `/api/preview`, `/api/mcp` and creating a user. Seeded by a
  migration so a rebuilt `pb_data` comes back with them, and editable in the
  dashboard afterwards — changing a limit during an incident should not need a
  deploy.
- **Abandoned drafts are swept, and almost nothing counts as abandoned.**
  `create_tournament` needs no credential, so anything that can reach
  `/api/mcp` leaves a tournament behind, and a thousand of those turn `bun run
  stats` from a measurement into noise. The daily sweep is deliberately timid,
  because the dangerous mistake is close by: *unclaimed* is not abandoned —
  every tournament the wizard makes is owned by an unclaimed device account,
  and one set up on a phone in October and run in November looks exactly like
  an agent's leftovers. So it takes all four: still a draft, no fixtures at
  all, an owner that never claimed an email, and thirty days. A tournament
  with a draw in it is somebody's work and stays, whatever its age.
- **Nothing is counted on a screen.** Analytics run on the marketing pages and
  stop there — Plausible, cookieless, about a kilobyte, so no consent banner in
  front of a landing page and nothing to slow an LCP budget down. A projector
  is unattended for eight hours and a phone on `/m/:token` is the busiest
  screen there is; neither has a question a page-view tool could answer, and
  both would pay for it in the bandwidth the result queue needs to drain. The
  gate is `isAppRoute` in `apps/web/src/lib/routes.ts`, which is the same one
  the prerender filter uses, so a screen cannot become countable without also
  becoming crawlable — and a test says so.
- **What the product does is counted from the database, not from beacons.**
  How far a tournament got, which formats get drawn, how big a field is, how
  long a day runs, how many organisers never claimed an email: all of it is
  already in the schema as domain data, and `bun run stats` reads it back out
  of a copy of `data.db`, read-only. Re-recording it into an event pipeline
  would add a consent question to facts the service already has to store, and
  put analytics writes behind the one SQLite writer that is busy propagating a
  result. The one thing it cannot see is what happened before the first write —
  the wizard's own drop-off, which lives in a browser.

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
3. **Roles are recorded, not enforced.** `staff.role` is set by which code
   someone scanned and shown in the crew list, and every crew member can do
   everything `/t/:id` offers. The distinction that *is* enforced is owner
   versus crew: handing out codes and removing people are the owner's alone.
4. **Nothing sells a subscription.** `users.subscription_until` is what the
   sponsor slots read, and the only things that set it are an admin and
   whatever writes the record server-side. There is no checkout, no provider
   and no webhook.
5. **Match call notifications (PWA Web Push & WhatsApp).** A team warming up in
   a corridor or standing at the canteen only knows their match is called if
   someone walks over to tell them. Web Push over the PWA is the zero-cost path
   (one tap on `/m/:token` without asking for a phone number), while WhatsApp
   Cloud API utility templates reach players who have closed the browser, at a
   couple of cents per tournament. Neither is wired to the schedule yet.
6. **Bulk team import.** Entering sixteen teams in the wizard is done one by
   one so nobody loses their place on a phone, but somebody holding a WhatsApp
   export or a spreadsheet column has to type them all out. A two-tier import —
   an instant offline parser for clean lines and comma-separated lists, with an
   optional LLM/vision pass for messy chat chatter or a photo of a paper
   registration sheet — would turn fifty taps into one paste and an editable
   preview.
