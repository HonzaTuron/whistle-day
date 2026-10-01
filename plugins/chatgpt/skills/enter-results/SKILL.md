---
name: enter-results
description: Record match scores and walkovers in a Whistle.day tournament, correct a score entered earlier, and report fixtures still to play or the current standings. Use when the user gives a result, asks what is left to play, or asks for a table or bracket.
---

Use this skill when a tournament already exists and the user wants to enter
results or read where things stand.

## Find the match

1. `list_tournaments` if the tournament id is not already known. If the user
   has several and did not say which, ask. If a tool answers that signing in
   is needed, say so and stop; do not try to work around it.
2. `list_stages` for the tournament, then `list_fixtures` for the stage.
   Filter with `status: "live"` or `status: "ready"` to see what is on court
   and what is next. `list_entries` maps team names to entry ids.
3. Match the user's wording to exactly one fixture by the two teams (and the
   round or fixture code if they gave one). If more than one fixture fits, or
   none does, ask rather than pick.

## Record it

- A played match: `update_fixture` with `id`, `status: "finished"`,
  `home_score` and `away_score`. Home and away follow the fixture, not the
  order the user said the names in — put each score against the right side.
- A no-show: `update_fixture` with `id`, `status: "walkover"` and `winner`
  set to the entry id of the team that was there.
- A match starting now: `status: "live"`. Assign a court with `court` set to
  an id from `list_courts`.

`update_fixture` overwrites whatever score the fixture had. If the fixture is
already finished with a different score, tell the user what is there and
confirm before changing it. After correcting a score that was already
entered, call `resolve_stage` for that stage so tables and later rounds
follow the correction.

## Read where things stand

- A group table: `list_pools` for the stage, then `list_standings` per pool.
- Ranking across groups (best runners-up and the like): `get_stage_table`.
  It is provisional until every pool in the stage has finished — say so.
- What is left: `list_fixtures` with `status: "ready"` and `"pending"`.

Show team names, not ids. Report a table as played, won, drawn, lost and
points in the order the tool returned it.

## Do not

- Guess a score, a winner or which fixture was meant.
- Change a result the user did not ask about.
