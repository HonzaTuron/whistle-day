# backend

PocketBase used as a **Go framework**. `go build` produces a server binary with
the tournament logic compiled in.

```
backend/
├── main.go                     app entry, hook + route registration
├── migrations/                 the schema — this is the source of truth
└── internal/tournament/
    ├── generate.go             bracket + round-robin generators, plan commit
    ├── standings.go            table computation, tiebreaks, pool_rank slots
    ├── resolve.go              outcome derivation, slot propagation, hooks
    ├── realtime.go             nudges screens when what they show changes
    ├── display.go              the assembled projector payload
    └── routes.go               generate, resolve and display endpoints
```

`pb_data/` and the compiled `pocketbase` binary are gitignored.

## Why Go and not pb_hooks

PocketBase's JS hooks run in goja: no npm, no Node APIs, ES5 with parts of
ES2015. This is the most correctness-critical code in the project and it needs
transactions, so it belongs in compiled code with real tests.

## The write chain

Everything hangs off one event — a fixture being settled:

```
fixture settled
  └─ deriveOutcome        winner/loser from the score (before the write)
  └─ PropagateFixture     fill slots sourcing this fixture
       └─ refreshDependentFixtures   denormalise entries, promote to "ready"
  └─ ComputeStandings     rebuild every pool table in the stage
  └─ ResolvePoolRanks     fill slots waiting on a completed pool's table
```

The recursion terminates because propagation only writes fixtures into
`ready`/`pending`, and the chain is gated on the fixture being settled. That
gate is load-bearing, not an optimisation — see `afterFixtureWrite`.

## Migration notes

`1787270400_init_schema.go` creates all 11 collections. Order is forced by
relation dependencies: a relation field needs its target's `collectionId`, so
the target must exist first.

Two cycles are broken in two passes:

- **`tournaments` ↔ `staff`.** Access rules on `tournaments` reference the
  `staff_via_tournament` back-relation, which PocketBase validates on save.
  `tournaments` is created owner-only and patched once `staff` exists.
- **`slots` ↔ `fixtures`.** `slots.source_fixture` points at `fixtures` and
  `fixtures.home_slot` points back. `slots` is created without
  `source_fixture`, and the field is added after `fixtures`.

## Three things that bit us

**A required number field rejects 0.** PocketBase validates `required` as "not
blank", and 0 is blank. Every zero-based ordering column — stage and pool
`position`, slot and fixture `round`/`position` — is therefore optional. The
unique indexes protect ordering instead. `games.number` and
`standings.position` are 1-based and stay required.

**Uniqueness has to include the pool.** `fixtures` was originally unique on
`(stage, round, position)`, which silently works for a bracket and breaks the
moment a stage has two groups: pool A and pool B both hold a fixture at round 0
position 0. Both `fixtures` and `slots` key on
`(stage, COALESCE(pool, ''), round, position)`.

**Access rules are expressions, not code.** Anything more conditional than a
relation path needs a custom route, and collection API rules do not apply to
custom routes — which is why `routes.go` re-implements the staff check.

## Backups

Turn on scheduled S3 backups in the admin UI on day one, not after the first
tournament. SQLite is one file on one machine.
