import type {
  Court,
  Display,
  DisplayMode,
  DisplayPanel,
  DisplayTheme,
  DisplayThemeMode,
  Pool,
  Stage,
} from "@whistleday/engine";
import { useEffect, useState } from "react";
import { useT, type MessageKey, type Translate } from "../../lib/i18n";
import { renderLabel } from "../../lib/labels";
import { useReorder } from "../../lib/reorder";
import { Grip, Group } from "./SheetParts";

interface Props {
  screen: Display;
  stages: Stage[];
  pools: Pool[];
  courts: Court[];
  /** Only ever shown when a write is in the air or one failed. */
  state: "idle" | "saving" | "failed";
  onChange: (patch: Partial<Display>) => void;
  onClose: () => void;
}

/**
 * What the wall shows, decided from the phone in front of it.
 *
 * Everything here saves on change, and the server nudges the screen the moment
 * it lands — so the wall is the preview. A Save button would mean an organiser
 * standing in a hall guessing at what a setting does, walking over to look,
 * and walking back.
 *
 * The order is how the question is actually asked: what should it show, then
 * how long for, then what should it leave out, then what colour is it.
 */

/** Every panel a screen can rotate, in the order it runs if nobody says. */
const PANELS: { value: DisplayPanel; label: MessageKey; hint: MessageKey }[] = [
  { value: "now_playing", label: "panel.now_playing", hint: "panel.now_playing.hint" },
  { value: "stage_progress", label: "panel.stage_progress", hint: "panel.stage_progress.hint" },
  { value: "court_schedule", label: "panel.court_schedule", hint: "panel.court_schedule.hint" },
  { value: "stage_table", label: "panel.stage_table", hint: "panel.stage_table.hint" },
  { value: "standings", label: "panel.standings", hint: "panel.standings.hint" },
  { value: "bracket", label: "panel.bracket", hint: "panel.bracket.hint" },
  { value: "next_up", label: "panel.next_up", hint: "panel.next_up.hint" },
  { value: "results", label: "panel.results", hint: "panel.results.hint" },
];

const ORDER = PANELS.map((panel) => panel.value);
const NAMES = new Map(PANELS.map((panel) => [panel.value, panel]));

/**
 * A screen pinned to one panel through `mode` is the same screen as one whose
 * rotation has a single panel in it, and this sheet says it the second way. A
 * screen set up before that — or through the API — is read into the same list
 * rather than being shown a control that contradicts it.
 */
const MODE_PANEL: Partial<Record<DisplayMode, DisplayPanel>> = {
  now_playing: "now_playing",
  standings: "standings",
  bracket: "bracket",
  schedule: "next_up",
  results: "results",
  court_schedule: "court_schedule",
  stage_progress: "stage_progress",
};

const DWELLS = [8, 12, 15, 20, 30];

/**
 * What the wall draws its accent with when nobody has picked one — the
 * `--accent` each ground sets in `styles.css`.
 *
 * Duplicated from the stylesheet because the swatch has to open on the colour
 * that is actually on the wall. Showing the app's green over a light screen
 * drawing the darker one makes the picker a liar, and the tap that "changes
 * nothing" writes a colour that is genuinely worse.
 */
const GROUND_ACCENT: Record<DisplayThemeMode, string> = {
  light: "#15803d",
  dark: "#22c55e",
};

