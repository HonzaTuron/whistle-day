import type { Court, Entry, Id } from "@seedly/engine";
import { useEffect, useRef, useState } from "react";
import {
  ensureOrganiser,
  loadGames,
  saveGames,
  type BoardFixture,
  type SetScore,
} from "../../api/organiser";
import {
  atTime,
  scheduleConflicts,
  setsWon,
  sideName,
  timeValue,
  type BoardRow,
} from "../../lib/board";
import { useT, type Translate } from "../../lib/i18n";
import { MatchHistory } from "./MatchHistory";

interface Props {
  row: BoardRow;
  courts: Court[];
  allFixtures: BoardFixture[];
  entries: Map<Id, Entry>;
  /** Actor id to the name they gave when they joined, for the history. */
  crew: Map<Id, string>;
  saving: boolean;
  onSave: (home: number, away: number, sets: SetScore[]) => void;
  onWalkover: (winner: string) => void;
  onClear: () => void;
  onSchedule: (schedule: { court?: string | null; scheduled_at?: string }) => void;
  onLive: (live: boolean) => void;
  onClose: () => void;
}

const MAX_SCORE = 999;

/** Long enough that a held + is one write, short enough to feel like none. */
const POINTS_DEBOUNCE_MS = 700;

/**
 * Everything you can do to one match, as a sheet over the list.
 *
 * An expanding row pushes everything below it, which on a phone means the
 * match you were looking at moves under your thumb as you reach for it. A
 * sheet also gives the two scores the whole width, and they need it: this is
 * tapped one-handed, at the side of a court, by someone being told the score
 * rather than reading it.
 *
 * The order is the order of the day. Court and time are decisions already made
 * by the time they are recorded, so they save on tap and sit at the top out of
 * the way. The score is the reason the sheet was opened, so it is at the
 * bottom, under the thumb.
 */
