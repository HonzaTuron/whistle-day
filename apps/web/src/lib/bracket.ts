import type { DisplayFixture, DisplayStage } from "@seedly/engine";
import type { Translate } from "./i18n";

/**
 * Name a round by how far it is from the end, not by how many fixtures it
 * holds. A third-place match sits in the same round as the final, so counting
 * fixtures labels the final round "Semi-finals".
 *
 * 16 and 32 are named rather than counted, because Czech has a single word for
 * each of them — osmifinále, šestnáctifinále — and no phrase that means "round
 * of n" in general. Anything deeper falls back to the generic sentence, which
 * is a bracket nobody is running off a phone.
 */
export function roundTitle(t: Translate, roundsRemaining: number): string {
  switch (roundsRemaining) {
    case 1:
      return t("bracket.final");
    case 2:
      return t("bracket.semis");
    case 3:
      return t("bracket.quarters");
    case 4:
      return t("bracket.round16");
    case 5:
      return t("bracket.round32");
    default:
      return t("bracket.roundOf", { size: 2 ** roundsRemaining });
  }
}

export interface BracketRound {
  round: number;
  title: string;
  /** The tree itself, third-place match excluded. */
  fixtures: DisplayFixture[];
  /** Shares a round with the final but is not part of the tree. */
  thirdPlace?: DisplayFixture;
}

const isThirdPlace = (fixture: DisplayFixture) => fixture.code === "3P";

/**
 * Both screens render the same rounds; only the layout differs. Keeping the
 * shape here means a title fix lands on the projector and the phone at once.
 */
export function bracketRounds(t: Translate, stage: DisplayStage): BracketRound[] {
  const pool = stage.pools.find((p) => p.kind !== "group");
  if (!pool) return [];

  const rounds = pool.rounds
    .map((round) => ({
      round: round.round,
      fixtures: round.fixtures.filter((f) => !isThirdPlace(f)),
      thirdPlace: round.fixtures.find(isThirdPlace),
    }))
    .filter((round) => round.fixtures.length > 0 || round.thirdPlace);

  return rounds.map((round, index) => ({
    ...round,
    title: roundTitle(t, rounds.length - index),
  }));
}
