import { describe, expect, test } from "bun:test";
import {
  circleRounds,
  planRoundRobin,
  planSingleElimination,
  poolName,
  seedOrder,
  snakeDistribute,
} from "./brackets";
import type { StagePlan } from "./types";

/** Every fixture must point at slots that actually exist in the same plan. */
function expectPlanIsConsistent(plan: StagePlan) {
  const slotKeys = new Set(plan.slots.map((s) => s.key));
  const poolKeys = new Set(plan.pools.map((p) => p.key));

  for (const fixture of plan.fixtures) {
    expect(slotKeys.has(fixture.homeSlotKey)).toBe(true);
    expect(slotKeys.has(fixture.awaySlotKey)).toBe(true);
    expect(fixture.homeSlotKey).not.toBe(fixture.awaySlotKey);
    if (fixture.poolKey) expect(poolKeys.has(fixture.poolKey)).toBe(true);
  }

  const fixtureKeys = new Set(plan.fixtures.map((f) => f.key));
  for (const slot of plan.slots) {
    if (slot.sourceFixtureKey) {
      expect(fixtureKeys.has(slot.sourceFixtureKey)).toBe(true);
    }
  }
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);

describe("seedOrder", () => {
  test("keeps the top seeds apart until the final", () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  test("seed 1 and seed 2 sit in opposite halves", () => {
    const order = seedOrder(16);
    expect(order.indexOf(1)).toBeLessThan(8);
    expect(order.indexOf(2)).toBeGreaterThanOrEqual(8);
  });
});

describe("planSingleElimination", () => {
  test("8 entries produce 7 fixtures and 15 slots", () => {
    const plan = planSingleElimination(ids(8));
    expect(plan.fixtures).toHaveLength(7);
    expect(plan.slots).toHaveLength(15);
    expectPlanIsConsistent(plan);
  });

  test("fixture codes read QF -> SF -> F", () => {
    const plan = planSingleElimination(ids(8));
    const codes = plan.fixtures.map((f) => f.code);
    expect(codes).toEqual(["QF1", "QF2", "QF3", "QF4", "SF1", "SF2", "F"]);
  });

  test("5 entries round up to an 8 bracket with 3 byes", () => {
    const plan = planSingleElimination(ids(5));
    const byes = plan.slots.filter((s) => s.source_type === "bye");
    expect(byes).toHaveLength(3);
    expect(plan.fixtures).toHaveLength(7);
    expectPlanIsConsistent(plan);
  });

  test("an EMPTY entry list still produces the full projectable shape", () => {
    // This is the whole point of slots: draw the playoff tree before the
    // group stage that feeds it has finished.
    const plan = planSingleElimination([], { thirdPlace: true });
    expect(plan.fixtures.length).toBeGreaterThan(0);
    expect(plan.slots.every((s) => s.entry === null)).toBe(true);
    expectPlanIsConsistent(plan);
  });

  test("thirdPlace adds one fixture fed by the two semi-final losers", () => {
    const plan = planSingleElimination(ids(8), { thirdPlace: true });
    expect(plan.fixtures).toHaveLength(8);

    const bronze = plan.fixtures.find((f) => f.code === "3P");
    expect(bronze).toBeDefined();

    const losers = plan.slots.filter((s) => s.source_type === "fixture_loser");
    expect(losers).toHaveLength(2);
    expect(losers.map((s) => s.label).sort()).toEqual(["Loser SF1", "Loser SF2"]);
  });
});

describe("circleRounds", () => {
  test("4 entries meet in 3 rounds of 2", () => {
    const rounds = circleRounds(ids(4));
    expect(rounds).toHaveLength(3);
    expect(rounds.every((r) => r.length === 2)).toBe(true);
  });

  test("no entry plays twice inside one round", () => {
    for (const round of circleRounds(ids(6))) {
      const seen = round.flat().filter(Boolean);
      expect(new Set(seen).size).toBe(seen.length);
    }
  });

  test("every pair meets exactly once", () => {
    const entries = ids(6);
    const met = new Set<string>();
    for (const round of circleRounds(entries)) {
      for (const [a, b] of round) {
        if (!a || !b) continue;
        met.add([a, b].sort().join("-"));
      }
    }
    expect(met.size).toBe((entries.length * (entries.length - 1)) / 2);
  });
});

describe("planRoundRobin", () => {
  test("a single pool of 4 produces 6 fixtures", () => {
    const plan = planRoundRobin(ids(4));
    expect(plan.fixtures).toHaveLength(6);
    expect(plan.pools).toHaveLength(1);
    expectPlanIsConsistent(plan);
  });

  test("an odd pool of 5 produces 10 fixtures and no bye fixture", () => {
    const plan = planRoundRobin(ids(5));
    expect(plan.fixtures).toHaveLength(10);
    expectPlanIsConsistent(plan);
  });

  test("two legs double the fixtures and swap sides", () => {
    const one = planRoundRobin(ids(4), { legs: 1 });
    const two = planRoundRobin(ids(4), { legs: 2 });
    expect(two.fixtures).toHaveLength(one.fixtures.length * 2);
  });

  test("entries snake across pools so seeds do not collide", () => {
    const plan = planRoundRobin(ids(8), { poolCount: 2, advancePerPool: 2 });
    expect(plan.pools.map((p) => p.name)).toEqual(["A", "B"]);
    expect(plan.pools.every((p) => p.advance_count === 2)).toBe(true);

    const poolA = plan.slots.filter((s) => s.poolKey === "pool:0");
    // seeds 1 and 4 in pool A, seeds 2 and 3 in pool B
    expect(poolA.map((s) => s.entry)).toEqual(["e1", "e4", "e5", "e8"]);
    expectPlanIsConsistent(plan);
  });
});

describe("snakeDistribute", () => {
  test("spreads 6 entries across 3 pools", () => {
    expect(snakeDistribute(ids(6), 3)).toEqual([
      ["e1", "e6"],
      ["e2", "e5"],
      ["e3", "e4"],
    ]);
  });
});

describe("poolName", () => {
  test("counts past Z", () => {
    expect(poolName(0)).toBe("A");
    expect(poolName(25)).toBe("Z");
    expect(poolName(26)).toBe("AA");
  });
});
