# backend

PocketBase used as a **Go framework**. `go build` produces a server binary with
the tournament logic compiled in.

```
backend/
├── main.go                     app entry, hook + route registration
├── migrations/                 the schema — committed, this is the source of truth
└── internal/tournament/
    ├── resolve.go              outcome derivation + slot propagation
    └── routes.go               POST /api/stages/{stage}/resolve
```

`pb_data/` and the compiled `pocketbase` binary are gitignored.

## Why Go and not pb_hooks

PocketBase's JS hooks run in goja: no npm, no Node APIs, ES5 with parts of
ES2015. Slot resolution needs transactions and is the most correctness-critical
code in the project, so it belongs in compiled code with real tests.

## Migration notes

`1787270400_init_schema.go` creates all 11 collections. Order inside the
migration is forced by relation dependencies — a relation field needs its
target's `collectionId`, so the target must exist first.

Two cycles had to be broken in two passes:

- **`tournaments` ↔ `staff`.** The access rules on `tournaments` reference the
  `staff_via_tournament` back-relation, which PocketBase validates on save.
  `tournaments` is therefore created with owner-only rules and patched once
  `staff` exists.
- **`slots` ↔ `fixtures`.** `slots.source_fixture` points at `fixtures` and
  `fixtures.home_slot` points back. `slots` is created without
  `source_fixture`, and the field is added after `fixtures`.

## Two PocketBase behaviours that bit us

**A required number field rejects 0.** PocketBase validates `required` as
"not blank", and 0 is blank. Every zero-based ordering column here — stage and
pool `position`, slot and fixture `round`/`position` — is therefore optional.
The unique indexes are what actually protect ordering. `games.number` and
`standings.position` are 1-based and stay required.

**Access rules are expressions, not code.** Anything more conditional than a
relation path needs a custom route; `routes.go` re-implements the staff check
for exactly that reason, because collection API rules do not cover custom
routes.

## Backups

Turn on scheduled S3 backups in the admin UI on day one, not after the first
tournament. SQLite is one file on one machine.
