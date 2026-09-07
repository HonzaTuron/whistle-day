import type { EntryStatus } from "@whistleday/engine";
import type { Admission } from "../api/organiser";
import type { Translate } from "./i18n";

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
 * Split pasted text into a list of team names.
 * Supports newlines, tabs, commas, and semicolons, trimming quotes and whitespace.
 */
export function parsePastedTeams(raw: string): string[] {
  let items: string[];
  if (raw.includes("\n")) {
    items = raw.split(/\r?\n/);
  } else if (raw.includes("\t")) {
    items = raw.split("\t");
  } else if (raw.includes(",") || raw.includes(";")) {
    items = raw.split(/[,;]/);
  } else {
    items = [raw];
  }
  return items
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter((s) => s.length > 0);
}

/**
 * Whether a team is still taking part.
 *
 * Withdrawn and disqualified differ in why, and in nothing this screen does
 * about it: both are struck through in the list, both stop appearing in a
 * draw. The reason belongs on the record and in the log, not in a branch.
 */
export const isOut = (entry: { status: EntryStatus }) =>
  entry.status === "withdrawn" || entry.status === "disqualified";

/**
 * What to tell somebody about the team they have just added.
 *
 * The server answers with a line per stage, and most of those lines are "there
 * was nothing to do here" — an ungenerated stage, a playoff nobody is added
 * to. What the organiser wants to know is where the team actually landed and
 * how much they now owe, so the first stage that did something is the one that
 * gets said out loud.
 *
 * When nothing did anything the team is still in: they were added before the
 * draw, which is the easy case and worth confirming rather than passing over
 * in silence.
 */
export function admissionNotice(
  t: Translate,
  name: string,
  stages: Admission[],
  poolName: (id: string) => string,
): string {
  for (const stage of stages) {
    switch (stage.action) {
      case "pool":
        return t("teams.joinedPool", {
          name,
          pool: poolName(stage.pool ?? ""),
          count: stage.fixtures,
        });
      case "field":
        return t("teams.joinedField", { name, stage: stage.name });
      case "redrawn":
        return t("teams.joinedRedrawn", { name, stage: stage.name });
    }
  }
  return t("teams.joinedWaiting", { name });
}
