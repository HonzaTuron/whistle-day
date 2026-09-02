import type { DisplayFixture, DisplayPayload, DisplayStage } from "@seedly/engine";
import { bracketRounds } from "../../lib/bracket";
import { isPlaceholder, sideName, sideScore } from "../../lib/format";
import { useT, type Translate } from "../../lib/i18n";

export function BracketPanel({
  payload,
  stage,
}: {
  payload: DisplayPayload;
  stage: DisplayStage;
}) {
  const t = useT();
  const rounds = bracketRounds(t, stage);
  if (rounds.length === 0) return null;

  return (
    <div className="bracket">
      {rounds.map((round) => (
        <div className="bracket__round" key={round.round}>
          <h3 className="bracket__round-title">{round.title}</h3>

          <div className="bracket__matches">
            {round.fixtures.map((fixture) => (
              <Match key={fixture.id} t={t} fixture={fixture} payload={payload} />
            ))}

            {round.thirdPlace && (
              <div className="bracket__bronze">
                <h4 className="bracket__round-title">{t("bracket.thirdPlace")}</h4>
                <Match t={t} fixture={round.thirdPlace} payload={payload} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Match({
  t,
  fixture,
  payload,
}: {
  t: Translate;
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
              {sideName(t, side, payload.entries, "short")}
            </span>
            <span className="bracket__score">
              {decided || live ? sideScore(t, fixture, which) : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
