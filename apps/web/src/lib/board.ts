import type { Court, Entry, Id, LabelArgs, LabelKind, Pool, Stage } from "@whistleday/engine";
import type { Board, BoardFixture, SetScore } from "../api/organiser";
import type { Translate } from "./i18n";
import { renderLabel } from "./labels";
import { isCancelledStatus, isSettledStatus } from "./status";

/**
 * Shaping the organiser's fixture list.
 *
 * The projector groups fixtures by what makes a good panel; this groups them
 * by what a person with a clipboard walks through — stage, then group, then
 * round order. `lib/format.ts` does the same job for the read-only screens and
 * cannot be reused: it works from the display payload, which has already been
 * assembled and stripped of the record ids this screen writes back to.
 */

export interface FixtureSide {
  /** The team, when the slot has resolved. */
  entry: Entry | null;
  /** "Winner SF1", "1. A" — the server's wording for an unresolved slot. */
  label: string;
  /** The same, as facts, so the screen can word it itself. See lib/labels.ts. */
  labelKind?: LabelKind;
  labelArgs?: LabelArgs;
}

export interface BoardRow {
  fixture: BoardFixture;
  home: FixtureSide;
  away: FixtureSide;
  /** Both sides known, so a result can actually be entered. */
  playable: boolean;
  settled: boolean;
  live: boolean;
  walkover: boolean;
  /**
   * Nobody is going to play this one. It is what a match becomes when a team
   * is taken out and their results are struck — not a result, and not
   * outstanding work either.
   */
  cancelled: boolean;
}

/**
 * The match score, counted from the points.
 *
 * A set with the same score on both sides is nobody's — that includes the
 * 0–0 a set is added as, which is what keeps a half-entered match from
 * announcing a result the hall has not seen.
 */
export function setsWon(sets: SetScore[]): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const set of sets) {
    if (set.home > set.away) home++;
    else if (set.away > set.home) away++;
  }
  return { home, away };
}

export interface BoardSection {
  key: string;
  /** "Groups" */
  stage: string;
  /** "Group A", or "" for a bracket with a single pool. */
  pool: string;
  rows: BoardRow[];
}

function side(
  entryId: Id | null,
  slot: { label: string; label_kind?: LabelKind; label_args?: LabelArgs } | undefined,
  entries: Map<Id, Entry>,
): FixtureSide {
  const entry = entryId ? entries.get(entryId) ?? null : null;
  return {
    entry,
    // "TBD" is the last resort and carries a kind of its own, so a screen with
    // nothing else to draw still draws it in the right language.
    label: slot?.label ?? "TBD",
    labelKind: slot?.label_kind ?? (slot ? undefined : "tbd"),
    ...(slot?.label_args ? { labelArgs: slot.label_args } : {}),
  };
}

export function toRow(fixture: BoardFixture, entries: Map<Id, Entry>): BoardRow {
  const home = side(fixture.home_entry, fixture.expand?.home_slot, entries);
  const away = side(fixture.away_entry, fixture.expand?.away_slot, entries);
  return {
    fixture,
    home,
    away,
    playable: home.entry !== null && away.entry !== null,
    settled: isSettledStatus(fixture.status),
    live: fixture.status === "live",
    walkover: fixture.status === "walkover",
    cancelled: isCancelledStatus(fixture.status),
  };
}

/**
 * Group into stage/pool sections, in the order the day is played.
 *
 * Fixtures arrive sorted by round and position, which is right within a pool
 * and meaningless across them — a stage's position is what orders the day, and
 * that lives on the stage record.
 */
export function sections(t: Translate, board: Board, rows: BoardRow[]): BoardSection[] {
  const stages = new Map<Id, Stage>(board.stages.map((stage) => [stage.id, stage]));
  const pools = new Map<Id, Pool>(board.pools.map((pool) => [pool.id, pool]));
  const grouped = new Map<string, BoardSection>();

  // A stage with one group is just the stage. Labelling it "Group · Group A"
  // says the same thing twice; the letter only earns its place once there is a
  // B to tell it from.
  const poolsInStage = new Map<Id, number>();
  for (const pool of board.pools) {
    poolsInStage.set(pool.stage, (poolsInStage.get(pool.stage) ?? 0) + 1);
  }

  for (const row of rows) {
    const stage = stages.get(row.fixture.stage);
    const pool = row.fixture.pool ? pools.get(row.fixture.pool) : undefined;
    const key = `${row.fixture.stage}:${row.fixture.pool ?? ""}`;

    let section = grouped.get(key);
    if (!section) {
      section = {
        key,
        stage: stage
          ? renderLabel(t, stage.name, stage.name_kind)
          : "",
        pool:
          pool && pool.kind === "group" && (poolsInStage.get(pool.stage) ?? 0) > 1
            ? t("board.groupNamed", {
                name: renderLabel(t, pool.name, pool.name_kind),
              })
            : "",
        rows: [],
      };
      grouped.set(key, section);
    }
    section.rows.push(row);
  }

  return [...grouped.values()].sort((a, b) => {
    const [stageA] = a.key.split(":");
    const [stageB] = b.key.split(":");
    const positionA = stages.get(stageA)?.position ?? 0;
    const positionB = stages.get(stageB)?.position ?? 0;
    if (positionA !== positionB) return positionA - positionB;
    return a.pool.localeCompare(b.pool);
  });
}

