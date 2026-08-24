import { sideName, type BoardRow } from "../../lib/board";

interface Props {
  row: BoardRow;
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
export function FixtureRow({ row, onOpen }: Props) {
  const score = row.settled
    ? `${row.fixture.home_score ?? 0}–${row.fixture.away_score ?? 0}`
    : "";

  const content = (
    <>
      <span className="match__code">{row.fixture.code}</span>
      <span className="match__teams">
        <span className={winner(row, "home")}>{sideName(row.home)}</span>
        <span className={winner(row, "away")}>{sideName(row.away)}</span>
      </span>
      <span className="match__result">{score || (row.playable ? "Enter" : "Waiting")}</span>
    </>
  );

  if (!row.playable) {
    return <div className="match match--waiting">{content}</div>;
  }

  return (
    <button
      type="button"
      className={"match" + (row.settled ? " match--done" : "")}
      onClick={onOpen}
    >
      {content}
    </button>
  );
}

function winner(row: BoardRow, side: "home" | "away"): string {
  const entry = side === "home" ? row.home.entry : row.away.entry;
  const pending = entry === null ? " is-pending" : "";
  const won = row.settled && entry !== null && row.fixture.winner === entry.id;
  return "match__team" + pending + (won ? " is-winner" : "");
}
