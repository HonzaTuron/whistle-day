import type { DisplayPayload } from "@seedly/engine";
import { courtName, sideName } from "../../lib/format";

export function NowPlayingPanel({ payload }: { payload: DisplayPayload }) {
  const live = payload.now_playing;

  // One match gets the whole wall; four have to share it.
  const density =
    live.length === 1 ? "live--single" : live.length > 2 ? "live--dense" : "";

  return (
    <div className={["live", density].filter(Boolean).join(" ")}>
      {live.map((fixture) => {
        const sets = fixture.games ?? [];
        const current = sets.at(-1);

        return (
          <article key={fixture.id} className="live__card">
            <div className="live__head">
              {fixture.court && (
                <span className="live__court">{courtName(fixture.court, payload)}</span>
              )}
              {fixture.code && <span className="live__code">{fixture.code}</span>}
            </div>

            {(["home", "away"] as const).map((which) => (
              <div key={which} className="live__row">
                <span className="live__team">
                  {sideName(fixture[which], payload.entries)}
                </span>
                <span className="live__score">{fixture[which].score}</span>
              </div>
            ))}

            {sets.length > 0 && (
              <div className="live__sets">
                {sets.map((set) => (
                  <span
                    key={set.number}
                    className={
                      set === current ? "live__set live__set--current" : "live__set"
                    }
                  >
                    {set.home}:{set.away}
                  </span>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
