---
name: plan-a-tournament
description: Set up a sports tournament on Whistle.day from a description of the day — the sport, the teams, the courts and the format — then draw it, publish it and return the links. Use when the user wants to create, organise or draw a tournament, bracket, group stage, league or Swiss event.
---

Use this skill when the user wants a new tournament built on Whistle.day.

## What to find out first

Ask only for what is missing, in one message:

- The name of the tournament.
- The sport. It must be one of: volleyball, football, basketball, tennis,
  padel, badminton, table_tennis, handball, other. The sport decides the
  points and whether a draw is a result, so do not guess it; use `other` only
  when the user's sport is not on the list.
- The teams or players, in seeding order if the user has one.
- How many courts, pitches or tables there are.
- The format: `round_robin`, `single_elim`, `double_elim` or `swiss`. If the
  user has no preference, suggest round robin for up to about six teams and
  groups followed by a knockout for more, and let them choose.

## Steps

1. `create_tournament` with `name` and `sport`.
   - If the user is signed in to Whistle.day, the tournament is created on
     their account.
   - If they are not signed in, it is created on a temporary account that
     lasts only as long as this connection. The result's `note` says which
     happened. Tell the user that signing in, or the handoff link in step 7,
     is how they keep the tournament.
2. `add_entry` once per team with `seed` 1..N in the order given.
3. `add_court` once per court, named the way the user names them
   (for example "Court 1").
4. `create_stage` with `name`, `format` and `position: 0`. For several stages
   (groups, then a playoff) create each one at position 1, 2, … in order.
   `config` is a JSON string, for example `{"poolCount":2}` for two groups.
5. `generate_stage` with `dry_run: true` and show the user the draw. When they
   are happy with it, call `generate_stage` again without `dry_run` to commit.
   Committing replaces any draw the stage already had, so confirm before
   regenerating a stage that already has results.
6. When the user wants it visible: `publish_tournament`, then `create_display`
   for a projector or TV link. Publishing makes the tournament viewable by
   anyone with the link, so do it only when asked or after confirming.
7. Only for a tournament created without signing in: when the user is ready to
   take it over, call `create_handoff` and give them the link. Opening it lets
   them set an email and password, after which this conversation can no
   longer change the tournament — so do this last, and confirm first.

## What to return

A short summary: the tournament name and sport, the teams, the courts, the
stages and their formats, and how many fixtures were drawn. Include the
projector link if a display was created and the handoff link if one was made.

## Do not

- Invent teams, scores, courts or a sport the user did not give.
- Publish, regenerate a drawn stage or create a handoff without the user
  asking for it or confirming.
- Promise things the tools cannot do: deleting a tournament, taking payments
  and player registration are not available here.
