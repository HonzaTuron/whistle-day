import { useState } from "react";
import type { CourtRecord } from "../../api/organiser";
import { courtsKeys, courtsUnitFor, type CourtsUnit } from "../../lib/courts";
import { useT, type Translate } from "../../lib/i18n";
import type { SportId } from "../../lib/scoring";
import { WizardShell } from "./WizardShell";

interface Props {
  initial: CourtRecord[];
  sport: SportId;
  busy: boolean;
  onBack: () => void;
  onNext: (names: string[]) => void;
}

const MAX_COURTS = 12;

const defaultName = (t: Translate, unit: CourtsUnit, index: number) =>
  t(courtsKeys(unit).defaultName, { number: index + 1 });

/**
 * How many places matches can happen at once.
 *
 * This is the number that decides how long the day is, so it is asked before
 * the format is chosen — the next screen quotes every option in hours, and it
 * cannot do that without knowing how many matches run in parallel.
 *
 * Unlike the team names, these are held locally and written on the way out.
 * Three short strings behind a stepper are not worth a request per keystroke,
 * and there is nothing here anyone would mind retyping.
 */
export function CourtsStep({ initial, sport, busy, onBack, onNext }: Props) {
  const t = useT();
  const unit = courtsUnitFor(sport);
  const keys = courtsKeys(unit);
  // The first court is named once, when the screen opens. Renaming it under
  // somebody who has switched language mid-wizard would be worse than leaving
  // it: they may well have typed it.
  const [names, setNames] = useState<string[]>(() =>
    initial.length > 0 ? initial.map((court) => court.name) : [defaultName(t, unit, 0)],
  );

  const setName = (index: number, value: string) =>
    setNames((current) => current.map((name, i) => (i === index ? value : name)));

  const add = () =>
    setNames((current) =>
      current.length >= MAX_COURTS
        ? current
        : [...current, defaultName(t, unit, current.length)],
    );

  const removeLast = () =>
    setNames((current) => (current.length <= 1 ? current : current.slice(0, -1)));

  const cleaned = names.map((name) => name.trim());
  const blank = cleaned.some((name) => name.length === 0);
  const duplicate =
    new Set(cleaned.map((name) => name.toLowerCase())).size !== cleaned.length;
  const ready = !blank && !duplicate && !busy;

  return (
    <WizardShell
      step="courts"
      title={t(keys.title)}
      hint={t("wizard.courtsHint")}
      onBack={onBack}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={!ready}
          onClick={() => onNext(cleaned)}
        >
          {t(busy ? "common.saving" : "wizard.courtsNext")}
        </button>
      }
    >
      <div className="stepper">
        <button
          type="button"
          className="stepper__button"
          onClick={removeLast}
          disabled={names.length <= 1}
          aria-label={t(keys.fewer)}
        >
          −
        </button>
        <span className="stepper__value">{names.length}</span>
        <button
          type="button"
          className="stepper__button"
          onClick={add}
          disabled={names.length >= MAX_COURTS}
          aria-label={t(keys.more)}
        >
          +
        </button>
      </div>

      <ul className="courts">
        {names.map((name, index) => (
          // Index as key is right here: these rows ARE positions, and a court
          // only ever appears or disappears at the end of the list.
          <li key={index} className="courts__row">
            <input
              className="wiz__input wiz__input--row"
              value={name}
              onChange={(event) => setName(index, event.target.value)}
              placeholder={defaultName(t, unit, index)}
              maxLength={60}
              autoComplete="off"
            />
          </li>
        ))}
      </ul>

      {duplicate ? (
        <p className="wiz__warning">{t(keys.duplicate)}</p>
      ) : null}
      {blank ? <p className="wiz__warning">{t(keys.blank)}</p> : null}
    </WizardShell>
  );
}
