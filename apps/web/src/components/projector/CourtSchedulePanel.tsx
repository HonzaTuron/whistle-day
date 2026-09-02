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

  // Courts with nothing on them are the same as no courts: an empty frame on a
  // wall reads as a screen that has broken, not as a day nobody has scheduled.
  if (![...byCourt.values()].some((group) => group.fixtures.length > 0)) return null;

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

const PLAYED = ["finished", "walkover", "bye"];

/**
 * One match on a court, as a scoreboard line: code, the two names facing a
 * score between them, and the score itself.
 *
 * The columns are fixed widths rather than sized to their contents, because
 * every row is its own grid — content-sized columns would put each row's score
 * wherever that row's names happened to end, which across ten rows reads as a
 * list nobody aligned.
 */
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
  const played = PLAYED.includes(fixture.status);
  // A match yet to start has 0–0 on the wire, which on a wall reads as a
  // goalless draw somebody has already played.
  const score =
    played || live ? `${fixture.home.score}–${fixture.away.score}` : "vs";
  // Sets are won one at a time; the one being played is the last one sent.
  const current = live ? fixture.games?.at(-1) : undefined;

  return (
    <div className={live ? "courtschedule__fixture is-live" : "courtschedule__fixture"}>
      <span className="courtschedule__code">
        {fixture.code}
        {live && <small className="courtschedule__live">Live</small>}
      </span>

      <span
        className={
          "courtschedule__team is-home" +
          (decided && fixture.winner === fixture.home.entry ? " is-winner" : "")
        }
      >
        {sideName(fixture.home, payload.entries, "short")}
      </span>

      <span className={"courtschedule__score" + (score === "vs" ? " is-empty" : "")}>
        {score}
        {current && (
          <small className="courtschedule__set">
            {`set ${current.number} · ${current.home}–${current.away}`}
          </small>
        )}
      </span>

      <span
        className={
          "courtschedule__team" +
          (decided && fixture.winner === fixture.away.entry ? " is-winner" : "")
        }
      >
        {sideName(fixture.away, payload.entries, "short")}
      </span>
    </div>
  );
}
