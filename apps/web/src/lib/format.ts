import type {
  DisplayEntry,
  DisplayFixture,
  DisplayPayload,
  DisplaySide,
} from "@seedly/engine";
import type { Translate } from "./i18n";
import { renderLabel } from "./labels";

/**
 * What to draw for one side of a fixture.
 *
 * A side is either a real entry or a placeholder the server described for us —
 * a winner of some fixture, a rank in some pool. Callers never need to know
 * which, and never need to know that the description arrives as a kind and a
 * set of arguments rather than as a sentence.
 */
export function sideName(
  t: Translate,
  side: DisplaySide,
  entries: Record<string, DisplayEntry>,
  prefer: "short" | "full" = "full",
): string {
  const placeholder = () =>
    renderLabel(t, side.label || t("label.tbd"), side.label_kind, side.label_args);

  if (!side.entry) return placeholder();
  const entry = entries[side.entry];
  if (!entry) return placeholder();
  if (prefer === "short" && entry.short_name) return entry.short_name;
  return entry.name;
}

export function isPlaceholder(side: DisplaySide): boolean {
  return side.entry === "";
}

export function entryName(
  id: string,
  entries: Record<string, DisplayEntry>,
  prefer: "short" | "full" = "full",
): string {
  const entry = entries[id];
  if (!entry) return "—";
  if (prefer === "short" && entry.short_name) return entry.short_name;
  return entry.name;
}

export function courtName(id: string, payload: DisplayPayload): string {
  return payload.courts.find((c) => c.id === id)?.name ?? "";
}

/**
 * "14:30", or "" when a fixture has no scheduled time.
 *
 * Formatted in the language the screen is in rather than the browser's — a
 * projector driven by a laptop set to US English should still put a Czech
 * hall's schedule on the wall the way the hall reads it.
 */
export function timeOfDay(locale: string, iso: string): string {
  if (!iso) return "";
  const parsed = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

/**
 * The scoreline for a whole fixture, as one string.
 *
 * A walkover carries an outcome and no score, so it says so. Printing the 0:0
 * it stores would put a scoreline on the wall for a match nobody played — and
 * every screen drew its own scores by hand until one did exactly that.
 */
export function scoreline(t: Translate, fixture: DisplayFixture): string {
  if (!isDecided(fixture)) return "";
  if (fixture.status === "walkover") return t("match.walkoverShort");
  return `${fixture.home.score} : ${fixture.away.score}`;
}

/**
 * The same question for one side of a fixture, which is how a bracket cell and
 * a phone card are laid out. The side that took a walkover is marked; nothing
 * is invented for the side that did not turn up.
 */
export function sideScore(
  t: Translate,
  fixture: DisplayFixture,
  which: "home" | "away",
): string {
  const side = fixture[which];
  if (fixture.status === "walkover") {
    return side.entry !== "" && fixture.winner === side.entry
      ? t("match.walkoverShort")
      : "";
  }
  return String(side.score);
}

export function isDecided(fixture: DisplayFixture): boolean {
  return ["finished", "walkover", "bye"].includes(fixture.status);
}

/** Pools that carry a league table, as opposed to bracket sides. */
export function tablePools(payload: DisplayPayload) {
  return payload.stages.flatMap((stage) =>
    stage.pools
      .filter((pool) => pool.kind === "group" && pool.standings.length > 0)
      .map((pool) => ({ stage, pool })),
  );
}

/** Stages drawn as a bracket rather than a table. */
export function bracketStages(payload: DisplayPayload) {
  return payload.stages.filter((stage) =>
    stage.pools.some(
      (pool) => pool.kind !== "group" && pool.rounds.some((r) => r.fixtures.length > 0),
    ),
  );
}