export function MatchSheet({
  row,
  courts,
  allFixtures,
  entries,
  crew,
  saving,
  onSave,
  onWalkover,
  onClear,
  onSchedule,
  onLive,
  onClose,
}: Props) {
  const t = useT();
  const [home, setHome] = useState(row.fixture.home_score ?? 0);
  const [away, setAway] = useState(row.fixture.away_score ?? 0);
  /** The points set by set. `null` until they have been read back. */
  const [sets, setSets] = useState<SetScore[] | null>(null);
  const [pointsState, setPointsState] = useState<"idle" | "saving" | "failed">(
    "idle",
  );
  /**
   * The points as they stand, kept alongside the state they render from.
   *
   * Two taps on + inside one frame both read the same rendered value, so the
   * second overwrites the first and a point goes missing — which is precisely
   * what happens when somebody catches up after two quick rallies. The ref is
   * updated in the handler rather than after the render, so the second tap
   * reads what the first one wrote.
   */
  const latest = useRef<SetScore[]>([]);
  /**
   * "score" is the sheet; the other two are questions it steps aside for.
   * Both are one tap from destroying a result, so neither happens on the tap
   * that opened them.
   */
  const [asking, setAsking] = useState<"none" | "walkover" | "clear">("none");

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const games = await loadGames(await ensureOrganiser(), row.fixture.id);
        if (cancelled) return;
        const loaded = games.map((game) => ({
          home: game.home_score ?? 0,
          away: game.away_score ?? 0,
        }));
        latest.current = loaded;
        setSets(loaded);
      } catch {
        // Sets are the detail under the score, not the score. A match whose
        // points cannot be read is still a match whose result can be entered.
        if (!cancelled) setSets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row.fixture.id]);

  /**
   * Points are written as they are entered, not when the sheet is saved.
   *
   * Somebody standing at the net tapping a point per rally is not going to
   * press Save between rallies, and the reason to enter them at all is the
   * wall: the projector polls every four seconds, so a tap here is a scoreline
   * in the hall a moment later. Saving the *result* is still a separate,
   * deliberate act — that is the one that ends the match and moves the tables.
   *
   * It does not go through the board's write-then-reload: the board shows the
   * fixture's score, which these do not change, so reloading seven collections
   * per rally would buy nothing. The delay is there so that holding + writes
   * once rather than nine times, and the write is flushed on the way out —
   * closing the sheet a moment after the last tap must not lose it.
   */
  const flush = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const writePoints = (next: SetScore[]) => {
    if (timer.current) clearTimeout(timer.current);

    const send = () => {
      timer.current = null;
      flush.current = null;
      setPointsState("saving");
      void (async () => {
        try {
          await saveGames(await ensureOrganiser(), row.fixture.id, next, row.settled);
          setPointsState("idle");
        } catch {
          setPointsState("failed");
        }
      })();
    };

    flush.current = send;
    timer.current = setTimeout(send, POINTS_DEBOUNCE_MS);
  };

  /**
   * Drop a pending write instead of sending it.
   *
   * Recording a result, a walkover or a clear writes these same rows itself,
   * and it knows something this timer does not: whether the match is over. A
   * debounced write landing a moment later would put the last set back to
   * unfinished, or — after a clear — recreate the rows that were just deleted.
   */
  const forgetPoints = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    flush.current = null;
  };

  // Anything still pending goes on the way out: closing the sheet a moment
  // after the last tap must not lose it.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      flush.current?.();
    },
    [],
  );

  const clamp = (value: number) => Math.min(Math.max(value, 0), MAX_SCORE);
  const clashes = scheduleConflicts(row.fixture, allFixtures, entries, courts);

  /**
   * Once there are points, the match score is counted rather than typed. Two
   * places to enter the same number is two places for them to disagree, and
   * the one the hall watched is the set scores.
   *
   * A set is won when it is over, and the last set of a live match is not:
   * 18–14 in the third is not a two-set lead, it is a third set somebody is
   * ahead in. Counting it would put a score on this screen that the wall — and
   * the hall — can both see is not the score. Saving is what ends the match,
   * and it ends that set with it, so the recorded result counts every set.
   */
  const points = sets ?? [];
  const inPlay = row.live && points.length > 0 ? points.length - 1 : -1;
  const counted = setsWon(points.filter((_, index) => index !== inPlay));
  const final = setsWon(points);
  const fromPoints = points.length > 0;
  const homeScore = fromPoints ? counted.home : home;
  const awayScore = fromPoints ? counted.away : away;
  const savedScore = fromPoints ? final : { home, away };
  const endsASet =
    fromPoints && (final.home !== counted.home || final.away !== counted.away);

  /** Every change to the points is a change on the wall, so it is written. */
  const changeSets = (update: (previous: SetScore[]) => SetScore[]) => {
    const next = update(latest.current);
    latest.current = next;
    setSets(next);
    writePoints(next);
  };

  const editSet = (index: number, side: "home" | "away", value: number) =>
    changeSets((previous) =>
      previous.map((set, i) =>
        i === index ? { ...set, [side]: clamp(value) } : set,
      ),
    );

  /**
   * A tap is a point, not a number.
   *
   * The buttons send the step and the count is done here, against what the
   * last tap left behind. Sending `value + 1` instead would send the value
   * this row was drawn with, so two taps between two frames would both mean
   * "make it 19" — and the second point of the rally would never be scored.
   */
  const stepSet = (index: number, side: "home" | "away", delta: number) =>
    changeSets((previous) =>
      previous.map((set, i) =>
        i === index ? { ...set, [side]: clamp(set[side] + delta) } : set,
      ),
    );

  const onCourt = courts.find((court) => court.id === row.fixture.court);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={t("match.label")}>
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label={t("common.close")}
      />

      <div className="sheet__panel">
        <p className="sheet__meta">
          {row.fixture.code}
          {row.walkover
            ? ` · ${t("match.walkover")}`
            : row.settled
              ? ` · ${t("match.recorded")}`
              : ""}
          {row.live ? ` · ${t("match.live")}` : ""}
        </p>

        {asking === "clear" ? (
          <>
            <p className="sheet__question">{t("match.clearAsk")}</p>
            <p className="sheet__note">
              {t("match.clearNote", {
                home: sideName(t, row.home),
                away: sideName(t, row.away),
                homeScore: row.fixture.home_score ?? 0,
                awayScore: row.fixture.away_score ?? 0,
              })}
            </p>
            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--danger btn--block"
                disabled={saving}
                onClick={() => {
                  forgetPoints();
                  onClear();
                }}
              >
                {t(saving ? "match.clearing" : "match.clear")}
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={() => setAsking("none")}
              >
                {t("match.keepIt")}
              </button>
            </div>
          </>
        ) : asking === "walkover" ? (
          <>
            <p className="sheet__question">{t("match.walkoverAsk")}</p>
            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--block"
                disabled={saving}
                onClick={() => {
                  forgetPoints();
                  onWalkover(row.home.entry?.id ?? "");
                }}
              >
                {sideName(t, row.home)}
              </button>
              <button
                type="button"
                className="btn btn--block"
                disabled={saving}
                onClick={() => {
                  forgetPoints();
                  onWalkover(row.away.entry?.id ?? "");
                }}
              >
                {sideName(t, row.away)}
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={() => setAsking("none")}
              >
                {t("common.back")}
              </button>
            </div>
            <p className="sheet__note">{t("match.walkoverNote")}</p>
          </>
        ) : (
          <>
            {courts.length > 0 ? (
              <div className="chips" role="group" aria-label={t("match.court")}>
                {courts.map((court) => (
                  <button
                    key={court.id}
                    type="button"
                    className={
                      "chip" + (row.fixture.court === court.id ? " is-on" : "")
                    }
                    onClick={() =>
                      onSchedule({
                        court: row.fixture.court === court.id ? null : court.id,
                      })
                    }
                  >
                    {court.name}
                  </button>
                ))}
              </div>
            ) : null}

            {/* The chips write the moment they are tapped, and a lit chip is
                the only thing that says so. Somebody who taps one and watches
                for a Save button needs telling, and so does somebody looking
                for the way to take a match back off a court. */}
            {courts.length > 0 ? (
              <p className="sheet__hint">
                {onCourt
                  ? t("match.onCourtSaved", { court: onCourt.name })
                  : t("match.noCourtYet")}{" "}
                {t("match.savesOnTap")}
              </p>
            ) : null}

            <div className="sheet__row">
              <label className="sheet__time">
                <span>{t("match.starts")}</span>
                <TimeField
                  value={timeValue(row.fixture.scheduled_at)}
                  onCommit={(time) =>
                    onSchedule({
                      scheduled_at: atTime(row.fixture.scheduled_at, time),
                    })
                  }
                />
              </label>

              {row.settled ? null : (
                <button
                  type="button"
                  className={"btn btn--live" + (row.live ? " is-on" : "")}
                  disabled={saving}
                  onClick={() => onLive(!row.live)}
                >
                  {t(row.live ? "match.takeOff" : "match.onCourtNow")}
                </button>
              )}
            </div>

            {clashes.length > 0 ? (
              <div className="sheet__clash" role="alert">
                {clashes.map((clash) => (
                  <p key={clash.fixtureId + clash.team}>
                    {t("match.clash", {
                      team: clash.team,
                      code: clash.code,
                      time: clash.time,
                      court: clash.court
                        ? t("match.clashCourt", { court: clash.court })
                        : "",
                    })}
                  </p>
                ))}
              </div>
            ) : null}

            <Score
              t={t}
              name={sideName(t, row.home)}
              value={homeScore}
              counted={fromPoints}
              onChange={(value) => setHome(clamp(value))}
            />
            <Score
              t={t}
              name={sideName(t, row.away)}
              value={awayScore}
              counted={fromPoints}
              onChange={(value) => setAway(clamp(value))}
            />

            <Sets
              t={t}
              home={sideName(t, row.home)}
              away={sideName(t, row.away)}
              sets={points}
              inPlay={inPlay}
              state={pointsState}
              onEdit={editSet}
              onStep={stepSet}
              onAdd={() => changeSets((previous) => [...previous, { home: 0, away: 0 }])}
              onRemove={(index) =>
                changeSets((previous) => previous.filter((_, i) => i !== index))
              }
            />

            {endsASet ? (
              <p className="sheet__hint">
                {t("match.setInPlay", {
                  number: points.length,
                  home: savedScore.home,
                  away: savedScore.away,
                })}
              </p>
            ) : null}

            {row.settled ? (
              <p className="sheet__note">{t("match.replaces")}</p>
            ) : null}

            <MatchHistory fixture={row.fixture.id} crew={crew} />

            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={saving}
                onClick={() => {
                  forgetPoints();
                  onSave(savedScore.home, savedScore.away, points);
                }}
              >
                {t(saving ? "common.saving" : "match.save")}
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--block"
                disabled={saving}
                onClick={() => setAsking("walkover")}
              >
                {t("match.noShow")}
              </button>
              {row.settled ? (
                <button
                  type="button"
                  className="btn btn--quiet btn--block"
                  disabled={saving}
                  onClick={() => setAsking("clear")}
                >
                  {t("match.clear")}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={onClose}
                disabled={saving}
              >
                {t("common.cancel")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The start time, which is the one thing on this sheet that is typed.
 *
 * A time input is filled a field at a time and reports nothing until both are
 * in: type the hour of 10:45 and the value is still `""`. Saving every change
 * straight to the fixture — which is what the rest of this sheet correctly
 * does, since a tap is a whole answer — wrote that empty string as a cleared
 * time and handed it back to the input, which wiped the hour out from under
 * whoever was typing it. The minutes were unreachable.
 *
 * So what is being typed lives here until it is a time. The fixture is still
 * the truth: the draft is dropped the moment the record comes back saying the
 * same thing, or the field is left. Empty is only sent on the way out, because
 * emptied-and-left is somebody taking the time off a match, while emptied
 * mid-edit is somebody halfway through changing it.
 */
function TimeField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (time: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  // The record has caught up with what was typed — or somebody on another
  // phone has moved the match, which is likewise not this field's business to
  // argue with.
  useEffect(() => {
    setDraft((held) => (held === value ? null : held));
  }, [value]);

  return (
    <input
      type="time"
      value={draft ?? value}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        // A whole time saves on the spot, like the court chips above it.
        if (next) onCommit(next);
      }}
      onBlur={() => {
        if (draft === "" && value) {
          onCommit("");
          setDraft(null);
        }
      }}
    />
  );
}


function Score({
  t,
  name,
  value,
  counted,
  onChange,
}: {
  t: Translate;
  name: string;
  value: number;
  /** Counted from the points below, so this is a read-out rather than a field. */
  counted: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="score">
      <span className="score__name">{name}</span>
      <div className="score__control">
        <button
          type="button"
          className="stepper__button"
          onClick={() => onChange(value - 1)}
          disabled={counted || value <= 0}
          aria-label={t("match.oneFewerFor", { name })}
        >
          −
        </button>
        {/* A field, not a label: a 21-point set is twenty-one taps otherwise. */}
        <input
          className={"score__value" + (counted ? " is-counted" : "")}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_SCORE}
          value={value}
          readOnly={counted}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          aria-label={t("match.scoreFor", { name })}
        />
        <button
          type="button"
          className="stepper__button"
          onClick={() => onChange(value + 1)}
          disabled={counted}
          aria-label={t("match.oneMoreFor", { name })}
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * The points, set by set.
 *
 * They are optional and they are secondary — plenty of days are run on sets
 * alone — so this opens closed, as one button under the score. What it buys
 * once it is filled in: the tiebreak that separates two teams level on points
 * and on sets is the points inside them, and the wall shows a live match set
 * by set instead of as a bare 1–1.
 *
 * The sets above are counted from these rather than typed alongside them. A
 * screen that lets somebody enter 2–1 over three sets that read 25–20, 22–25,
 * 19–25 is a screen that will eventually put a scoreline on a wall that the
 * hall can see is wrong.
 */
function Sets({
  t,
  home,
  away,
  sets,
  inPlay,
  state,
  onEdit,
  onStep,
  onAdd,
  onRemove,
}: {
  t: Translate;
  home: string;
  away: string;
  sets: SetScore[];
  /** Index of the set being played, or -1 when the match is not on court. */
  inPlay: number;
  state: "idle" | "saving" | "failed";
  onEdit: (index: number, side: "home" | "away", value: number) => void;
  onStep: (index: number, side: "home" | "away", delta: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="sets">
      <div className="sets__head">
        <span className="sets__title">{t("sets.title")}</span>
        {state === "failed" ? (
          <span className="sets__state is-failed">{t("common.notSaved")}</span>
        ) : state === "saving" ? (
          <span className="sets__state">{t("common.saving")}</span>
        ) : null}
        <button type="button" className="btn btn--quiet btn--tiny" onClick={onAdd}>
          {t("sets.add")}
        </button>
      </div>

      {sets.length === 0 ? (
        <p className="sheet__hint">{t("sets.empty")}</p>
      ) : (
        <ol className="sets__list">
          {sets.map((set, index) => (
            // Sets are only ever added and removed from the end of a match, so
            // the index is the identity: set two stays set two.
            <li key={index} className="sets__row">
              <span className="sets__number">
                {t("sets.number", { number: index + 1 })}
                {index === inPlay && (
                  <small className="sets__inplay">{t("sets.inPlay")}</small>
                )}
              </span>
              <SetPoints
                t={t}
                label={t("sets.sideLabel", { name: home, number: index + 1 })}
                value={set.home}
                // Only the last set gets the taps: it is the one being played,
                // and a + beside a set that finished an hour ago is an invitation
                // to change a score nobody meant to touch.
                stepper={index === sets.length - 1}
                live={index === inPlay}
                onChange={(value) => onEdit(index, "home", value)}
                onStep={(delta) => onStep(index, "home", delta)}
              />
              <span className="sets__colon">:</span>
              <SetPoints
                t={t}
                label={t("sets.sideLabel", { name: away, number: index + 1 })}
                value={set.away}
                stepper={index === sets.length - 1}
                live={index === inPlay}
                onChange={(value) => onEdit(index, "away", value)}
                onStep={(delta) => onStep(index, "away", delta)}
              />
              <button
                type="button"
                className="sets__remove"
                onClick={() => onRemove(index)}
                aria-label={t("sets.remove", { number: index + 1 })}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SetPoints({
  t,
  label,
  value,
  stepper,
  live,
  onChange,
  onStep,
}: {
  t: Translate;
  label: string;
  value: number;
  /** Tap-a-point buttons, on the set being entered. */
  stepper: boolean;
  /** That set is on court right now, so the buttons wear the live colour. */
  live: boolean;
  onChange: (value: number) => void;
  onStep: (delta: number) => void;
}) {
  const field = (
    <input
      className="sets__value"
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_SCORE}
      value={value}
      onFocus={(event) => event.target.select()}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      aria-label={label}
    />
  );

  if (!stepper) return <span className="sets__points">{field}</span>;

  return (
    <span className={"sets__points sets__points--stepped" + (live ? " is-live" : "")}>
      <button
        type="button"
        className="sets__tick"
        onClick={() => onStep(-1)}
        disabled={value <= 0}
        aria-label={t("sets.oneFewer", { label })}
      >
        −
      </button>
      {field}
      <button
        type="button"
        className="sets__tick"
        onClick={() => onStep(1)}
        aria-label={t("sets.oneMore", { label })}
      >
        +
      </button>
    </span>
  );
}
