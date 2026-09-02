import type { DisplayPayload, DisplayPool } from "@seedly/engine";
import type { CSSProperties } from "react";
import { entryName } from "../../lib/format";
import { tiebreakNote } from "../../lib/tiebreak";

export function StandingsPanel({
  payload,
  pool,
}: {
  payload: DisplayPayload;
  pool: DisplayPool;
}) {
  const note = tiebreakNote(pool);

  return (
    <div className="standings">
      <table className="table" style={{ "--rows": pool.standings.length } as CSSProperties}>
        <thead>
          <tr>
            <th className="table__rank" />
            <th className="table__team">Team</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th className="table__sets">Sets</th>
            <th className="table__points">Pts</th>
          </tr>
        </thead>
        <tbody>
          {pool.standings.map((row) => (
            <tr key={row.entry} className={row.qualified ? "is-qualified" : undefined}>
              <td className="table__rank">{row.position}</td>
              <td className="table__team">{entryName(row.entry, payload.entries)}</td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.drawn}</td>
              <td>{row.lost}</td>
              <td className="table__sets">
                {row.score_for}:{row.score_against}
              </td>
              <td className="table__points">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {note && <p className="standings__note">{note}</p>}
    </div>
  );
}
