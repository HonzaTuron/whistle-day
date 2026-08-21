import type { DisplayFixture, DisplayPayload, DisplayStage } from "@seedly/engine";
import { bracketRounds } from "../../lib/bracket";
import { isPlaceholder, sideName } from "../../lib/format";

export function BracketPanel({
  payload,
  stage,
}: {
  payload: DisplayPayload;
  stage: DisplayStage;
}) {
  const rounds = bracketRounds(stage);
  if (rounds.length === 0) return null;

  return (
    <div className="bracket">
      {rounds.map((round) => (
        <div className="bracket__round" key={round.round}>
          <h3 className="bracket__round-title">{round.title}</h3>

          <div className="bracket__matches">
            {round.fixtures.map((fixture) => (
              <Match key={fixture.id} fixture={fixture} payload={payload} />
            ))}

            {round.thirdPlace && (
              <div className="bracket__bronze">
                <h4 className="bracket__round-title">Third place</h4>
                <Match fixture={round.thirdPlace} payload={payload} />
              </div>
            )}
          </div>
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
    <div className={live ? "bracket__match is-live" : "bracket__match"}>
      {(["home", "away"] as const).map((which) => {
        const side = fixture[which];
        const won = decided && fixture.winner === side.entry;
        const lost = decided && !won;

        return (
          <div
            key={which}
            className={[
              "bracket__side",
              isPlaceholder(side) ? "is-pending" : "",
              won ? "is-winner" : "",
              lost ? "is-loser" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="bracket__name">
              {sideName(side, payload.entries, "short")}
            </span>
            <span className="bracket__score">
              {decided || live ? side.score : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
