import type { ScoringConfig, Tiebreaker } from "@seedly/engine";
import { useEffect } from "react";
import { useReorder } from "../../lib/reorder";
import {
  ORDERABLE_TIEBREAKERS,
  SPORTS,
  TIEBREAK_LABELS,
  drawsAllowed,
  matchSport,
  sportById,
  type SportId,
} from "../../lib/scoring";
import { Grip, Group } from "./SheetParts";

interface Props {
  sport: string;
  scoring: ScoringConfig | null;
  /** Only ever shown when a write is in the air or one failed. */
  state: "idle" | "saving" | "failed";
  onChange: (scoring: ScoringConfig, sport: string) => void;
  onClose: () => void;
}

/**
 * How the table is worked out, changed from the phone.
 *
 * The wizard already asked the only question most organisers have — what sport
 * — and this is where the answer stops being a preset. A league that plays for
 * two points, a rulebook that ranks on sets before head-to-head, a walkover
 * credited as 3-0: all of them are somebody's real rules and none of them are
 * a sport.
 *
 * Everything saves on change, like the screen sheet, because there is nothing
 * here to get half-right and no reason to make somebody find a Save button
 * with sixteen teams waiting.
 *
 * **What it does not do is re-tally.** `standings` is rebuilt when a result
 * lands, so a table already on the wall keeps the points it was built with
 * until the next fixture in its pool is settled. Saying so is better than
 * quietly firing a resolve of every stage off a settings sheet: that is a much
 * larger write than the one being asked for, and it is the sort of thing that
 * should happen because somebody meant it.
 */
