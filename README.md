# Seedly

Tournament organiser with arbitrary stage ordering — groups, playoff, Swiss, in
any sequence — and a public projector view.

**Status: a tournament can be set up on a phone and put on the wall.** Name it,
add the teams one by one, pick how the day should run, and you get a link and a
QR code. Generate a group stage, play it, and the playoff seeded from it fills
itself in — on the wall and on a phone. Entering results still happens over the
REST API; that screen is not built yet.

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
| `bun run pb:test` | `go vet` + 22 unit tests: generators, tiebreaks, outcomes |
| `bun run smoke` | 63 assertions against a real PocketBase on a temp data dir |

The smoke run is the one that matters. It boots the server, generates a
two-pool group stage and a playoff seeded from it, plays every group fixture
over the REST API, and asserts that the tables, the bracket and the projector
payload all come out right.

## How a tournament runs

```bash
# 1. groups
POST /api/stages/{groups}/generate?dry_run=1   # preview the draw
POST /api/stages/{groups}/generate             # commit it

# 2. playoff, seeded from the groups
#    stages.config = { "seedFrom": { "stage": "<groups>", "advancePerPool": 2 } }
POST /api/stages/{playoff}/generate

# 3. play. Nothing else to call — closing a fixture does the rest.
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
| `GET /api/display/{token}` | The whole projector screen in one response. Public — the token is the only credential. Poll it with `If-None-Match`; an unchanged tournament answers 304. |

## Behaviour worth knowing about

- **Corrections re-propagate.** Editing a score hours later reruns the chain,
  including the tables. Standings are recomputed from scratch rather than
  accumulated, because incremental accumulation is exactly where a corrected
  score produces a table that no longer matches its own fixtures.
- **Byes settle themselves.** A fixture whose opponent slot is a *declared* bye
  is decided as soon as the other side is known. A slot merely waiting on an
  earlier result looks identical, so the distinction is explicit.
- **Playoff slots wait for a complete pool.** A table is provisional until
  every fixture in the pool is settled, and promoting a provisionally-first
  team into the bracket would be the worst bug this system could have.
- **Head-to-head is computed among the tied group only**, from the fixtures
  those entries played against each other — which is why ranking is recursive
  rather than one comparator chain.
- **Every fixture side is renderable.** When a slot has no entry yet the
  projector payload sends its label instead — "Winner SF1", "1. A", "TBD" — so
  a screen never has to draw a blank box.

## Generation lives on the server

The generators used to be duplicated in TypeScript so the browser could preview
a draw without a round trip. They are now Go only, and preview goes through
`?dry_run=1`. Two implementations of bracket seeding is how brackets drift;
`packages/engine` is types only.

## What is not built yet

1. **Swiss pairing** and **double elimination** generators. The model is ready
   (`pools.kind` has `winners`/`losers`); the code is not.
2. **`stage_rank` slot resolution.** `pool_rank` works. `stage_rank` needs a
   stage-wide table, which does not exist yet — pools are ranked, stages are
   not.
3. **The frontend.** React + Vite + TanStack Router/Query, with the projector
   as a `/display/:token` route in the same app.
5. **Schedule conflict detection.** `scheduled_at` and `court` exist, but
   nothing stops a team being booked onto two courts at once.
6. **Result history.** An overwritten score is gone; there is no audit trail of
   who changed what.
