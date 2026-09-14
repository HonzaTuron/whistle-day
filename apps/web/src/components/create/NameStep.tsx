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
  /** Sets override for a sport that asks, `null` while the preset's own
   *  default still stands. */
  bestOf: number | null;
  customSportName: string;
  customDrawsAllowed: boolean;
  busy: boolean;
  resume: Resume | null;
  onSport: (sport: SportId) => void;
  onBestOf: (bestOf: number) => void;
  onCustomSportName: (name: string) => void;
  onCustomDrawsAllowed: (allowed: boolean) => void;
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
export function NameStep({
  initial,
  sport,
  bestOf,
  customSportName,
  customDrawsAllowed,
  busy,
  resume,
  onSport,
  onBestOf,
  onCustomSportName,
  onCustomDrawsAllowed,
  onNext,
}: Props) {
  const t = useT();
  const [name, setName] = useState(initial);
  const trimmed = name.trim();
  const ready = trimmed.length > 0 && !busy;
  const picked = sportById(sport);
  const isOther = sport === "other";
  const effectiveBestOf = bestOf ?? picked.scoring.bestOf;

  const setLabel = (value: number) =>
    value === 1 ? t("wizard.setsSingle") : t("wizard.setsOf", { count: value });

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
        <p className="wiz__chip-hint">{t(picked.hint)}</p>
      </fieldset>

      {isOther ? (
        <div className="wiz__subwizard">
          <label className="wiz__sub" htmlFor="custom-sport-name">
            {t("wizard.customSportLegend")}
            <input
              id="custom-sport-name"
              className="wiz__input wiz__input--sub"
              value={customSportName}
              onChange={(event) => onCustomSportName(event.target.value)}
              placeholder={t("wizard.customSportPlaceholder")}
              maxLength={40}
              autoComplete="off"
            />
          </label>

          <fieldset className="wiz__sports">
            <legend>{t("wizard.decidedLegend")}</legend>
            <div className="wiz__chips">
              {picked.setChoices?.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    value === effectiveBestOf ? "wiz__chip wiz__chip--small is-active" : "wiz__chip wiz__chip--small"
                  }
                  aria-pressed={value === effectiveBestOf}
                  onClick={() => onBestOf(value)}
                >
                  {setLabel(value)}
                </button>
              ))}
            </div>
          </fieldset>

          {effectiveBestOf === 1 ? (
            <label className="wiz__toggle">
              <input
                type="checkbox"
                checked={customDrawsAllowed}
                onChange={(event) => onCustomDrawsAllowed(event.target.checked)}
              />
              {t("wizard.customDraws")}
            </label>
          ) : null}
        </div>
      ) : picked.setChoices ? (
        <fieldset className="wiz__sports">
          <legend>{t("wizard.setsLegend")}</legend>
          <div className="wiz__chips">
            {picked.setChoices.map((value) => (
              <button
                key={value}
                type="button"
                className={
                  value === effectiveBestOf ? "wiz__chip wiz__chip--small is-active" : "wiz__chip wiz__chip--small"
                }
                aria-pressed={value === effectiveBestOf}
                onClick={() => onBestOf(value)}
              >
                {setLabel(value)}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
    </WizardShell>
  );
}
