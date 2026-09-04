import type { DisplayPool, Tiebreaker } from "@whistleday/engine";
import type { Translate } from "./i18n";
import { TIEBREAK_LABELS } from "./scoring";

/**
 * When teams finish level, the hall wants to know why one is above the other.
 * The server records which criteria it actually needed; this turns that into a
 * sentence instead of leaving people to guess.
 *
 * Returns null when points alone decided the table, which is most of the time.
 */
export function tiebreakNote(t: Translate, pool: DisplayPool): string | null {
  const beyondPoints = new Set<Tiebreaker>();

  for (const row of pool.standings) {
    for (const criterion of row.tiebreak ?? []) {
      if (criterion !== "points") beyondPoints.add(criterion);
    }
  }
  if (beyondPoints.size === 0) return null;

  const named = [...beyondPoints].map((c) =>
    TIEBREAK_LABELS[c] ? t(TIEBREAK_LABELS[c].inline) : c,
  );
  // "a, b and then c" is built from a list message rather than joined here:
  // the comma, the conjunction and where it goes are the language's business.
  const last = named.pop()!;
  const criteria =
    named.length > 0
      ? t("tiebreak.noteList", { list: named.join(", "), last })
      : last;
  return t("tiebreak.note", { criteria });
}
