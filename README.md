# Seedly

Tournament organiser with arbitrary stage ordering — groups, playoff, Swiss, in
any sequence — and a public projector view.

**Status: skeleton.** The data model, the slot resolver and the bracket
generators work and are tested. There is no frontend yet.

```
seedly/
├── docs/DATA-MODEL.md      ← start here
├── backend/                 PocketBase as a Go framework
│   ├── migrations/          schema (this IS the schema — committed)
│   └── internal/tournament/ slot resolution, custom routes
├── packages/engine/         pure TS: types + bracket generators
└── scripts/smoke.ts         end-to-end check against a live server
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

PocketBase is used as a **Go framework**, not as a prebuilt binary. `go build`
produces a server with the tournament logic compiled in. This is deliberate:
PocketBase's JS hooks run in goja, which has no npm and no Node APIs, and the
slot resolver needs real transactions.

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
bun run check   # typecheck + engine tests + go vet/test + smoke
```

Individually:

| Command | What it covers |
|---|---|
| `bun test` | 16 tests — bracket generator structure |
| `bun run typecheck` | TypeScript 7 |
| `bun run pb:test` | `go vet` + outcome derivation unit tests |
| `bun run smoke` | 18 assertions against a real PocketBase on a temp data dir |

The smoke run is the one that matters: it boots the server, plays a
four-team bracket over the REST API and asserts that results propagate.

## The slot resolver

Closing a fixture pushes its outcome into every slot that names it as a source,
then fills the denormalised entries on the fixtures those slots feed and flips
them to `ready` once both sides are known. It lives in
`backend/internal/tournament/resolve.go`.

Three behaviours worth knowing about:

- **Corrections re-propagate.** Editing a score hours later reruns the chain;
  the resolver is idempotent, so replaying it writes nothing new.
- **Byes settle themselves.** A fixture whose opponent slot is a *declared* bye
  is decided as soon as both sides are known. A slot that is merely waiting on
  an earlier result looks identical, so the distinction is explicit.
- **`POST /api/stages/{stage}/resolve`** re-resolves an entire stage. Event
  propagation misses slots created after the fixture they source from, which
  bracket generation can easily do. This is the repair path.

## Engine

```ts
import { planSingleElimination, planRoundRobin } from "@seedly/engine";

planRoundRobin(entryIds, { poolCount: 2, advancePerPool: 2 });
planSingleElimination(entryIds, { thirdPlace: true });

// An empty entry list yields the same bracket shape with unresolved slots —
// exactly what the projector needs while the group stage is still running.
planSingleElimination([]);
```

> **Open decision.** These generators are TypeScript so the organiser's browser
> can preview a draw without a round trip. Committing a draw is a server
> concern, so generation will eventually need a Go implementation too — and two
> implementations of bracket seeding is how brackets drift. Before writing the
> Go side, decide instead whether generation should move to Go entirely, with
> the browser previewing via a dry-run endpoint. Recommended: the latter.

## What is not built yet

1. **Standings computation** — `standings` exists and is written only by hooks,
   but nothing computes it. Head-to-head tiebreaks are the hard part.
2. **`pool_rank` / `stage_rank` slot sources** — the schema and the resolver's
   shape support them; resolving them depends on standings.
3. **Swiss pairing** and **double elimination** generators. The model is ready
   (`pools.kind` has `winners`/`losers`); the code is not.
4. **A projector payload route** — `GET /api/display/{token}` returning one
   bundle, so a screen needs one request instead of five subscriptions.
5. **The frontend.** React + Vite + TanStack Router/Query, with the projector
   as a `/display/:token` route in the same app.
6. **Schedule conflict detection** — `scheduled_at` and `court` exist, but
   nothing stops a team being booked onto two courts at once.
