import { describe, expect, test } from "bun:test";
import type { ScoringConfig } from "@whistleday/engine";
import { canAddSet, matchIsDecided, scoreFault, setsToWin } from "./bestof";

/**
 * The sheet and the server have to agree about what a legal result is. If they
 * do not, an organiser is told the match is saved and then told half an hour
 * later — when the queue drains — that it was not.
 */

const scored = (bestOf: number): ScoringConfig =>
  ({ bestOf, pointsWin: 2, pointsDraw: 0, pointsLoss: 0, tiebreakers: [] }) as ScoringConfig;

describe("setsToWin", () => {
  test("a single game is not a series", () => {
    expect(setsToWin(scored(1))).toBe(0);
    expect(setsToWin(scored(0))).toBe(0);
    expect(setsToWin(null)).toBe(0);
  });

  test("best of three is first to two", () => {
    expect(setsToWin(scored(3))).toBe(2);
    expect(setsToWin(scored(5))).toBe(3);
  });
});

describe("scoreFault", () => {
  test("a best of three ends 2–0 or 2–1", () => {
    expect(scoreFault(3, 2, 0)).toBeNull();
    expect(scoreFault(3, 2, 1)).toBeNull();
    expect(scoreFault(3, 1, 2)).toBeNull();
  });

  test("and does not end before somebody has two", () => {
    expect(scoreFault(3, 1, 0)).toBe("unfinished");
    expect(scoreFault(3, 0, 0)).toBe("unfinished");
    expect(scoreFault(3, 1, 1)).toBe("unfinished");
  });

  test("or after there is nothing left to play", () => {
    expect(scoreFault(3, 3, 0)).toBe("over");
    expect(scoreFault(3, 2, 2)).toBe("over");
  });

  test("a format that says nothing refuses nothing", () => {
    expect(scoreFault(1, 5, 2)).toBeNull();
    expect(scoreFault(0, 5, 2)).toBeNull();
  });
});

describe("matchIsDecided", () => {
  test("the second set of a best of three ends it", () => {
    expect(matchIsDecided(scored(3), 1, 1)).toBe(false);
    expect(matchIsDecided(scored(3), 2, 1)).toBe(true);
  });

  test("a single game is never decided by sets", () => {
    expect(matchIsDecided(scored(1), 3, 0)).toBe(false);
  });
});

describe("canAddSet", () => {
  test("a best of three has room for a third", () => {
    expect(canAddSet(scored(3), 2, 1, 1)).toBe(true);
  });

  test("but not for a fourth", () => {
    expect(canAddSet(scored(3), 3, 2, 1)).toBe(false);
  });

  test("and not once the match is won", () => {
    expect(canAddSet(scored(3), 2, 2, 0)).toBe(false);
  });

  test("a day with no format keeps whatever it was doing", () => {
    expect(canAddSet(null, 7, 4, 3)).toBe(true);
  });
});
