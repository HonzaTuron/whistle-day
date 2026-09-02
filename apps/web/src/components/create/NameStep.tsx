import { useState } from "react";
import { useT } from "../../lib/i18n";
import { SPORTS, sportById, type SportId } from "../../lib/scoring";
import { WizardShell } from "./WizardShell";

interface Resume {
  name: string;
  teams: number;
  onContinue: () => void;
  onDiscard: () => void;
}

interface Props {
  initial: string;
  sport: SportId;
  busy: boolean;
  resume: Resume | null;
  onSport: (sport: SportId) => void;
  onNext: (name: string) => void;
}

/**
 * The first screen asks for a name and what is being played, because the first
 * screen is where people decide whether this is going to be quick.
 *
 * The sport is a second question and deliberately not a second screen. It is
 * one tap with a right answer already selected, and it is the only question
 * about scoring anybody should have to answer: three points for a win with
 * draws possible is correct for football and wrong for every sport played in a
 * hall, and a tournament that never gets asked is a tournament scored as
 * football by default. The numbers behind each chip are on the scoring sheet
 * once the day is running, for the league whose rules are its own.
 *
 * Everything else a tournament record needs — a slug, an owner — is derived.
 * The record is created the moment this is submitted, so every team typed
 * after it is saved as it is typed rather than held in a tab that an incoming
 * phone call can kill.
 */
export function NameStep({ initial, sport, busy, resume, onSport, onNext }: Props) {
  const t = useT();
  const [name, setName] = useState(initial);
  const trimmed = name.trim();
  const ready = trimmed.length > 0 && !busy;

  /**
   * The submitted form is the truth, not the state.
   *
   * A controlled input's state can be a keystroke behind what is in the box:
   * onChange is queued, and on a busy first paint — the account is being
   * created in the background right now — the Enter that follows can be
   * handled before React has re-rendered. Reading state there submits an empty
   * name and then blanks the field, which looks exactly like the app eating
   * what was typed.
   */
  const submit = (value = name) => {
    const cleaned = value.trim();
    if (cleaned.length > 0 && !busy) onNext(cleaned);
  };

  return (
    <WizardShell
      step="name"
      title={t("wizard.nameTitle")}
      hint={t("wizard.nameHint")}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={!ready}
          onClick={() => submit()}
        >
          {t(busy ? "wizard.nameBusy" : "wizard.nameNext")}
        </button>
      }
    >
      {resume ? (
        <div className="wiz__resume">
          <p>
            {t("wizard.resume", {
              name: resume.name,
              teams:
                resume.teams > 0
                  ? t("wizard.resumeTeams", { count: resume.teams })
                  : "",
            })}
          </p>
          <div className="wiz__resume-actions">
            <button type="button" className="btn btn--primary" onClick={resume.onContinue}>
              {t("wizard.resumeContinue")}
            </button>
            <button type="button" className="btn btn--quiet" onClick={resume.onDiscard}>
              {t("wizard.resumeDiscard")}
            </button>
          </div>
        </div>
      ) : null}

      <form
        className="wiz__field"
        onSubmit={(event) => {
          event.preventDefault();
          const field = event.currentTarget.elements.namedItem("name");
          submit(field instanceof HTMLInputElement ? field.value : undefined);
        }}
      >
        <input
          name="name"
          className="wiz__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("wizard.namePlaceholder")}
          maxLength={120}
          autoFocus
          autoComplete="off"
          enterKeyHint="next"
        />
      </form>

      <fieldset className="wiz__sports">
        <legend>{t("wizard.sportLegend")}</legend>
        <div className="wiz__chips">
          {SPORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={
                option.id === sport ? "wiz__chip is-active" : "wiz__chip"
              }
              aria-pressed={option.id === sport}
              onClick={() => onSport(option.id)}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
        <p className="wiz__chip-hint">{t(sportById(sport).hint)}</p>
      </fieldset>
    </WizardShell>
  );
}
