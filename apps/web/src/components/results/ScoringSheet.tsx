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
import { useT, type Translate } from "../../lib/i18n";
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
  const t = useT();

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
    <div className="sheet" role="dialog" aria-modal="true" aria-label={t("scoring.label")}>
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label={t("common.close")}
      />

      <div className="sheet__panel">
        <p className="sheet__meta">
          {t("scoring.label")}
          {state === "failed"
            ? ` · ${t("common.notSaved")}`
            : state === "saving"
              ? ` · ${t("common.saving")}`
              : ""}
        </p>
        <p className="sheet__hint">{t("scoring.note")}</p>

        <Group label={t("scoring.sport")}>
          <div className="chips chips--wrap" role="group" aria-label={t("scoring.sport")}>
            {SPORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={"chip" + (picked === option.id ? " is-on" : "")}
                aria-pressed={picked === option.id}
                onClick={() => patch(option.scoring, option.sport)}
              >
                {t(option.label)}
              </button>
            ))}
          </div>
          <p className="sheet__hint">
            {picked
              ? t(sportById(picked as SportId).hint)
              : t("scoring.byHand")}
          </p>
        </Group>

        <Group label={t("scoring.points")}>
          <div className="points">
            <Points
              t={t}
              label={t("scoring.win")}
              value={config.pointsWin}
              onChange={(pointsWin) => patch({ pointsWin })}
            />
            {/* A draw column on a sport that has none is a control that can
                only ever be set wrong, so it goes rather than greys out. */}
            {draws ? (
              <Points
                t={t}
                label={t("scoring.draw")}
                value={config.pointsDraw}
                onChange={(pointsDraw) => patch({ pointsDraw })}
              />
            ) : null}
            <Points
              t={t}
              label={t("scoring.loss")}
              value={config.pointsLoss}
              onChange={(pointsLoss) => patch({ pointsLoss })}
            />
          </div>
        </Group>

        <Group label={t("scoring.drawsTitle")}>
          <div className="chips" role="group" aria-label={t("scoring.draws")}>
            <button
              type="button"
              className={"chip" + (draws ? " is-on" : "")}
              aria-pressed={draws}
              onClick={() => patch({ drawsAllowed: true })}
            >
              {t("scoring.drawsAllowed")}
            </button>
            <button
              type="button"
              className={"chip" + (!draws ? " is-on" : "")}
              aria-pressed={!draws}
              onClick={() => patch({ drawsAllowed: false, pointsDraw: 0 })}
            >
              {t("scoring.somebodyWins")}
            </button>
          </div>
          <p className="sheet__hint">
            {t(draws ? "scoring.drawsYes" : "scoring.drawsNo")}{" "}
            {t("scoring.drawsTail")}
          </p>
        </Group>

        <Group label={t("scoring.walkoverTitle")}>
          <div className="points">
            <Points
              t={t}
              label={t("scoring.score")}
              value={config.walkoverScore ?? 0}
              onChange={(walkoverScore) => patch({ walkoverScore })}
            />
          </div>
          <p className="sheet__hint">{t("scoring.walkoverNote")}</p>
        </Group>

        <Group label={t("scoring.tiebreakTitle")}>
          {/*
            The same list and the same handle as the screen sheet's rotation,
            through the same hook — see lib/reorder.ts.
          */}
          <ol className="rotation">
            <li className="rotation__row is-fixed">
              <span className="rotation__pick">
                <span className="rotation__name">
                  {t(TIEBREAK_LABELS.points.label)}
                </span>
                <small className="rotation__hint">{t("scoring.alwaysFirst")}</small>
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
                    {t(TIEBREAK_LABELS[criterion].label)}
                  </span>
                  <small className="rotation__hint">
                    {t(TIEBREAK_LABELS[criterion].hint)}
                  </small>
                </label>

                <button
                  type="button"
                  className="rotation__grip"
                  aria-label={t("screen.move", {
                    name: t(TIEBREAK_LABELS[criterion].label),
                  })}
                  {...drag.gripProps(index)}
                >
                  <Grip />
                </button>
              </li>
            ))}
          </ol>

          <p className="sheet__hint">{t("scoring.tiebreakNote")}</p>

          {unused.length > 0 ? (
            <>
              <h4 className="rotation__off">{t("scoring.notUsed")}</h4>
              <p className="sheet__hint">{t("screen.tapToRestore")}</p>
              <div
                className="chips chips--wrap"
                role="group"
                aria-label={t("scoring.notUsed")}
              >
                {unused.map((criterion) => (
                  <button
                    key={criterion}
                    type="button"
                    className="chip"
                    aria-pressed={false}
                    onClick={() => setOrder([...order, criterion])}
                  >
                    {t(TIEBREAK_LABELS[criterion].label)}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </Group>

        <button type="button" className="btn btn--quiet btn--block" onClick={onClose}>
          {t("common.done")}
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
  t,
  label,
  value,
  onChange,
}: {
  t: Translate;
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
          aria-label={t("scoring.oneFewer", { label })}
          onClick={() => step(-1)}
        >
          −
        </button>
        <output className="points__value">{value ?? 0}</output>
        <button
          type="button"
          className="points__step"
          aria-label={t("scoring.oneMore", { label })}
          onClick={() => step(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