export function ScreenSheet({
  screen,
  stages,
  pools,
  courts,
  state,
  onChange,
  onClose,
}: Props) {
  const t = useT();

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const theme: DisplayTheme = screen.theme ?? {};
  const scope = screen.scope ?? {};

  /** Spelt out, because `mode` in this file is the rotation pin. */
  const themeMode: DisplayThemeMode = theme.mode === "dark" ? "dark" : "light";
  const groundAccent = GROUND_ACCENT[themeMode];

  /**
   * Light stores nothing, the way the default rotation does: a default written
   * out is a default that goes stale, and every screen set up before there was
   * a choice is already storing it.
   */
  const setThemeMode = (next: DisplayThemeMode) => {
    const { mode: _dropped, ...rest } = theme;
    onChange({ theme: next === "dark" ? { ...rest, mode: next } : rest });
  };

  /**
   * The rotation, in order.
   *
   * Empty means all of them in the running order, which is what an untouched
   * screen stores and why one still shows a panel added next month. A screen
   * pinned through `mode` reads as a rotation of one.
   */
  const pinned = screen.mode === "auto" ? undefined : MODE_PANEL[screen.mode];
  const rotation: DisplayPanel[] = pinned
    ? [pinned]
    : (screen.panels ?? []).length > 0
      ? (screen.panels ?? []).filter((panel) => NAMES.has(panel))
      : ORDER;
  const dropped = ORDER.filter((panel) => !rotation.includes(panel));

  /**
   * Writing the rotation also unpins the screen: `mode` is the older way of
   * saying the same thing, and two fields that can disagree about what is on
   * the wall is one more than there should be.
   */
  const setRotation = (next: DisplayPanel[]) =>
    onChange({
      mode: "auto",
      // The default order stores as nothing, so a screen nobody has arranged
      // keeps picking up whatever is added to the rotation later.
      panels: next.length === ORDER.length && next.every((p, i) => p === ORDER[i]) ? [] : next,
    });

  // The order under the finger is local until it is let go, so the list moves
  // as it is dragged without a write per row it passes over. Shared with the
  // tiebreak order on the scoring sheet — same interaction, different list.
  const drag = useReorder(rotation, setRotation);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={t("screen.label")}>
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label={t("common.close")}
      />

      <div className="sheet__panel">
        <p className="sheet__meta">
          {screen.name || t("screen.fallbackName")}
          {state === "failed"
            ? ` · ${t("common.notSaved")}`
            : state === "saving"
              ? ` · ${t("common.saving")}`
              : ""}
        </p>
        <p className="sheet__hint">{t("screen.savedAsYouTap")}</p>

        <Group label={t("screen.rotation")}>
          {/*
            One list, because "which panels" and "in what order" are one
            decision. The row is the switch and the grip is the handle, so
            neither can be hit by accident while reaching for the other.
          */}
          <ul className="rotation">
            {drag.shown.map((panel, index) => (
              <li
                key={panel}
                ref={drag.rowRef(index)}
                className={
                  "rotation__row" +
                  (drag.draggingAt === index ? " is-dragging" : "")
                }
              >
                <label className="rotation__pick">
                  {/* The row says whether it is on; a box beside it would say
                      it twice. It is a real checkbox underneath, so the
                      keyboard and a screen reader get the control they know. */}
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked
                    onChange={() =>
                      setRotation(rotation.filter((value) => value !== panel))
                    }
                  />
                  <span className="rotation__name">{panelName(t, panel)}</span>
                  <small className="rotation__hint">{panelHint(t, panel)}</small>
                </label>

                <button
                  type="button"
                  className="rotation__grip"
                  aria-label={t("screen.move", { name: panelName(t, panel) })}
                  {...drag.gripProps(index)}
                >
                  <Grip />
                </button>
              </li>
            ))}
          </ul>

          <p className="sheet__hint">
            {t(
              rotation.length === 1 ? "screen.onePanel" : "screen.dragToReorder",
            )}{" "}
            {t("screen.emptySkipped")}
          </p>

          {dropped.length > 0 ? (
            <>
              <h4 className="rotation__off">{t("screen.notShown")}</h4>
              <p className="sheet__hint">{t("screen.tapToRestore")}</p>
              <div
                className="chips chips--wrap"
                role="group"
                aria-label={t("screen.notShown")}
              >
                {dropped.map((panel) => (
                  <button
                    key={panel}
                    type="button"
                    className="chip"
                    aria-pressed={false}
                    onClick={() => setRotation([...rotation, panel])}
                  >
                    {panelName(t, panel)}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </Group>

        {rotation.length > 1 ? (
          <Group label={t("screen.dwell")}>
            <div className="chips" role="group">
              {DWELLS.map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  className={
                    "chip" + (screen.rotate_seconds === seconds ? " is-on" : "")
                  }
                  onClick={() => onChange({ rotate_seconds: seconds })}
                >
                  {t("screen.dwellSeconds", { seconds })}
                </button>
              ))}
            </div>
          </Group>
        ) : null}

        <Group label={t("screen.onlyShow")}>
          <div className="chips chips--wrap" role="group" aria-label={t("screen.stage")}>
            <Filter
              label={t("screen.everyStage")}
              on={!scope.stage}
              onClick={() => onChange({ scope: { ...scope, stage: "", pool: "" } })}
            />
            {stages.map((stage) => (
              <Filter
                key={stage.id}
                label={renderLabel(t, stage.name, stage.name_kind)}
                on={scope.stage === stage.id}
                onClick={() =>
                  onChange({ scope: { ...scope, stage: stage.id, pool: "" } })
                }
              />
            ))}
          </div>

          {scope.stage ? (
            <div className="chips chips--wrap" role="group" aria-label={t("screen.group")}>
              <Filter
                label={t("screen.everyGroup")}
                on={!scope.pool}
                onClick={() => onChange({ scope: { ...scope, pool: "" } })}
              />
              {pools
                .filter((pool) => pool.stage === scope.stage)
                .map((pool) => (
                  <Filter
                    key={pool.id}
                    label={renderLabel(t, pool.name, pool.name_kind)}
                    on={scope.pool === pool.id}
                    onClick={() => onChange({ scope: { ...scope, pool: pool.id } })}
                  />
                ))}
            </div>
          ) : null}

          {courts.length > 0 ? (
            <div className="chips chips--wrap" role="group" aria-label={t("match.court")}>
              <Filter
                label={t("screen.everyCourt")}
                on={!scope.court}
                onClick={() => onChange({ scope: { ...scope, court: "" } })}
              />
              {courts.map((court) => (
                <Filter
                  key={court.id}
                  label={court.name}
                  on={scope.court === court.id}
                  onClick={() => onChange({ scope: { ...scope, court: court.id } })}
                />
              ))}
            </div>
          ) : null}

          <p className="sheet__hint">{t("screen.scopeNote")}</p>
        </Group>

        <Group label={t("screen.colour")}>
          {/*
            Which ground is a question about the hall rather than about taste,
            and worth saying so here: this is decided on a phone, indoors,
            where dark looks better in the hand than it will on the wall.
          */}
          <div className="chips" role="group" aria-label={t("screen.ground")}>
            <Filter
              label={t("screen.groundLight")}
              on={themeMode === "light"}
              onClick={() => setThemeMode("light")}
            />
            <Filter
              label={t("screen.groundDark")}
              on={themeMode === "dark"}
              onClick={() => setThemeMode("dark")}
            />
          </div>

          <p className="sheet__hint">{t("screen.groundNote")}</p>

          <div className="accent">
            <input
              type="color"
              className="accent__pick"
              value={theme.accent || groundAccent}
              onChange={(event) =>
                onChange({ theme: { ...theme, accent: event.target.value } })
              }
              aria-label={t("screen.accent")}
            />
            <span className="accent__value">{theme.accent || groundAccent}</span>
            {theme.accent ? (
              <button
                type="button"
                className="btn btn--quiet btn--tiny"
                onClick={() => {
                  const { accent: _dropped, ...rest } = theme;
                  onChange({ theme: rest });
                }}
              >
                {t("screen.reset")}
              </button>
            ) : null}
          </div>
        </Group>

        <div className="sheet__actions">
          <button type="button" className="btn btn--quiet btn--block" onClick={onClose}>
            {t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The rotation list and the "not shown" chips both name a panel this way. */
const panelName = (t: Translate, panel: DisplayPanel) => {
  const key = NAMES.get(panel)?.label;
  return key ? t(key) : panel;
};

const panelHint = (t: Translate, panel: DisplayPanel) => {
  const key = NAMES.get(panel)?.hint;
  return key ? t(key) : "";
};

/** Six dots: the handle everything else with a draggable row uses. */
function Filter({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={"chip" + (on ? " is-on" : "")}
      aria-pressed={on}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
