import type { Court, Entry, Id, ScoringConfig } from "@whistleday/engine";
import { useEffect, useRef, useState } from "react";
import {
  ensureOrganiser,
  loadGames,
  saveGames,
  saveOngoingScore,
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
import { canAddSet, matchIsDecided, scoreFault, setsToWin } from "../../lib/bestof";
import { courtsKeys, courtsUnitForSportName } from "../../lib/courts";
import { useT, type Translate } from "../../lib/i18n";
import { MatchHistory } from "./MatchHistory";

interface Props {
  row: BoardRow;
  courts: Court[];
  /** The tournament's sport, which decides what a court is called here. */
  sport: string;
  /** How the day is scored, which is where the match format lives. */
  scoring: ScoringConfig | null;
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
 * A value pushed to the server a moment after the last change rather than on
 * every one, kept alongside the state it renders from so two taps inside one
 * frame are both drawn against what the first one wrote rather than the value
 * the row started the frame with.
 *
 * Both the points and the plain score on this sheet are written this way —
 * somebody tapping a point per rally, or a goal at the side of a pitch, is not
 * going to press Save between them, and the reason to enter either live is the
 * wall: the projector polls every four seconds, so a tap here is a scoreline
 * in the hall a moment later. Saving the *result* stays a separate, deliberate
 * act — the one that ends the match.
 */
function useLiveWrite<T>(
  initial: T,
  save: (next: T) => Promise<void>,
  setState: (state: "idle" | "saving" | "failed") => void,
) {
  const latest = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useRef<(() => void) | null>(null);

  const write = (next: T) => {
    latest.current = next;
    if (timer.current) clearTimeout(timer.current);

    const send = () => {
      timer.current = null;
      flush.current = null;
      setState("saving");
      void (async () => {
        try {
          await save(next);
          setState("idle");
        } catch {
          setState("failed");
        }
      })();
    };

    flush.current = send;
    timer.current = setTimeout(send, POINTS_DEBOUNCE_MS);
  };

  /**
   * Drop a pending write instead of sending it. Recording a result, a
   * walkover or a clear writes the same field itself, and knows something
   * this timer does not: whether the match is over. A write landing after
   * would put a finished match's last set back to unfinished, or a cleared
   * one's score back on it.
   */
  const forget = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    flush.current = null;
  };

  /** Send now instead of waiting: closing the sheet must not lose it. */
  const flushNow = () => {
    if (timer.current) clearTimeout(timer.current);
    flush.current?.();
  };

  return { latest, write, forget, flushNow };
}

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
  sport,
  scoring,
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
  const keys = courtsKeys(courtsUnitForSportName(sport));
  const [home, setHome] = useState(row.fixture.home_score ?? 0);
  const [away, setAway] = useState(row.fixture.away_score ?? 0);
  /** The points set by set. `null` until they have been read back. */
  const [sets, setSets] = useState<SetScore[] | null>(null);
  const [pointsState, setPointsState] = useState<"idle" | "saving" | "failed">(
    "idle",
  );
  const pointsWriter = useLiveWrite<SetScore[]>(
    [],
    async (next) => {
      await saveGames(await ensureOrganiser(), row.fixture.id, next, row.settled);
    },
    setPointsState,
  );
  const scoreWriter = useLiveWrite(
    { home, away },
    async (next) => {
      await saveOngoingScore(await ensureOrganiser(), row.fixture.id, next.home, next.away);
    },
    setPointsState,
  );
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
        pointsWriter.latest.current = loaded;
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

  /** Neither writer should land after a result, walkover or clear. */
  const forgetLiveWrites = () => {
    pointsWriter.forget();
    scoreWriter.forget();
  };

  // Anything still pending goes out on the way out: closing the sheet a
  // moment after the last tap must not lose it.
  useEffect(
    () => () => {
      pointsWriter.flushNow();
      scoreWriter.flushNow();
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

  /**
   * The format, and what it says about the score about to be saved.
   *
   * A best-of-three is over at two sets and not before, and the server will
   * not store anything else. Finding that out here rather than there is the
   * difference between a disabled button and a result refused half an hour
   * later, when the queue drains and the teams have gone.
   */
  const bestOf = scoring?.bestOf ?? 0;
  const need = setsToWin(scoring);
  const fault = scoreFault(bestOf, savedScore.home, savedScore.away);
  const decided = matchIsDecided(scoring, savedScore.home, savedScore.away);
  const moreSets = canAddSet(scoring, points.length, final.home, final.away);
  const winning =
    savedScore.home > savedScore.away ? sideName(t, row.home) : sideName(t, row.away);

  /** Every change to the points is a change on the wall, so it is written. */
  const changeSets = (update: (previous: SetScore[]) => SetScore[]) => {
    const next = update(pointsWriter.latest.current);
    setSets(next);
    pointsWriter.write(next);
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

  /**
   * The plain-score twin of `changeSets`.
   *
   * Only reaches the server while the match is live and has no sets: before
   * that, or once `fromPoints` takes over, nobody but Save changes what the
   * wall shows, and this would be writing a score that is not on it.
   */
  const changeScore = (side: "home" | "away", value: number) => {
    const next = { ...scoreWriter.latest.current, [side]: value };
    setHome(next.home);
    setAway(next.away);
    if (row.live && !fromPoints) scoreWriter.write(next);
    else scoreWriter.latest.current = next;
  };

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
                  forgetLiveWrites();
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
                  forgetLiveWrites();
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
                  forgetLiveWrites();
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
              <div className="chips" role="group" aria-label={t(keys.label)}>
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
                  ? t(keys.onSaved, { court: onCourt.name })
                  : t(keys.noneYet)}{" "}
                {t(keys.savesOnTap)}
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
                  {t(row.live ? keys.takeOff : keys.onNow)}
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
                        ? t(keys.clash, { court: clash.court })
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
              max={need > 0 ? need : MAX_SCORE}
              onChange={(value) => changeScore("home", clamp(value))}
            />
            <Score
              t={t}
              name={sideName(t, row.away)}
              value={awayScore}
              counted={fromPoints}
              max={need > 0 ? need : MAX_SCORE}
              onChange={(value) => changeScore("away", clamp(value))}
            />

            {/* What the format is, said once, above the sets it governs. The
                fault line replaces it when there is one: an organiser looking
                at a greyed-out Save needs to be told which rule holds it. */}
            {need > 0 ? (
              <p
                className={"sheet__hint" + (fault ? " is-fault" : "")}
                role={fault ? "alert" : undefined}
              >
                {fault === "unfinished"
                  ? t("match.notOverYet", {
                      home: savedScore.home,
                      away: savedScore.away,
                      bestOf,
                      count: need,
                    })
                  : fault === "over"
                    ? t("match.tooManySets", {
                        home: savedScore.home,
                        away: savedScore.away,
                        bestOf,
                        count: need,
                      })
                    : decided && !row.settled
                      ? t("match.thatIsTheMatch", {
                          name: winning,
                          home: savedScore.home,
                          away: savedScore.away,
                        })
                      : t("match.bestOf", { bestOf, count: need })}
              </p>
            ) : null}

            <Sets
              t={t}
              home={sideName(t, row.home)}
              away={sideName(t, row.away)}
              sets={points}
              inPlay={inPlay}
              state={pointsState}
              canAdd={moreSets}
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
                disabled={saving || fault !== null}
                onClick={() => {
                  forgetLiveWrites();
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
  max,
  onChange,
}: {
  t: Translate;
  name: string;
  value: number;
  /** Counted from the points below, so this is a read-out rather than a field. */
  counted: boolean;
  /** The sets that win the match, where the format has an opinion. Stepping
      past it is not a mistake worth letting somebody make and then explaining. */
  max: number;
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
          max={max}
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
          disabled={counted || value >= max}
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
  canAdd,
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
  /** False once the format has run out of sets, or the match has been won. */
  canAdd: boolean;
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
        <button
          type="button"
          className="btn btn--quiet btn--tiny"
          disabled={!canAdd}
          onClick={onAdd}
        >
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
