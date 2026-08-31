import type { EntryStatus } from "@seedly/engine";

/**
 * `entries.short_name` is capped at 16 characters and is what the projector
 * draws — a full club name wrecks a bracket cell read from five metres away.
 * Nobody wants to type every team twice, so it is derived and only put in
 * front of the organiser when the derivation had to throw something away.
 */

export const SHORT_NAME_MAX = 16;

/**
 * Keep the longest run of leading words that fits.
 *
 * No rule gets this right for every naming convention — "Bears Athletic Club
 * Prague" is the Bears, "TJ Sokol Dolní Počernice" is Dolní Počernice, and the
 * two want opposite ends of the string. So the derivation is the predictable
 * one, "we cut the end off", and the result is put in front of the organiser
 * to correct whenever it had to cut anything at all. A cleverer guess that is
 * wrong half the time is worse than an obvious one that is easy to fix.
 */
export function suggestShortName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length <= SHORT_NAME_MAX) return trimmed;

  const words = trimmed.split(" ");
  for (let end = words.length - 1; end > 0; end--) {
    const head = words.slice(0, end).join(" ");
    if (head.length <= SHORT_NAME_MAX) return head;
  }

  // One very long word. Cut it rather than let the server reject the record.
  return trimmed.slice(0, SHORT_NAME_MAX);
}

export const isDuplicateName = (name: string, existing: { name: string }[]) =>
  existing.some((team) => team.name.trim().toLowerCase() === name.trim().toLowerCase());

/**
 * Whether a team is still taking part.
 *
 * Withdrawn and disqualified differ in why, and in nothing this screen does
 * about it: both are struck through in the list, both stop appearing in a
 * draw. The reason belongs on the record and in the log, not in a branch.
 */
export const isOut = (entry: { status: EntryStatus }) =>
  entry.status === "withdrawn" || entry.status === "disqualified";