export const sideName = (t: Translate, side: FixtureSide) =>
  side.entry?.name ?? renderLabel(t, side.label, side.labelKind, side.labelArgs);

/**
 * The scheduled time as an <input type="time"> value, and back again.
 *
 * The input speaks local wall-clock time and the record stores UTC, so the
 * conversion has to go through a Date either way. Times are what a hall runs
 * on; the date comes from whatever the fixture already had, or today.
 */
export function timeValue(scheduledAt: string): string {
  if (!scheduledAt) return "";
  const parsed = new Date(scheduledAt.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return "";
  return `${String(parsed.getHours()).padStart(2, "0")}:${String(
    parsed.getMinutes(),
  ).padStart(2, "0")}`;
}

export function atTime(scheduledAt: string, value: string): string {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  const base = scheduledAt ? new Date(scheduledAt.replace(" ", "T")) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  base.setHours(hours, minutes, 0, 0);
  return base.toISOString().replace("T", " ");
}

export interface ScheduleConflict {
  fixtureId: Id;
  code: string;
  team: string;
  court: string;
  time: string;
}

/**
 * A team cannot be in two places at once — but the organiser can put it there,
 * and this is what notices.
 *
 * It warns rather than refuses. Reshuffling a schedule passes through states
 * that are briefly wrong on purpose, and a rejection in the middle of that is
 * worse than a line of text saying what is about to go wrong.
 */
export function scheduleConflicts(
  fixture: BoardFixture,
  allFixtures: BoardFixture[],
  entries: Map<Id, Entry>,
  courts: Court[],
): ScheduleConflict[] {
  const time = fixture.scheduled_at;
  if (!time) return [];
  const teams = [fixture.home_entry, fixture.away_entry].filter(Boolean) as Id[];
  if (teams.length === 0) return [];

  const conflicts: ScheduleConflict[] = [];
  for (const other of allFixtures) {
    if (other.id === fixture.id) continue;
    const otherTime = other.scheduled_at;
    if (!otherTime) continue;
    if (!timesOverlap(time, otherTime)) continue;

    const otherTeams = [other.home_entry, other.away_entry].filter(Boolean) as Id[];
    for (const teamId of teams) {
      if (!otherTeams.includes(teamId)) continue;
      conflicts.push({
        fixtureId: other.id,
        code: other.code,
        team: entries.get(teamId)?.name ?? teamId,
        court: courts.find((court) => court.id === other.court)?.name ?? "",
        time: timeValue(otherTime),
      });
    }
  }
  return conflicts;
}

/**
 * Close enough to be the same slot.
 *
 * `scheduled_at` is a start time, not a booking window, so two matches clash
 * when they start close together rather than when they are set to the same
 * minute — nobody schedules a team at 10:00 and 10:15 on purpose either.
 * MATCH_MINUTES in lib/presets.ts is the same estimate seen from the other
 * end: how long a court slot takes.
 */
const CLASH_MINUTES = 90;

function timesOverlap(a: string, b: string): boolean {
  const first = new Date(a.replace(" ", "T")).getTime();
  const second = new Date(b.replace(" ", "T")).getTime();
  if (Number.isNaN(first) || Number.isNaN(second)) return false;
  return Math.abs(first - second) < CLASH_MINUTES * 60_000;
}

export interface Progress {
  played: number;
  total: number;
}

/**
 * Byes count as played because nobody can play them: leaving them in the
 * denominator means the count never reaches the end of a bracket that had one.
 *
 * A cancelled match leaves the denominator altogether, for the same reason
 * pointing the other way. It is not work outstanding and it is not a result
 * either — it is a match that is not going to happen, and counting it as
 * unplayed would leave a finished day reading "10 of 12 matches in" for ever.
 */
export function progress(rows: BoardRow[]): Progress {
  const counted = rows.filter((row) => !row.cancelled);
  return {
    played: counted.filter((row) => row.settled).length,
    total: counted.length,
  };
}
