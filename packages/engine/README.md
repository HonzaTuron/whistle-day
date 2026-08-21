# @seedly/engine

Shared domain types for the frontend. **Types only** — there is no logic here.

Bracket generation, standings and slot resolution all live in Go
(`backend/internal/tournament/`). They used to be duplicated in TypeScript so
the browser could preview a draw; that duplication is exactly how two
implementations of bracket seeding drift apart, so preview now goes through the
server instead:

```
POST /api/stages/{stage}/generate?dry_run=1
```

Same generator, same result, no second implementation. The response body is a
`StagePlan` — see `types.ts`.

## Keeping types in sync

`types.ts` mirrors the PocketBase collections defined in
`backend/migrations/`. Nothing enforces that automatically. If you change a
field there, change it here.
