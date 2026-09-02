import type { DisplayFixture, DisplayPayload } from "@seedly/engine";
import type { CSSProperties } from "react";
import { courtName, scoreline, sideName, timeOfDay } from "../../lib/format";

/** The shared shape behind "Next up" and "Latest results". */
export function FixtureListPanel({
  payload,
  fixtures,
  showTime = false,
  showScore = false,
}: {
  payload: DisplayPayload;
  fixtures: DisplayFixture[];
  showTime?: boolean;
  showScore?: boolean;
}) {
  return (
    // `--rows` is what sizes the type: a wall with five matches on it should
    // read from the back of the hall, one with sixteen is a schedule.
    <ul className="fixtures" style={{ "--rows": fixtures.length } as CSSProperties}>
      {fixtures.map((fixture) => {
        const winnerIsHome = fixture.winner !== "" && fixture.winner === fixture.home.entry;
        const winnerIsAway = fixture.winner !== "" && fixture.winner === fixture.away.entry;

        return (
          <li key={fixture.id} className="fixtures__row">
            <span className="fixtures__lead">
              {showTime
                ? timeOfDay(fixture.scheduled_at) || fixture.code
                : fixture.code}
            </span>

            <span className={winnerIsHome ? "fixtures__team is-winner" : "fixtures__team"}>
              {sideName(fixture.home, payload.entries)}
            </span>

            <span className="fixtures__score">
              {showScore ? scoreline(fixture) : "v"}
            </span>

            <span className={winnerIsAway ? "fixtures__team is-winner" : "fixtures__team"}>
              {sideName(fixture.away, payload.entries)}
            </span>

            <span className="fixtures__court">
              {fixture.court ? courtName(fixture.court, payload) : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
