# Seedly

Tournament organiser with arbitrary stage ordering — groups, playoff, Swiss, in
any sequence — and a public projector view.

**Status: a whole tournament runs off a phone.** Name it, add the teams one by
one, pick how the day should run, and you get a link and a QR code. Then run
the day: put matches on courts, mark what is being played, and enter results as
they come in. The tables rebuild, the playoff seeded from them fills itself in,
the next Swiss round draws itself, and the wall keeps up on its own.

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
| Go | 1.25+ (built and tested on 1.26.5) |
| Bun | 1.4.0 — pinned in `.bun-version` and `packageManager` |
| PocketBase | v0.39.11, as a Go dependency — not a downloaded binary |

PocketBase is used as a **Go framework**. `go build` produces a server with the
tournament logic compiled in. Its JS hooks run in goja, which has no npm and no
Node APIs, and this logic needs real transactions and real tests.

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
| `/new` | The organiser: name, teams, courts, format, and a link for the wall. |
| `/t/:id` | Running the day: courts, times, what is live, a score for each, and how the wall is set up. |
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
| `bun run pb:test` | `go vet` + 116 unit tests: generators, pairing, tiebreaks, outcomes |
| `bun run smoke` | 122 assertions against a real PocketBase on a temp data dir |

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
| `GET /api/display/{token}` | The whole projector screen in one response. Public — the token is the only credential. Read it with `If-None-Match`; an unchanged tournament answers 304. |
| `GET /api/realtime` | PocketBase's stream. A screen subscribes to `tournament/{id}` and is told when to re-read the line above — the nudge carries no data of its own. |

## Behaviour worth knowing about

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
  Seedly" panel, and on the sponsor slots from `displays.theme.sponsors` as
  well while `users.subscription_until` on the tournament's owner is still in
  the future. The filtering is the server's: an unsubscribed tournament sends
  no sponsors at all, so there is nothing on a public endpoint for a screen to
  un-hide, and no account can sell itself the upgrade — the date sits on a
  record its owner may otherwise write, so a hook refuses that write.
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
4. **Nobody can be added once a stage is generated.** The wizard takes the
   teams and the generator takes them all; a late arrival means starting the
   draw again.
5. **Nothing sells a subscription.** `users.subscription_until` is what the
   sponsor slots read, and the only things that set it are an admin and
   whatever writes the record server-side. There is no checkout, no provider
   and no webhook.
