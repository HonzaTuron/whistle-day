import type { Fixture, Pool, Stage } from "@seedly/engine";
import { useT } from "../../lib/i18n";
import { renderLabel } from "../../lib/labels";
import { counts, isSettledStatus } from "../../lib/status";

interface Props {
  stages: Stage[];
  pools: Pool[];
  fixtures: Fixture[];
}

export function StageProgress({ stages, pools, fixtures }: Props) {
  const t = useT();
  const poolsByStage = new Map<string, Pool[]>();
  for (const pool of pools) {
    const list = poolsByStage.get(pool.stage);
    if (list) list.push(pool);
    else poolsByStage.set(pool.stage, [pool]);
  }

  const fixturesByPool = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const key = fixture.pool ?? "";
    const list = fixturesByPool.get(key);
    if (list) list.push(fixture);
    else fixturesByPool.set(key, [fixture]);
  }

  return (
    <div className="prog">
      {stages.map((stage) => {
        const stagePools = poolsByStage.get(stage.id) ?? [];
        // Cancelled matches leave the count entirely — see lib/status.
        const stageFixtures = counts(fixtures.filter((f) => f.stage === stage.id));
        const done = stageFixtures.filter((f) => isSettledStatus(f.status)).length;
        const live = stageFixtures.filter((f) => f.status === "live").length;
        const pct = stageFixtures.length > 0 ? Math.round((done / stageFixtures.length) * 100) : 0;

        return (
          <div key={stage.id} className="prog__stage">
            <div className="prog__head">
              <span className="prog__name">
                {renderLabel(t, stage.name, stage.name_kind)}
              </span>
              <span className="prog__count">
                {done}/{stageFixtures.length}
                {live > 0 && (
                  <span className="prog__live"> · {t("board.live", { count: live })}</span>
                )}
              </span>
            </div>

            <div className="prog__bar">
              <div className="prog__fill" style={{ width: `${pct}%` }} />
            </div>

            {stagePools.length > 1 && (
              <div className="prog__pools">
                {stagePools.map((pool) => {
                  const poolFixtures = counts(fixturesByPool.get(pool.id) ?? []);
                  const poolDone = poolFixtures.filter((f) => isSettledStatus(f.status)).length;
                  return (
                    <span key={pool.id} className="prog__pool">
                      {renderLabel(t, pool.name, pool.name_kind)} {poolDone}/
                      {poolFixtures.length}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
