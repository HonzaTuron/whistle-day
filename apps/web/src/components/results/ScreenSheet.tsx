import type {
  Court,
  Display,
  DisplayMode,
  DisplayPanel,
  DisplayTheme,
  Pool,
  Stage,
} from "@seedly/engine";
import { useEffect, useRef, useState } from "react";

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
const PANELS: { value: DisplayPanel; label: string; hint: string }[] = [
  { value: "now_playing", label: "Now playing", hint: "The live matches." },
  { value: "stage_progress", label: "Stage progress", hint: "How far the day has got." },
  { value: "court_schedule", label: "Court schedule", hint: "What is on each court." },
  { value: "stage_table", label: "Cross-pool tables", hint: "Every group ranked together." },
  { value: "standings", label: "Group tables", hint: "One panel per group." },
  { value: "bracket", label: "Bracket", hint: "The knockout." },
  { value: "next_up", label: "Next up", hint: "The matches still to play." },
  { value: "results", label: "Latest results", hint: "What has just finished." },
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

export function ScreenSheet({
  screen,
  stages,
  pools,
  courts,
  state,
  onChange,
  onClose,
}: Props) {
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const theme: DisplayTheme = screen.theme ?? {};
  const scope = screen.scope ?? {};

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

  // Dragging: the order under the finger is local until it is let go, so the
  // list moves as it is dragged without a write per row it passes over.
  const [dragging, setDragging] = useState<{ at: number; order: DisplayPanel[] } | null>(
    null,
  );
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const shown = dragging?.order ?? rotation;

  const moveTo = (from: number, to: number, order: DisplayPanel[]) => {
    const next = [...order];
    next.splice(to, 0, ...next.splice(from, 1));
    return next;
  };

  const onGripDown = (index: number) => (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    try {
      // Without it the pointer leaves the handle on the first row it crosses
      // and the moves stop arriving. Losing the capture is not worth losing
      // the drag over, so it is not allowed to throw.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Nothing to do: the drag still works while the pointer is over a row.
    }
    setDragging({ at: index, order: rotation });
  };

  const onGripMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragging) return;
    // Which row is the pointer over? Measured rather than assumed, because a
    // hint that wraps makes a taller row than the one above it.
    const y = event.clientY;
    let target = dragging.at;
    for (let i = 0; i < shown.length; i++) {
      const rect = rows.current[i]?.getBoundingClientRect();
      if (!rect) continue;
      if (y > rect.top + rect.height / 2) target = i;
      else break;
    }
    if (target !== dragging.at) {
      setDragging({ at: target, order: moveTo(dragging.at, target, dragging.order) });
    }
  };

  const onGripUp = () => {
    if (!dragging) return;
    const order = dragging.order;
    setDragging(null);
    if (order.some((panel, i) => panel !== rotation[i])) setRotation(order);
  };

  /** The keyboard's way to do the same thing, on the same handle. */
  const nudge = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= rotation.length) return;
    setRotation(moveTo(index, to, rotation));
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Screen">
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="sheet__panel">
        <p className="sheet__meta">
          {screen.name || "Screen"}
          {state === "failed" ? " · not saved" : state === "saving" ? " · saving…" : ""}
        </p>
        <p className="sheet__hint">
          Saved as you tap, and the wall follows within a moment — it is the
          preview.
        </p>

        <Group label="What it shows, in order">
          {/*
            One list, because "which panels" and "in what order" are one
            decision. The row is the switch and the grip is the handle, so
            neither can be hit by accident while reaching for the other.
          */}
          <ul className="rotation">
            {shown.map((panel, index) => (
              <li
                key={panel}
                ref={(node) => {
                  rows.current[index] = node;
                }}
                className={
                  "rotation__row" +
                  (dragging?.at === index ? " is-dragging" : "")
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
                  <span className="rotation__name">{NAMES.get(panel)?.label}</span>
                  <small className="rotation__hint">{NAMES.get(panel)?.hint}</small>
                </label>

                <button
                  type="button"
                  className="rotation__grip"
                  aria-label={`Move ${NAMES.get(panel)?.label}`}
                  onPointerDown={onGripDown(index)}
                  onPointerMove={onGripMove}
                  onPointerUp={onGripUp}
                  onPointerCancel={onGripUp}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      nudge(index, -1);
                    }
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      nudge(index, 1);
                    }
                  }}
                >
                  <Grip />
                </button>
              </li>
            ))}
          </ul>

          <p className="sheet__hint">
            {rotation.length === 1
              ? "One panel, so the screen stays on it. The credit runs last."
              : "Drag a handle to reorder. The credit runs last."}{" "}
            A panel with nothing to show is skipped on its own.
          </p>

          {dropped.length > 0 ? (
            <>
              <h4 className="rotation__off">Not shown</h4>
              <p className="sheet__hint">Tap one to put it back at the end.</p>
              <div className="chips chips--wrap" role="group" aria-label="Not shown">
                {dropped.map((panel) => (
                  <button
                    key={panel}
                    type="button"
                    className="chip"
                    aria-pressed={false}
                    onClick={() => setRotation([...rotation, panel])}
                  >
                    {NAMES.get(panel)?.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </Group>

        {rotation.length > 1 ? (
          <Group label="Each panel stays">
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
                  {seconds}s
                </button>
              ))}
            </div>
          </Group>
        ) : null}

        <Group label="Only show">
          <div className="chips chips--wrap" role="group" aria-label="Stage">
            <Filter
              label="Every stage"
              on={!scope.stage}
              onClick={() => onChange({ scope: { ...scope, stage: "", pool: "" } })}
            />
            {stages.map((stage) => (
              <Filter
                key={stage.id}
                label={stage.name}
                on={scope.stage === stage.id}
                onClick={() =>
                  onChange({ scope: { ...scope, stage: stage.id, pool: "" } })
                }
              />
            ))}
          </div>

          {scope.stage ? (
            <div className="chips chips--wrap" role="group" aria-label="Group">
              <Filter
                label="Every group"
                on={!scope.pool}
                onClick={() => onChange({ scope: { ...scope, pool: "" } })}
              />
              {pools
                .filter((pool) => pool.stage === scope.stage)
                .map((pool) => (
                  <Filter
                    key={pool.id}
                    label={pool.name}
                    on={scope.pool === pool.id}
                    onClick={() => onChange({ scope: { ...scope, pool: pool.id } })}
                  />
                ))}
            </div>
          ) : null}

          {courts.length > 0 ? (
            <div className="chips chips--wrap" role="group" aria-label="Court">
              <Filter
                label="Every court"
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

          <p className="sheet__hint">
            A second screen by the door showing one court is what this is for.
            The main wall wants all of it.
          </p>
        </Group>

        <Group label="Colour">
          <div className="accent">
            <input
              type="color"
              className="accent__pick"
              value={theme.accent || "#22c55e"}
              onChange={(event) =>
                onChange({ theme: { ...theme, accent: event.target.value } })
              }
              aria-label="Accent colour"
            />
            <span className="accent__value">{theme.accent || "#22c55e"}</span>
            {theme.accent ? (
              <button
                type="button"
                className="btn btn--quiet btn--tiny"
                onClick={() => {
                  const { accent: _dropped, ...rest } = theme;
                  onChange({ theme: rest });
                }}
              >
                Reset
              </button>
            ) : null}
          </div>
        </Group>

        <div className="sheet__actions">
          <button type="button" className="btn btn--quiet btn--block" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** Six dots: the handle everything else with a draggable row uses. */
function Grip() {
  return (
    <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden focusable="false">
      {[3, 8, 13].map((y) =>
        [2, 8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />),
      )}
    </svg>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const [id] = useState(() => `group-${Math.random().toString(36).slice(2, 8)}`);
  return (
    <section className="setting" aria-labelledby={id}>
      <h3 className="setting__label" id={id}>
        {label}
      </h3>
      {children}
    </section>
  );
}

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
