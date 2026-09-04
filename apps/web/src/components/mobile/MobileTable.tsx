import type { DisplayPayload, DisplayPool } from "@whistleday/engine";
import { entryName } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { tiebreakNote } from "../../lib/tiebreak";

export function MobileTable({
  payload,
  pool,
}: {
  payload: DisplayPayload;
  pool: DisplayPool;
}) {
  const t = useT();
  const note = tiebreakNote(t, pool);

  return (
    <>
      <table className="mini-table">
        <thead>
          <tr>
            <th />
            <th className="mini-table__team">{t("common.team")}</th>
            <th title={t("table.playedFull")}>{t("table.played")}</th>
            <th>{t("table.sets")}</th>
            <th title={t("table.pointsFull")}>{t("table.points")}</th>
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
