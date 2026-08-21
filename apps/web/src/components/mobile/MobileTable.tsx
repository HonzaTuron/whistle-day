import type { DisplayPayload, DisplayPool } from "@seedly/engine";
import { entryName } from "../../lib/format";
import { tiebreakNote } from "../../lib/tiebreak";

export function MobileTable({
  payload,
  pool,
}: {
  payload: DisplayPayload;
  pool: DisplayPool;
}) {
  const note = tiebreakNote(pool);

  return (
    <>
      <table className="mini-table">
        <thead>
          <tr>
            <th />
            <th className="mini-table__team">Team</th>
            <th>P</th>
            <th>Sets</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {pool.standings.map((row) => (
            <tr key={row.entry} className={row.qualified ? "is-qualified" : undefined}>
              <td className="mini-table__rank">{row.position}</td>
              <td className="mini-table__team">
                {entryName(row.entry, payload.entries)}
              </td>
              <td>{row.played}</td>
              <td className="mini-table__sets">
                {row.score_for}:{row.score_against}
              </td>
              <td className="mini-table__points">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {note && <p className="mini-table__note">{note}</p>}
    </>
  );
}
