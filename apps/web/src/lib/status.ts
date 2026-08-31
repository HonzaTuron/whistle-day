/**
 * What a fixture's status means, in the one place every screen reads it from.
 *
 * There were three copies of this list — the results board, the organiser's
 * stage bar, and the projector's — and they agreed until `cancelled` existed.
 * A match cancelled because a team was taken out is the first status that is
 * neither a result nor outstanding work, so it is the first one that can make
 * two counters built from the same fixtures disagree about the same day.
 */

/** Settled: there is an outcome, whether or not anybody played for it. */
const SETTLED = ["finished", "walkover", "bye"];

export const isSettledStatus = (status: string) => SETTLED.includes(status);

/**
 * Nobody is going to play this one.
 *
 * It leaves every denominator rather than counting as done: a day with two
 * cancelled matches is a day of four matches, not a day of six that can only
 * ever reach four.
 */
export const isCancelledStatus = (status: string) => status === "cancelled";

/** The matches a progress count is about at all. */
export const counts = <T extends { status: string }>(fixtures: T[]) =>
  fixtures.filter((f) => !isCancelledStatus(f.status));
