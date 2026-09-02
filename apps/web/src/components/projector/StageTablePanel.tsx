import type { DisplayPayload, DisplayStage } from "@seedly/engine";
import type { CSSProperties } from "react";
import { entryName } from "../../lib/format";
import { useT } from "../../lib/i18n";

export function StageTablePanel({
  payload,
  stage,
}: {
  payload: DisplayPayload;
  stage: DisplayStage;
}) {
  const t = useT();
  const rows = stage.stage_table;
  if (!rows || rows.length === 0) return null;

  return (
    <div className="stage-table">
      <p className="stage-table__subtitle">
        {t("projector.crossPool", { count: rows.length })}
      </p>

      <table className="table" style={{ "--rows": rows.length } as CSSProperties}>
        <thead>
          <tr>
            <th className="table__rank" />
            <th className="table__team">{t("common.team")}</th>
            <th title={t("table.playedFull")}>{t("table.played")}</th>
            <th title={t("table.wonFull")}>{t("table.won")}</th>
            <th title={t("table.drawnFull")}>{t("table.drawn")}</th>
            <th title={t("table.lostFull")}>{t("table.lost")}</th>
            <th className="table__sets">{t("table.sets")}</th>
            <th className="table__points" title={t("table.pointsFull")}>
              {t("table.points")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.entry}
              className={row.qualified ? "is-qualified" : undefined}
            >
              <td className="table__rank">{row.position}</td>
              <td className="table__team">
                {entryName(row.entry, payload.entries)}
              </td>
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
    </div>
  );
}
