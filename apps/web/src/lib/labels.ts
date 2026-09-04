import type { LabelArgs, LabelKind } from "@whistleday/engine";
import type { MessageKey, Translate } from "./i18n";

/**
 * Saying what the server wrote, in the language the screen is in.
 *
 * A bracket is drawn long before it is played, so most of what is on a wall
 * early in the day is not a team name — it is "Winner QF1", "1. A", "Bye".
 * Those are generated at the moment a stage is drawn and stored in English,
 * which is fine as a record and useless as a sentence: a projector cannot
 * translate prose, only look a message up.
 *
 * So the record carries the facts alongside the prose — a kind and its
 * arguments — and this is where they become a sentence again.
 *
 * The English text is still sent and is still the fallback. A tournament drawn
 * before the kinds existed has no kind, and a kind added to the server before
 * this catalogue knows it is the same case: the label says what it always
 * said, in the language it was written in, rather than a screen going blank
 * over a translation.
 */

const KEYS: Record<LabelKind, MessageKey> = {
  bye: "label.bye",
  tbd: "label.tbd",
  winner_of: "label.winner_of",
  loser_of: "label.loser_of",
  pool_seed: "label.pool_seed",
  pool_rank: "label.pool_rank",
  best_of_rank: "label.best_of_rank",
  // A Swiss starting position is "S1" in every language, and the number is the
  // whole message.
  swiss_seed: "label.pool_seed",
  main: "pool.main",
  winners: "pool.winners",
  losers: "pool.losers",
  final: "pool.final",
  swiss: "pool.swiss",
  groups: "stage.groups",
  group: "stage.group",
  playoff: "stage.playoff",
  double_elim: "stage.double_elim",
};

/**
 * "1st" in English, "1." in Czech.
 *
 * The server sends the number, not the word: it has no business knowing that
 * English spells the third one "3rd" and Czech spells all of them the same.
 * The rule below is English's, and every other language answers it by giving
 * the same form four times.
 */
function ordinal(t: Translate, n: number): string {
  const teens = n % 100 >= 11 && n % 100 <= 13;
  const key: MessageKey = teens
    ? "ordinal.other"
    : n % 10 === 1
      ? "ordinal.one"
      : n % 10 === 2
        ? "ordinal.two"
        : n % 10 === 3
          ? "ordinal.few"
          : "ordinal.other";
  return t(key, { n });
}

/**
 * Turn a stored label into the sentence this screen should show.
 *
 * `fallback` is the text the server composed, and it is what comes back
 * whenever the kind is missing or unrecognised.
 */
export function renderLabel(
  t: Translate,
  fallback: string,
  kind?: LabelKind | string,
  args?: LabelArgs,
): string {
  if (!kind) return fallback;

  const key = KEYS[kind as LabelKind];
  if (!key) return fallback;

  // "1st best 3rd": both arguments arrive as numbers and are worded here,
  // because which of them needs a suffix is a question about English.
  if (kind === "best_of_rank") {
    const index = Number(args?.index ?? 0);
    const place = Number(args?.place ?? 0);
    return t(key, { index: ordinal(t, index), place: ordinal(t, place) });
  }

  // A Swiss seed stores only its position; the message expects the same two
  // gaps as a pool seed, with nothing in the first.
  if (kind === "swiss_seed") {
    return t(key, { pool: "S", position: Number(args?.position ?? 0) });
  }

  return args ? t(key, args) : t(key);
}
