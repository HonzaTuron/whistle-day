import { estimate, formatDuration, PRESETS, type PresetId } from "../../lib/presets";
import type { LaunchStep } from "../../api/launch";
import { WizardShell } from "./WizardShell";

interface Props {
  teams: number;
  courts: number;
  value: PresetId;
  launching: LaunchStep | null;
  onChange: (id: PresetId) => void;
  onBack: () => void;
  onStart: () => void;
}

const PROGRESS: Record<LaunchStep, string> = {
  stages: "Setting it up…",
  draw: "Making the draw…",
  screen: "Opening a screen…",
  publish: "Going live…",
};

/**
 * The one real decision in the wizard, asked as "how long should this take?"
 * rather than "how many pools, and how many advance?".
 *
 * Every option is quoted in matches and in hours against the actual teams and
 * courts entered, because that is the number an organiser is really choosing
 * between. A hall booked until two o'clock rules out one of these, and the
 * card says so before it is picked rather than at four o'clock.
 */
export function FormatStep({
  teams,
  courts,
  value,
  launching,
  onChange,
  onBack,
  onStart,
}: Props) {
  return (
    <WizardShell
      step="format"
      title="How should it run?"
      hint={`${teams} teams on ${courts} court${courts === 1 ? "" : "s"}.`}
      onBack={launching ? undefined : onBack}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={launching !== null}
          onClick={onStart}
        >
          {launching ? PROGRESS[launching] : "Start the tournament"}
        </button>
      }
    >
      <div className="presets" role="radiogroup" aria-label="Format">
        {PRESETS.map((preset) => {
          const enough = teams >= preset.minTeams;
          const cost = estimate(preset, teams, courts);

          return (
            <label
              key={preset.id}
              className={
                "preset" +
                (preset.id === value ? " is-selected" : "") +
                (enough ? "" : " is-disabled")
              }
            >
              <input
                type="radio"
                name="preset"
                value={preset.id}
                checked={preset.id === value}
                disabled={!enough || launching !== null}
                onChange={() => onChange(preset.id)}
              />

              <span className="preset__head">
                <span className="preset__title">{preset.title}</span>
                <span className="preset__tag">{preset.tag}</span>
              </span>

              {enough ? (
                <>
                  <span className="preset__cost">
                    ≈ {cost.matches} matches · about {formatDuration(cost.minutes)}
                  </span>
                  <span className="preset__shape">{preset.shape(teams)}</span>
                  <span className="preset__blurb">{preset.blurb}</span>
                </>
              ) : (
                <span className="preset__shape">
                  Needs at least {preset.minTeams} teams.
                </span>
              )}
            </label>
          );
        })}
      </div>

      <p className="wiz__note">
        Seeded in the order you added the teams, so the first two you entered
        cannot meet before the final.
      </p>
    </WizardShell>
  );
}
