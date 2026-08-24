import type { Court } from "@seedly/engine";
import { sideName, timeValue, type BoardRow } from "../../lib/board";

interface Props {
  row: BoardRow;
  courts: Court[];
  onOpen: () => void;
}

/**
 * One match in the list.
 *
 * A row that cannot be played is not a disabled button — it is a statement
 * that this match is still waiting for someone. So it renders as text with the
 * slot labels the server wrote ("Winner SF1", "1. A") and no affordance at
 * all, rather than something tappable that refuses to do anything.
 */
export function FixtureRow({ row, courts, onOpen }: Props) {
  // Where and when, when they are known. This is the line the organiser reads
  // to answer "what is on court two?" without opening anything.
  const court = courts.find((c) => c.id === row.fixture.court)?.name ?? "";
  const time = timeValue(row.fixture.scheduled_at);
  const where = [court, time].filter(Boolean).join(" · ");

  const content = (
    <>
      <span className="match__code">{row.fixture.code}</span>
      <span className="match__teams">
        <span className={winner(row, "home")}>{sideName(row.home)}</span>
        <span className={winner(row, "away")}>{sideName(row.away)}</span>
        {/* Under the names rather than beside the code: "Court 1 · 18:30" is
            wider than a match code and would either squeeze the names or run
            underneath them. */}
        {where ? <span className="match__where">{where}</span> : null}
      </span>
      <span className="match__result">{result(row)}</span>
    </>
  );

  if (!row.playable) {
    return <div className="match match--waiting">{content}</div>;
  }

  return (
    <button
      type="button"
      className={
        "match" +
        (row.settled ? " match--done" : "") +
        (row.live ? " match--live" : "")
      }
      onClick={onOpen}
    >
      {content}
    </button>
  );
}

function result(row: BoardRow) {
  if (row.walkover) return "w/o";
  if (row.settled) return `${row.fixture.home_score ?? 0}–${row.fixture.away_score ?? 0}`;
  if (row.live) return <span className="match__live">Live</span>;
  return row.playable ? "Enter" : "Waiting";
}

function winner(row: BoardRow, side: "home" | "away"): string {
  const entry = side === "home" ? row.home.entry : row.away.entry;
  const pending = entry === null ? " is-pending" : "";
  const won = row.settled && entry !== null && row.fixture.winner === entry.id;
  return "match__team" + pending + (won ? " is-winner" : "");
}
