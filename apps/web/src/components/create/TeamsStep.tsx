import { useEffect, useRef, useState } from "react";
import type { TeamRecord } from "../../api/organiser";
import { isDuplicateName, SHORT_NAME_MAX, suggestShortName } from "../../lib/teams";
import { WizardShell } from "./WizardShell";

interface Props {
  teams: TeamRecord[];
  busy: boolean;
  /** Resolves false when the team could not be saved, so the field can be
      handed back exactly as it was typed. */
  onAdd: (name: string, shortName: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onBack: () => void;
  onDone: () => void;
}

const MIN_TEAMS = 2;

/**
 * One team per screen, on purpose.
 *
 * Entering sixteen teams on a phone is the longest part of setting a
 * tournament up, and a form with sixteen rows on it is where people lose their
 * place. So the screen holds exactly one team: type, add, the field empties
 * and keeps focus, type the next. The keyboard never has to close, and the
 * roster underneath is there to answer "have I done that one?" rather than to
 * be edited.
 *
 * It is also the shape that has room to grow. A photo, a group, a contact all
 * belong on a screen about one team; none of them fit in a row of a table.
 */
export function TeamsStep({ teams, busy, onAdd, onRemove, onBack, onDone }: Props) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [touchedShort, setTouchedShort] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const suggestion = touchedShort ? shortName : suggestShortName(trimmed);
  // Only worth showing when the derivation actually lost something.
  const shortIsInteresting = trimmed.length > SHORT_NAME_MAX || touchedShort;
  const duplicate = trimmed.length > 0 && isDuplicateName(trimmed, teams);
  const ready = trimmed.length > 0 && !duplicate;

  useEffect(() => {
    input.current?.focus();
  }, []);

  /**
   * The field empties before the request rather than after it.
   *
   * Hall wifi makes a save take a second or two, and anyone entering a list
   * types straight through it. Clearing on the response wipes whatever was
   * typed in the meantime — which is exactly the moment the person is not
   * looking at the screen. Typing is never blocked on the network; the only
   * thing that waits for the server is putting a name back after a failure,
   * and even then only if the field is still untouched.
   */
  const add = () => {
    if (!ready) return;
    const name = trimmed;
    const short = suggestion.trim().slice(0, SHORT_NAME_MAX);

    setName("");
    setShortName("");
    setTouchedShort(false);
    input.current?.focus();

    void onAdd(name, short).then((saved) => {
      if (!saved) setName((current) => (current === "" ? name : current));
    });
  };

  return (
    <WizardShell
      step="teams"
      title={`Team ${teams.length + 1}`}
      hint="Add them one at a time. The order you add them in is the seeding."
      onBack={onBack}
      footer={
        <>
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={!ready}
            onClick={add}
          >
            Add team
          </button>
          <button
            type="button"
            className="btn btn--quiet btn--block"
            disabled={teams.length < MIN_TEAMS || busy}
            onClick={onDone}
          >
            {teams.length < MIN_TEAMS
              ? `${MIN_TEAMS - teams.length} more to get going`
              : `That's everyone — ${teams.length} teams`}
          </button>
        </>
      }
    >
      <form
        className="wiz__field"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <input
          ref={input}
          className="wiz__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Team name"
          maxLength={120}
          autoComplete="off"
          enterKeyHint="done"
        />

        {duplicate ? (
          <p className="wiz__warning">You already have a team called that.</p>
        ) : null}

        {shortIsInteresting ? (
          <label className="wiz__sub">
            <span>Shown on the projector</span>
            <input
              className="wiz__input wiz__input--sub"
              value={suggestion}
              onChange={(event) => {
                setTouchedShort(true);
                setShortName(event.target.value);
              }}
              maxLength={SHORT_NAME_MAX}
              autoComplete="off"
            />
          </label>
        ) : null}
      </form>

      {teams.length > 0 ? (
        <ol className="roster">
          {[...teams].reverse().map((team) => (
            <li key={team.id} className="roster__row">
              <span className="roster__seed">{team.seed}</span>
              <span className="roster__name">{team.name}</span>
              <button
                type="button"
                className="roster__remove"
                onClick={() => onRemove(team.id)}
                aria-label={`Remove ${team.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </WizardShell>
  );
}
