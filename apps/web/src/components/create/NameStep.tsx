import { useState } from "react";
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
      title="What's it called?"
      hint="You can change this later — nothing here is final until you start."
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={!ready}
          onClick={() => submit()}
        >
          {busy ? "Just a second…" : "Add the teams"}
        </button>
      }
    >
      {resume ? (
        <div className="wiz__resume">
          <p>
            <strong>{resume.name}</strong> is half set up on this device
            {resume.teams > 0
              ? ` — ${resume.teams} team${resume.teams === 1 ? "" : "s"} in`
              : ""}
            .
          </p>
          <div className="wiz__resume-actions">
            <button type="button" className="btn btn--primary" onClick={resume.onContinue}>
              Pick that up
            </button>
            <button type="button" className="btn btn--quiet" onClick={resume.onDiscard}>
              Start something new
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
          placeholder="Autumn Cup"
          maxLength={120}
          autoFocus
          autoComplete="off"
          enterKeyHint="next"
        />
      </form>

      <fieldset className="wiz__sports">
        <legend>What's being played?</legend>
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
              {option.label}
            </button>
          ))}
        </div>
        <p className="wiz__chip-hint">{sportById(sport).hint}</p>
      </fieldset>
    </WizardShell>
  );
}
