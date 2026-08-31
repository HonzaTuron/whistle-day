import type { DisplayPayload } from "@seedly/engine";
import { counts, isSettledStatus } from "../../lib/status";

export function StageProgressPanel({ payload }: { payload: DisplayPayload }) {
  const { stages } = payload;

  if (stages.length === 0) return null;

  const stageStats = stages.map((stage) => {
    // Cancelled matches are not on the wall's denominator either, or a hall
    // watches a bar that can never fill — see lib/status.
    const allFixtures = counts(
      stage.pools.flatMap((pool) => pool.rounds.flatMap((r) => r.fixtures)),
    );
    const finished = allFixtures.filter((f) => isSettledStatus(f.status));
    const live = allFixtures.filter((f) => f.status === "live");
    const pct = allFixtures.length > 0 ? Math.round((finished.length / allFixtures.length) * 100) : 0;

    return { stage, total: allFixtures.length, finished: finished.length, live: live.length, pct };
  });

  return (
    <div className="stageprogress">
      {stageStats.map(({ stage, total, finished, live, pct }) => (
        <div key={stage.id} className="stageprogress__stage">
          <div className="stageprogress__head">
            <h3 className="stageprogress__name">{stage.name}</h3>
            <span className="stageprogress__count">
              {finished}/{total}
              {live > 0 && <span className="stageprogress__live"> · {live} live</span>}
            </span>
          </div>

          <div className="stageprogress__bar">
            <div
              className="stageprogress__fill"
              style={{ width: `${pct}%` }}
            />
            {live > 0 && (
              <div
                className="stageprogress__livebar"
                style={{
                  left: `${(finished / total) * 100}%`,
                  width: `${(live / total) * 100}%`,
                }}
              />
            )}
          </div>

          <div className="stageprogress__pools">
            {stage.pools.map((pool) => {
              const poolFixtures = counts(pool.rounds.flatMap((r) => r.fixtures));
              const poolFinished = poolFixtures.filter((f) => isSettledStatus(f.status));
              return (
                <span key={pool.id} className="stageprogress__pool">
                  {pool.name}
                  {pool.standings.length > 0 && (
                    <>
                      {pool.standings
                        .filter((s) => s.qualified)
                        .map((s) => (
                          <span key={s.entry} className="stageprogress__qualified">
                            {s.position}
                          </span>
                        ))}
                    </>
                  )}
                  <small>
                    {poolFinished.length}/{poolFixtures.length}
                  </small>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
