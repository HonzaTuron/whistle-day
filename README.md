# Seedly

Tournament organiser with arbitrary stage ordering — groups, playoff, Swiss, in
any sequence — and a public projector view.

**Status: backend works end to end.** Generate a group stage, play it, and the
playoff seeded from it fills itself in. There is no frontend yet.

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
bun run pb:serve      # http://127.0.0.1:8090/_/
```

## Checks

```bash
bun run check   # typecheck + go vet/test + smoke
```

| Command | What it covers |
|---|---|
| `bun run typecheck` | TypeScript 7 |
| `bun run pb:test` | `go vet` + 22 unit tests: generators, tiebreaks, outcomes |
| `bun run smoke` | 42 assertions against a real PocketBase on a temp data dir |

The smoke run is the one that matters. It boots the server, generates a
two-pool group stage and a playoff seeded from it, plays every group fixture
over the REST API, and asserts that the tables and the bracket come out right.

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
3. **A projector payload route** — `GET /api/display/{token}` returning one
   bundle, so a screen needs one request instead of five subscriptions.
4. **The frontend.** React + Vite + TanStack Router/Query, with the projector
   as a `/display/:token` route in the same app.
5. **Schedule conflict detection.** `scheduled_at` and `court` exist, but
   nothing stops a team being booked onto two courts at once.
6. **Result history.** An overwritten score is gone; there is no audit trail of
   who changed what.
