import { describe, expect, test } from "bun:test";
import type { BoardFixture } from "../api/organiser";
import {
  applyIntent,
  collapse,
  laneOf,
  overlay,
  waitingFixtures,
  type Intent,
  type Queued,
} from "./pending";

/**
 * The queue is the one part of the offline path with no server behind it to
 * be right on its behalf. A collapse rule that drops the wrong write loses a
 * result nobody else has a copy of, so the rules get tests.
 */

const fixture = (over: Partial<BoardFixture> = {}): BoardFixture => ({
  id: "f1",
  tournament: "t1",
  stage: "s1",
  pool: "p1",
  round: 1,
  position: 1,
  code: "A1",
  home_slot: "sl1",
  away_slot: "sl2",
  home_entry: "home",
  away_entry: "away",
  status: "ready",
  home_score: null,
  away_score: null,
  winner: null,
  loser: null,
  court: null,
  referee: null,
  scheduled_at: "",
  started_at: "",
  finished_at: "",
  locked: false,
  notes: "",
  ...over,
});

const queued = (intent: Intent, over: Partial<Queued> = {}): Queued => ({
  id: `q-${Math.random()}`,
  tournament: "t1",
  intent,
  at: 1_700_000_000_000,
  state: "queued",
  attempts: 0,
  ...over,
});

describe("lanes", () => {
  test("everything that writes status shares one lane", () => {
    expect(laneOf({ kind: "result", fixture: "f1", home: 2, away: 0, sets: [] })).toBe(
      "outcome",
    );
    expect(laneOf({ kind: "walkover", fixture: "f1", winner: "home" })).toBe("outcome");
    expect(laneOf({ kind: "clear", fixture: "f1", status: "ready" })).toBe("outcome");
    expect(laneOf({ kind: "live", fixture: "f1", live: true })).toBe("outcome");
    expect(laneOf({ kind: "schedule", fixture: "f1", court: "c1" })).toBe("schedule");
  });
});

describe("collapse", () => {
  test("a rescored match drains as one write", () => {
    const first = queued({ kind: "result", fixture: "f1", home: 2, away: 0, sets: [] });
    const second = queued({ kind: "result", fixture: "f1", home: 2, away: 1, sets: [] });
    const third = queued({ kind: "result", fixture: "f1", home: 3, away: 1, sets: [] });

    const queue = collapse(collapse([first], second), third);

    expect(queue).toHaveLength(1);
    expect(queue[0]!.intent).toMatchObject({ home: 3, away: 1 });
    // The slot in the queue is the original one, so a correction does not jump
    // ahead of results entered after the write it replaces.
    expect(queue[0]!.id).toBe(first.id);
  });

  test("marking a match live and then finishing it sends the result only", () => {
    const live = queued({ kind: "live", fixture: "f1", live: true });
    const done = queued({ kind: "result", fixture: "f1", home: 2, away: 0, sets: [] });

    const queue = collapse([live], done);

    expect(queue).toHaveLength(1);
    expect(queue[0]!.intent.kind).toBe("result");
  });

  test("a court and a score are both kept", () => {
    const court = queued({ kind: "schedule", fixture: "f1", court: "c2" });
    const score = queued({ kind: "result", fixture: "f1", home: 2, away: 0, sets: [] });

    const queue = collapse([court], score);

    expect(queue).toHaveLength(2);
    expect(queue.map((entry) => entry.intent.kind).sort()).toEqual([
      "result",
      "schedule",
    ]);
  });

  test("setting a court does not unset a queued time", () => {
    const time = queued({ kind: "schedule", fixture: "f1", scheduled_at: "18:30" });
    const court = queued({ kind: "schedule", fixture: "f1", court: "c2" });

    const queue = collapse([time], court);

    expect(queue).toHaveLength(1);
    expect(queue[0]!.intent).toMatchObject({ court: "c2", scheduled_at: "18:30" });
  });

  test("two fixtures never collapse into each other", () => {
    const one = queued({ kind: "result", fixture: "f1", home: 2, away: 0, sets: [] });
    const two = queued({ kind: "result", fixture: "f2", home: 1, away: 1, sets: [] });

    expect(collapse([one], two)).toHaveLength(2);
  });

  test("a correction on top of a sent write is a second write", () => {
    // The first one is already on the server. Folding into it would lose the
    // fact that the score was changed, which is what the history is for.
    const sent = queued(
      { kind: "result", fixture: "f1", home: 2, away: 0, sets: [] },
      { state: "sent" },
    );
    const fix = queued({ kind: "result", fixture: "f1", home: 2, away: 1, sets: [] });

    expect(collapse([sent], fix)).toHaveLength(2);
  });
});

