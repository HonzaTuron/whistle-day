import type { Entry, Id, Pool, Stage } from "@seedly/engine";
import type { Board, BoardFixture } from "../api/organiser";

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
}

export interface BoardRow {
  fixture: BoardFixture;
  home: FixtureSide;
  away: FixtureSide;
  /** Both sides known, so a result can actually be entered. */
  playable: boolean;
  settled: boolean;
}

export interface BoardSection {
  key: string;
  /** "Groups" */
  stage: string;
  /** "Group A", or "" for a bracket with a single pool. */
  pool: string;
  rows: BoardRow[];
}

const SETTLED = ["finished", "walkover", "bye"];

function side(
  entryId: Id | null,
  slotLabel: string | undefined,
  entries: Map<Id, Entry>,
): FixtureSide {
  const entry = entryId ? entries.get(entryId) ?? null : null;
  return { entry, label: slotLabel ?? "TBD" };
}

export function toRow(fixture: BoardFixture, entries: Map<Id, Entry>): BoardRow {
  const home = side(fixture.home_entry, fixture.expand?.home_slot?.label, entries);
  const away = side(fixture.away_entry, fixture.expand?.away_slot?.label, entries);
  return {
    fixture,
    home,
    away,
    playable: home.entry !== null && away.entry !== null,
    settled: SETTLED.includes(fixture.status),
  };
}

/**
 * Group into stage/pool sections, in the order the day is played.
 *
 * Fixtures arrive sorted by round and position, which is right within a pool
 * and meaningless across them — a stage's position is what orders the day, and
 * that lives on the stage record.
 */
export function sections(board: Board, rows: BoardRow[]): BoardSection[] {
  const stages = new Map<Id, Stage>(board.stages.map((stage) => [stage.id, stage]));
  const pools = new Map<Id, Pool>(board.pools.map((pool) => [pool.id, pool]));
  const grouped = new Map<string, BoardSection>();

  for (const row of rows) {
    const stage = stages.get(row.fixture.stage);
    const pool = row.fixture.pool ? pools.get(row.fixture.pool) : undefined;
    const key = `${row.fixture.stage}:${row.fixture.pool ?? ""}`;

    let section = grouped.get(key);
    if (!section) {
      section = {
        key,
        stage: stage?.name ?? "",
        // A bracket's single "Main" pool is noise; a group's letter is not.
        pool: pool && pool.kind === "group" ? `Group ${pool.name}` : "",
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

export const sideName = (side: FixtureSide) => side.entry?.name ?? side.label;

export interface Progress {
  played: number;
  total: number;
}

/**
 * Byes count as played because nobody can play them: leaving them in the
 * denominator means the count never reaches the end of a bracket that had one.
 */
export function progress(rows: BoardRow[]): Progress {
  return {
    played: rows.filter((row) => row.settled).length,
    total: rows.length,
  };
}
