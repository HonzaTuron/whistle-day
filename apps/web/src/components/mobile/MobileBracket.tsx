import type { DisplayFixture, DisplayPayload, DisplayStage } from "@seedly/engine";
import { bracketRounds } from "../../lib/bracket";
import { isPlaceholder, sideName } from "../../lib/format";

/**
 * A bracket tree does not survive a 390px viewport, so the phone shows the same
 * fixtures as a vertical list grouped by round. The shape is lost; the
 * information is not.
 */
export function MobileBracket({
  payload,
  stage,
}: {
  payload: DisplayPayload;
  stage: DisplayStage;
}) {
  const rounds = bracketRounds(stage);
  if (rounds.length === 0) return null;

  return (
    <div className="phone-bracket">
      {rounds.map((round) => (
        <div key={round.round}>
          <h3 className="phone-bracket__round">{round.title}</h3>
          <ul className="cards">
            {round.fixtures.map((fixture) => (
              <Match key={fixture.id} fixture={fixture} payload={payload} />
            ))}
          </ul>

          {round.thirdPlace && (
            <>
              <h3 className="phone-bracket__round">Third place</h3>
              <ul className="cards">
                <Match fixture={round.thirdPlace} payload={payload} />
              </ul>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Match({
  fixture,
  payload,
}: {
  fixture: DisplayFixture;
  payload: DisplayPayload;
}) {
  const decided = fixture.winner !== "";
  const live = fixture.status === "live";

  return (
    <li className={live ? "card card--live" : "card"}>
      <div className="card__meta">{fixture.code}</div>
      {(["home", "away"] as const).map((which) => {
        const side = fixture[which];
        const won = decided && fixture.winner === side.entry;

        return (
          <div
            key={which}
            className={[
              "card__side",
              won ? "is-winner" : "",
              isPlaceholder(side) ? "is-pending" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="card__team">{sideName(side, payload.entries)}</span>
            <span className="card__score">{decided || live ? side.score : ""}</span>
          </div>
        );
      })}
    </li>
  );
}
