# @seedly/web

Two public screens, one data source.

| Route | For |
|---|---|
| `/display/:token` | The projector: unattended, rotates itself, read from across a hall. |
| `/m/:token` | A phone: held by one person looking for one thing. |
| `/` | Paste a token to open either. |

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

Then open `http://localhost:5173/display/hala-1` or `/m/hala-1`.

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