describe("applyIntent", () => {
  test("a result closes the match and names the winner", () => {
    const out = applyIntent(fixture(), {
      kind: "result",
      fixture: "f1",
      home: 3,
      away: 1,
      sets: [],
    });

    expect(out.status).toBe("finished");
    expect(out.home_score).toBe(3);
    expect(out.winner).toBe("home");
    expect(out.loser).toBe("away");
  });

  test("a draw has no winner", () => {
    const out = applyIntent(fixture(), {
      kind: "result",
      fixture: "f1",
      home: 1,
      away: 1,
      sets: [],
    });

    expect(out.status).toBe("finished");
    expect(out.winner).toBeNull();
    expect(out.loser).toBeNull();
  });

  test("nothing downstream of the match is touched", () => {
    // The point of the whole design: the client records the result and lets
    // the server work out what it means. Slots stay exactly as they were.
    const before = fixture();
    const out = applyIntent(before, {
      kind: "result",
      fixture: "f1",
      home: 2,
      away: 0,
      sets: [],
    });

    expect(out.home_slot).toBe(before.home_slot);
    expect(out.away_slot).toBe(before.away_slot);
    expect(out.stage).toBe(before.stage);
    expect(out.pool).toBe(before.pool);
  });

  test("a walkover credits the side that turned up and clears the score", () => {
    const out = applyIntent(fixture({ home_score: 3, away_score: 1 }), {
      kind: "walkover",
      fixture: "f1",
      winner: "away",
    });

    expect(out.status).toBe("walkover");
    expect(out.winner).toBe("away");
    expect(out.loser).toBe("home");
    expect(out.home_score).toBe(0);
    expect(out.away_score).toBe(0);
  });

  test("clearing takes the result off and keeps the status it was given", () => {
    const played = fixture({
      status: "finished",
      home_score: 2,
      away_score: 0,
      winner: "home",
    });

    expect(
      applyIntent(played, { kind: "clear", fixture: "f1", status: "pending" }),
    ).toMatchObject({ status: "pending", winner: null, home_score: 0, finished_at: "" });
  });

  test("a schedule leaves out what it was not given", () => {
    const out = applyIntent(fixture({ scheduled_at: "18:30" }), {
      kind: "schedule",
      fixture: "f1",
      court: "c2",
    });

    expect(out.court).toBe("c2");
    expect(out.scheduled_at).toBe("18:30");
  });

  test("coming off court goes back to ready, not to a result", () => {
    const out = applyIntent(fixture({ status: "live", started_at: "x" }), {
      kind: "live",
      fixture: "f1",
      live: false,
    });

    expect(out.status).toBe("ready");
    expect(out.started_at).toBe("");
  });

  test("a result is stamped when it was entered, not when it is sent", () => {
    const tapped = Date.parse("2026-08-24T14:30:00.000Z");
    const out = applyIntent(
      fixture(),
      { kind: "result", fixture: "f1", home: 2, away: 0, sets: [] },
      tapped,
    );

    expect(out.finished_at).toBe("2026-08-24 14:30:00.000Z");
  });
});

describe("overlay", () => {
  test("an empty queue hands the fixtures straight back", () => {
    const fixtures = [fixture()];
    expect(overlay(fixtures, [])).toBe(fixtures);
  });

  test("only the fixtures with something queued change", () => {
    const untouched = fixture({ id: "f2" });
    const out = overlay(
      [fixture({ id: "f1" }), untouched],
      [queued({ kind: "result", fixture: "f1", home: 2, away: 0, sets: [] })],
    );

    expect(out[0]!.status).toBe("finished");
    expect(out[1]).toBe(untouched);
  });

  test("a sent write stays on the board until it has been read back", () => {
    const out = overlay(
      [fixture()],
      [
        queued(
          { kind: "result", fixture: "f1", home: 2, away: 0, sets: [] },
          { state: "sent" },
        ),
      ],
    );

    expect(out[0]!.status).toBe("finished");
  });

  test("two lanes on one fixture both land", () => {
    const out = overlay(
      [fixture()],
      [
        queued({ kind: "schedule", fixture: "f1", court: "c2" }),
        queued({ kind: "result", fixture: "f1", home: 2, away: 0, sets: [] }),
      ],
    );

    expect(out[0]!.court).toBe("c2");
    expect(out[0]!.status).toBe("finished");
  });
});

describe("waitingFixtures", () => {
  test("counts what is unsent and not what has landed", () => {
    const marks = waitingFixtures([
      queued({ kind: "result", fixture: "f1", home: 2, away: 0, sets: [] }),
      queued(
        { kind: "result", fixture: "f2", home: 2, away: 0, sets: [] },
        { state: "sent" },
      ),
    ]);

    expect([...marks]).toEqual(["f1"]);
  });
});
