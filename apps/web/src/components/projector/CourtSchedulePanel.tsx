import type { DisplayFixture, DisplayPayload } from "@seedly/engine";
import { courtName, sideName } from "../../lib/format";

export function CourtSchedulePanel({ payload }: { payload: DisplayPayload }) {
  const { courts, stages } = payload;

  const allFixtures = stages.flatMap((stage) =>
    stage.pools.flatMap((pool) =>
      pool.rounds.flatMap((round) =>
        round.fixtures.map((f) => ({ ...f, stage: stage.id })),
      ),
    ),
  );

  const byCourt = new Map(
    courts.map((court) => {
      const onCourt = allFixtures
        .filter((f) => f.court === court.id)
        .sort((a, b) => {
          if (a.status === "live" && b.status !== "live") return -1;
          if (b.status === "live" && a.status !== "live") return 1;
          if (a.scheduled_at && b.scheduled_at)
            return a.scheduled_at.localeCompare(b.scheduled_at);
          if (a.scheduled_at) return -1;
          if (b.scheduled_at) return 1;
          return 0;
        });
      return [court.id, { court, fixtures: onCourt }] as const;
    }),
  );

  if (byCourt.size === 0) return null;

  return (
    <div className="courtschedule">
      {courts.map((court) => {
        const group = byCourt.get(court.id);
        if (!group || group.fixtures.length === 0) return null;
        const live = group.fixtures.filter((f) => f.status === "live");
        const upcoming = group.fixtures.filter((f) => f.status !== "live");

        return (
          <div key={court.id} className="courtschedule__court">
            <h3 className="courtschedule__court-name">{court.name}</h3>

            {live.length > 0 && (
              <div className="courtschedule__matches">
                {live.map((fixture) => (
                  <FixtureBadge key={fixture.id} fixture={fixture} payload={payload} live />
                ))}
              </div>
            )}

            {upcoming.length > 0 && (
              <div className="courtschedule__matches">
                {upcoming.map((fixture) => (
                  <FixtureBadge key={fixture.id} fixture={fixture} payload={payload} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FixtureBadge({
  fixture,
  payload,
  live,
}: {
  fixture: DisplayFixture;
  payload: DisplayPayload;
  live?: boolean;
}) {
  const decided = fixture.winner !== "";

  return (
    <div className={live ? "courtschedule__fixture is-live" : "courtschedule__fixture"}>
      <span className="courtschedule__code">{fixture.code}</span>
      <span className="courtschedule__teams">
        <span className={decided && fixture.winner === fixture.home.entry ? "is-winner" : ""}>
          {sideName(fixture.home, payload.entries, "short")}
        </span>
        <span className="courtschedule__vs">
          {live && !decided ? "vs" : fixture.home.score != null ? `${fixture.home.score}–${fixture.away.score}` : "vs"}
        </span>
        <span className={decided && fixture.winner === fixture.away.entry ? "is-winner" : ""}>
          {sideName(fixture.away, payload.entries, "short")}
        </span>
      </span>
      {live && <span className="courtschedule__live">Live</span>}
    </div>
  );
}
