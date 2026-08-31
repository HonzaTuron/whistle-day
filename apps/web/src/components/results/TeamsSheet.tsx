import type { Entry } from "@seedly/engine";
import { useEffect, useState } from "react";
import { isOut } from "../../lib/teams";

interface Props {
  teams: Entry[];
  /** How many unplayed matches each team still has, for the warning. */
  remaining: Map<string, number>;
  busy: boolean;
  onWithdraw: (entry: Entry, policy: "forfeit" | "void") => void;
  onReinstate: (entry: Entry) => void;
  onClose: () => void;
}

/**
 * Who is still in, and taking somebody out when they are not.
 *
 * The whole screen exists for one moment: a team has gone home and the day has
 * to carry on without them. Everything else about a team — their name, their
 * seed — was settled in the wizard and is not editable here, because changing
 * a name mid-tournament is a different and much rarer problem than this one.
 *
 * The two policies are offered as two buttons rather than a choice and a
 * confirm, because they are not degrees of the same action. They produce
 * different tables for everybody else, and a screen that made one of them the
 * default would be picking a rulebook.
 */
export function TeamsSheet({
  teams,
  remaining,
  busy,
  onWithdraw,
  onReinstate,
  onClose,
}: Props) {
  const [asking, setAsking] = useState<string | null>(null);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const open = teams.find((team) => team.id === asking) ?? null;
  const left = open ? remaining.get(open.id) ?? 0 : 0;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Teams">
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="sheet__panel">
        <p className="sheet__meta">Who is playing</p>

        {open ? (
          <>
            <p className="sheet__question">{open.name} is out</p>
            <p className="sheet__hint">
              {left > 0
                ? `They have ${left} ${left === 1 ? "match" : "matches"} left. What happens to them is not the same question as what happens to the ${
                    open.name
                  } results already on the sheet.`
                : "They have played everything they were down for, so this only decides whether those results still count."}
            </p>

            <div className="exit">
              <button
                type="button"
                className="exit__choice"
                onClick={() => {
                  setAsking(null);
                  onWithdraw(open, "forfeit");
                }}
                disabled={busy}
              >
                <strong>They forfeit the rest</strong>
                <small>
                  What they played stands. Every match they have left is a
                  walkover to whoever was due to face them. Right when a team
                  leaves late in the day.
                </small>
              </button>

              <button
                type="button"
                className="exit__choice"
                onClick={() => {
                  setAsking(null);
                  onWithdraw(open, "void");
                }}
                disabled={busy}
              >
                <strong>Strike their results</strong>
                <small>
                  Every match they were ever in comes out of the table, for
                  their opponents too. Right when a team pulls out early, so
                  nobody is ranked on having happened to play them.
                </small>
              </button>
            </div>

            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={() => setAsking(null)}
              >
                Never mind
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="sheet__hint">
              Taking a team out closes every match they have left and rebuilds
              the tables. It can be undone.
            </p>

            <ul className="crew">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className={"crew__row" + (isOut(team) ? " is-out" : "")}
                >
                  <div className="crew__who">
                    <strong>{team.name}</strong>
                    <small>
                      {isOut(team)
                        ? team.withdrawal === "void"
                          ? "Out · results struck"
                          : "Out · forfeited the rest"
                        : `${remaining.get(team.id) ?? 0} to play`}
                    </small>
                  </div>
                  {isOut(team) ? (
                    <button
                      type="button"
                      className="btn btn--quiet btn--small"
                      onClick={() => onReinstate(team)}
                      disabled={busy}
                    >
                      Put back
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      onClick={() => setAsking(team.id)}
                      disabled={busy}
                    >
                      Out
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