export function ScoringSheet({ sport, scoring, state, onChange, onClose }: Props) {
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  /**
   * A tournament created before this screen existed may have no scoring at
   * all, and the server reads that as the football default. The sheet has to
   * show what the server would do, not an empty form.
   */
  const config: ScoringConfig = scoring ?? sportById("other").scoring;
  const draws = drawsAllowed(config);
  const picked = matchSport(sport, config);

  const patch = (change: Partial<ScoringConfig>, nextSport = sport) =>
    onChange({ ...config, ...change }, nextSport);

  /**
   * Points is always first — a table ordered by anything before its own points
   * column is not a table — so only what follows it is arrangeable.
   */
  const order = (config.tiebreakers ?? []).filter(
    (criterion): criterion is Tiebreaker =>
      criterion !== "points" && ORDERABLE_TIEBREAKERS.includes(criterion),
  );
  const unused = ORDERABLE_TIEBREAKERS.filter((criterion) => !order.includes(criterion));

  const setOrder = (next: Tiebreaker[]) => patch({ tiebreakers: ["points", ...next] });
  const drag = useReorder(order, setOrder);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Scoring">
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="sheet__panel">
        <p className="sheet__meta">
          Scoring
          {state === "failed" ? " · not saved" : state === "saving" ? " · saving…" : ""}
        </p>
        <p className="sheet__hint">
          Saved as you tap. Tables are rebuilt when the next result in a group
          lands, so one already on the wall keeps its points until then.
        </p>

        <Group label="Sport">
          <div className="chips chips--wrap" role="group" aria-label="Sport">
            {SPORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={"chip" + (picked === option.id ? " is-on" : "")}
                aria-pressed={picked === option.id}
                onClick={() => patch(option.scoring, option.sport)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="sheet__hint">
            {picked
              ? sportById(picked as SportId).hint
              : "Set by hand. Tapping a sport puts its own numbers back."}
          </p>
        </Group>

        <Group label="Points">
          <div className="points">
            <Points
              label="Win"
              value={config.pointsWin}
              onChange={(pointsWin) => patch({ pointsWin })}
            />
            {/* A draw column on a sport that has none is a control that can
                only ever be set wrong, so it goes rather than greys out. */}
            {draws ? (
              <Points
                label="Draw"
                value={config.pointsDraw}
                onChange={(pointsDraw) => patch({ pointsDraw })}
              />
            ) : null}
            <Points
              label="Loss"
              value={config.pointsLoss}
              onChange={(pointsLoss) => patch({ pointsLoss })}
            />
          </div>
        </Group>

        <Group label="Can a match end level?">
          <div className="chips" role="group" aria-label="Draws">
            <button
              type="button"
              className={"chip" + (draws ? " is-on" : "")}
              aria-pressed={draws}
              onClick={() => patch({ drawsAllowed: true })}
            >
              Draws allowed
            </button>
            <button
              type="button"
              className={"chip" + (!draws ? " is-on" : "")}
              aria-pressed={!draws}
              onClick={() => patch({ drawsAllowed: false, pointsDraw: 0 })}
            >
              Somebody wins
            </button>
          </div>
          <p className="sheet__hint">
            {draws
              ? "A level score is a result, and both sides take the draw points."
              : "A level score is refused when the result is saved."}{" "}
            A knockout match never ends level either way — somebody has to go
            through.
          </p>
        </Group>

        <Group label="A walkover counts as">
          <div className="points">
            <Points
              label="Score"
              value={config.walkoverScore ?? 0}
              onChange={(walkoverScore) => patch({ walkoverScore })}
            />
          </div>
          <p className="sheet__hint">
            Credited to whoever turned up. Zero keeps an absence from flattering
            anyone's score difference; a rulebook that says 3-0 wants 3.
          </p>
        </Group>

        <Group label="When teams are level, rank on">
          {/*
            The same list and the same handle as the screen sheet's rotation,
            through the same hook — see lib/reorder.ts.
          */}
          <ol className="rotation">
            <li className="rotation__row is-fixed">
              <span className="rotation__pick">
                <span className="rotation__name">{TIEBREAK_LABELS.points.label}</span>
                <small className="rotation__hint">Always first.</small>
              </span>
            </li>
            {drag.shown.map((criterion, index) => (
              <li
                key={criterion}
                ref={drag.rowRef(index)}
                className={
                  "rotation__row" + (drag.draggingAt === index ? " is-dragging" : "")
                }
              >
                <label className="rotation__pick">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked
                    onChange={() =>
                      setOrder(order.filter((value) => value !== criterion))
                    }
                  />
                  <span className="rotation__name">
                    {TIEBREAK_LABELS[criterion].label}
                  </span>
                  <small className="rotation__hint">
                    {TIEBREAK_LABELS[criterion].hint}
                  </small>
                </label>

                <button
                  type="button"
                  className="rotation__grip"
                  aria-label={`Move ${TIEBREAK_LABELS[criterion].label}`}
                  {...drag.gripProps(index)}
                >
                  <Grip />
                </button>
              </li>
            ))}
          </ol>

          <p className="sheet__hint">
            Drag a handle to reorder. Head-to-head is worked out among the tied
            teams only, from what they played against each other.
          </p>

          {unused.length > 0 ? (
            <>
              <h4 className="rotation__off">Not used</h4>
              <p className="sheet__hint">Tap one to put it back at the end.</p>
              <div className="chips chips--wrap" role="group" aria-label="Not used">
                {unused.map((criterion) => (
                  <button
                    key={criterion}
                    type="button"
                    className="chip"
                    aria-pressed={false}
                    onClick={() => setOrder([...order, criterion])}
                  >
                    {TIEBREAK_LABELS[criterion].label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </Group>

        <button type="button" className="btn btn--quiet btn--block" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

/**
 * One points column.
 *
 * The buttons send a step rather than a number, the same way the match sheet's
 * do: two taps inside one frame both read the value their row was drawn with,
 * and "make it 4" twice is one tap lost.
 */
function Points({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const step = (by: number) => onChange(Math.max(0, Math.min(99, (value ?? 0) + by)));
  return (
    <div className="points__col">
      <span className="points__label">{label}</span>
      <div className="points__steps">
        <button
          type="button"
          className="points__step"
          aria-label={`${label}: one fewer`}
          onClick={() => step(-1)}
        >
          −
        </button>
        <output className="points__value">{value ?? 0}</output>
        <button
          type="button"
          className="points__step"
          aria-label={`${label}: one more`}
          onClick={() => step(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
