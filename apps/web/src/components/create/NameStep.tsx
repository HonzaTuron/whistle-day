import { useState } from "react";
import { WizardShell } from "./WizardShell";

interface Resume {
  name: string;
  teams: number;
  onContinue: () => void;
  onDiscard: () => void;
}

interface Props {
  initial: string;
  busy: boolean;
  resume: Resume | null;
  onNext: (name: string) => void;
}

/**
 * The first screen asks for one thing, because the first screen is where
 * people decide whether this is going to be quick.
 *
 * Everything else a tournament record needs — a slug, an owner, scoring
 * defaults — is derived or defaulted. The record is created the moment this is
 * submitted, so every team typed after it is saved as it is typed rather than
 * held in a tab that an incoming phone call can kill.
 */
export function NameStep({ initial, busy, resume, onNext }: Props) {
  const [name, setName] = useState(initial);
  const trimmed = name.trim();
  const ready = trimmed.length > 0 && !busy;

  const submit = () => {
    if (ready) onNext(trimmed);
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
          onClick={submit}
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
          submit();
        }}
      >
        <input
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
    </WizardShell>
  );
}
