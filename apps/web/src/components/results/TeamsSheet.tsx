import type { Entry } from "@seedly/engine";
import { useEffect, useState } from "react";
import { useT } from "../../lib/i18n";
import { isDuplicateName, isOut, SHORT_NAME_MAX, suggestShortName } from "../../lib/teams";

interface Props {
  teams: Entry[];
  /** How many unplayed matches each team still has, for the warning. */
  remaining: Map<string, number>;
  busy: boolean;
  /** What happened to the team just added, in one line. */
  joined: string | null;
  onAdd: (name: string, shortName: string) => void;
  onWithdraw: (entry: Entry, policy: "forfeit" | "void") => void;
  onReinstate: (entry: Entry) => void;
  onClose: () => void;
}

/**
 * Who is still in, who has just turned up, and taking somebody out when they
 * have gone.
 *
 * The screen exists for the two moments a roster changes after the draw. They
 * are not symmetrical: a team leaving has to be told what happens to their
 * results, which is two buttons and a question; a team arriving has to be
 * typed in, which is one field. So the field sits at the top, where it is one
 * tap from the "Teams" button, and the exit lives behind each row.
 *
 * A name and nothing else. Everything a team has beyond that was asked for in
 * the wizard, and somebody standing in a hall with a fifth team in front of
 * them is not going to fill in a form — they are going to want them on court.
 */
export function TeamsSheet({
  teams,
  remaining,
  busy,
  joined,
  onAdd,
  onWithdraw,
  onReinstate,
  onClose,
}: Props) {
  const t = useT();
  const [asking, setAsking] = useState<string | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const open = teams.find((team) => team.id === asking) ?? null;
  const left = open ? remaining.get(open.id) ?? 0 : 0;

  const trimmed = name.trim();
  const duplicate = trimmed.length > 0 && isDuplicateName(trimmed, teams);
  const ready = trimmed.length > 0 && !duplicate && !busy;

  /**
   * The field empties on the tap rather than on the response, the same way the
   * wizard's does: the request goes through a hall's wifi and whoever is
   * typing is already looking at the next team. What comes back is a line
   * saying where they landed, which is the part worth waiting for.
   */
  const add = () => {
    if (!ready) return;
    setName("");
    onAdd(trimmed, suggestShortName(trimmed).slice(0, SHORT_NAME_MAX));
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={t("teams.label")}>
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label={t("common.close")}
      />

      <div className="sheet__panel">
        <p className="sheet__meta">{t("teams.who")}</p>

        {open ? (
          <>
            <p className="sheet__question">
              {t("teams.isOut", { name: open.name })}
            </p>
            <p className="sheet__hint">
              {left > 0
                ? t("teams.hasLeft", { count: left, name: open.name })
                : t("teams.nothingLeft")}
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
                <strong>{t("teams.forfeitTitle")}</strong>
                <small>{t("teams.forfeitBody")}</small>
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
                <strong>{t("teams.voidTitle")}</strong>
                <small>{t("teams.voidBody")}</small>
              </button>
            </div>

            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={() => setAsking(null)}
              >
                {t("teams.neverMind")}
              </button>
            </div>
          </>
        ) : (
          <>
            <form
              className="teams__add"
              onSubmit={(event) => {
                event.preventDefault();
                add();
              }}
            >
              <input
                name="team"
                value={name}
                placeholder={t("teams.addPlaceholder")}
                aria-label={t("teams.addLabel")}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
              <button type="submit" className="btn btn--small" disabled={!ready}>
                {t(busy ? "teams.adding" : "teams.add")}
              </button>
            </form>

            {duplicate ? (
              <p className="sheet__hint is-fault" role="alert">
                {t("teams.addDuplicate", { name: trimmed })}
              </p>
            ) : joined ? (
              <p className="sheet__hint" role="status">
                {joined}
              </p>
            ) : (
              <p className="sheet__hint">{t("teams.addHint")}</p>
            )}

            <p className="sheet__hint">{t("teams.intro")}</p>

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
                        ? t(
                            team.withdrawal === "void"
                              ? "teams.outStruck"
                              : "teams.outForfeited",
                          )
                        : t("teams.toPlay", { count: remaining.get(team.id) ?? 0 })}
                    </small>
                  </div>
                  {isOut(team) ? (
                    <button
                      type="button"
                      className="btn btn--quiet btn--small"
                      onClick={() => onReinstate(team)}
                      disabled={busy}
                    >
                      {t("teams.putBack")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      onClick={() => setAsking(team.id)}
                      disabled={busy}
                    >
                      {t("teams.out")}
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
                {t("common.done")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
