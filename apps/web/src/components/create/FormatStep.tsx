import { estimate, formatDuration, PRESETS, suits, type PresetId } from "../../lib/presets";
import type { LaunchStep } from "../../api/launch";
import { courtsKeys, courtsUnitFor } from "../../lib/courts";
import { useT, type MessageKey } from "../../lib/i18n";
import type { SportId } from "../../lib/scoring";
import { WizardShell } from "./WizardShell";

interface Props {
  teams: number;
  courts: number;
  sport: SportId;
  value: PresetId;
  launching: LaunchStep | null;
  onChange: (id: PresetId) => void;
  onBack: () => void;
  onStart: () => void;
}

const PROGRESS: Record<LaunchStep, MessageKey> = {
  stages: "wizard.launchStages",
  draw: "wizard.launchDraw",
  screen: "wizard.launchScreen",
  publish: "wizard.launchPublish",
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
  sport,
  value,
  launching,
  onChange,
  onBack,
  onStart,
}: Props) {
  const t = useT();
  const keys = courtsKeys(courtsUnitFor(sport));

  return (
    <WizardShell
      step="format"
      title={t("wizard.formatTitle")}
      hint={t("wizard.formatHint", {
        teams: t("count.teams", { count: teams }),
        courts: t(keys.on, { count: courts }),
      })}
      onBack={launching ? undefined : onBack}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={launching !== null}
          onClick={onStart}
        >
          {t(launching ? PROGRESS[launching] : "wizard.formatStart")}
        </button>
      }
    >
      <div className="presets" role="radiogroup" aria-label={t("wizard.formatLegend")}>
        {PRESETS.map((preset) => {
          const enough = suits(preset, teams);
          const cost = estimate(preset, teams, courts);
          const caveat = teams >= preset.minTeams ? preset.caveat?.(teams) : undefined;

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
                <span className="preset__title">{t(preset.title)}</span>
                <span className="preset__tag">{t(preset.tag)}</span>
              </span>

              {enough ? (
                <>
                  <span className="preset__cost">
                    {t("wizard.formatCost", {
                      count: cost.matches,
                      duration: formatDuration(t, cost.minutes),
                    })}
                  </span>
                  <span className="preset__shape">{preset.shape(t, teams)}</span>
                  <span className="preset__blurb">{t(preset.blurb)}</span>
                </>
              ) : (
                <span className="preset__shape">
                  {caveat ? t(caveat) : t("wizard.formatNeeds", { count: preset.minTeams })}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <p className="wiz__note">{t("wizard.formatNote")}</p>
    </WizardShell>
  );
}
