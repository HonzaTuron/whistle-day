import type { DisplayFixture, DisplayPayload } from "@seedly/engine";
import { courtName, sideName, sideScore, timeOfDay } from "../../lib/format";
import { useI18n } from "../../lib/i18n";

export function MobileFixtures({
  payload,
  fixtures,
  live = false,
  showTime = false,
  showScore = false,
}: {
  payload: DisplayPayload;
  fixtures: DisplayFixture[];
  live?: boolean;
  showTime?: boolean;
  showScore?: boolean;
}) {
  const { t, locale } = useI18n();

  return (
    <ul className="cards">
      {fixtures.map((fixture) => {
        const court = fixture.court ? courtName(fixture.court, payload) : "";
        const meta = [
          showTime ? timeOfDay(locale, fixture.scheduled_at) : "",
          court,
          fixture.code,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <li key={fixture.id} className={live ? "card card--live" : "card"}>
            {meta && <div className="card__meta">{meta}</div>}

            {(["home", "away"] as const).map((which) => {
              const side = fixture[which];
              const won = fixture.winner !== "" && fixture.winner === side.entry;
              return (
                <div key={which} className={won ? "card__side is-winner" : "card__side"}>
                  <span className="card__team">
                    {sideName(t, side, payload.entries)}
                  </span>
                  <span className="card__score">
                    {live || showScore ? sideScore(t, fixture, which) : ""}
                  </span>
                </div>
              );
            })}

            {/* The set count alone does not say how close a live match is. */}
            {live && (fixture.games?.length ?? 0) > 0 && (
              <div className="card__sets">
                {fixture.games?.map((set, index) => (
                  <span
                    key={set.number}
                    className={
                      index === (fixture.games?.length ?? 0) - 1
                        ? "card__set card__set--current"
                        : "card__set"
                    }
                  >
                    {set.home}:{set.away}
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
