import type { Court, Entry, Id } from "@seedly/engine";
import { useEffect, useState } from "react";
import type { BoardFixture } from "../../api/organiser";
import {
  atTime,
  scheduleConflicts,
  sideName,
  timeValue,
  type BoardRow,
} from "../../lib/board";

interface Props {
  row: BoardRow;
  courts: Court[];
  allFixtures: BoardFixture[];
  entries: Map<Id, Entry>;
  saving: boolean;
  onSave: (home: number, away: number) => void;
  onWalkover: (winner: string) => void;
  onClear: () => void;
  onSchedule: (schedule: { court?: string | null; scheduled_at?: string }) => void;
  onLive: (live: boolean) => void;
  onClose: () => void;
}

const MAX_SCORE = 999;

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
  saving,
  onSave,
  onWalkover,
  onClear,
  onSchedule,
  onLive,
  onClose,
}: Props) {
  const [home, setHome] = useState(row.fixture.home_score ?? 0);
  const [away, setAway] = useState(row.fixture.away_score ?? 0);
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

  const clamp = (value: number) => Math.min(Math.max(value, 0), MAX_SCORE);
  const clashes = scheduleConflicts(row.fixture, allFixtures, entries, courts);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Match">
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="sheet__panel">
        <p className="sheet__meta">
          {row.fixture.code}
          {row.walkover ? " · walkover" : row.settled ? " · already recorded" : ""}
          {row.live ? " · live" : ""}
        </p>

        {asking === "clear" ? (
          <>
            <p className="sheet__question">Take this result off?</p>
            <p className="sheet__note">
              {sideName(row.home)} {row.fixture.home_score ?? 0}–
              {row.fixture.away_score ?? 0} {sideName(row.away)} is deleted, and
              anything it put into a later round goes back to waiting.
            </p>
            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--danger btn--block"
                disabled={saving}
                onClick={onClear}
              >
                {saving ? "Clearing…" : "Clear the result"}
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={() => setAsking("none")}
              >
                Keep it
              </button>
            </div>
          </>
        ) : asking === "walkover" ? (
          <>
            <p className="sheet__question">Who takes the win?</p>
            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--block"
                disabled={saving}
                onClick={() => onWalkover(row.home.entry?.id ?? "")}
              >
                {sideName(row.home)}
              </button>
              <button
                type="button"
                className="btn btn--block"
                disabled={saving}
                onClick={() => onWalkover(row.away.entry?.id ?? "")}
              >
                {sideName(row.away)}
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={() => setAsking("none")}
              >
                Back
              </button>
            </div>
            <p className="sheet__note">
              No score is recorded. In a group the winner takes the points for a
              win and nothing else.
            </p>
          </>
        ) : (
          <>
            {courts.length > 0 ? (
              <div className="chips" role="group" aria-label="Court">
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

            <div className="sheet__row">
              <label className="sheet__time">
                <span>Starts</span>
                <input
                  type="time"
                  value={timeValue(row.fixture.scheduled_at)}
                  onChange={(event) =>
                    onSchedule({
                      scheduled_at: atTime(
                        row.fixture.scheduled_at,
                        event.target.value,
                      ),
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
                  {row.live ? "Take it off" : "On court now"}
                </button>
              )}
            </div>

            {clashes.length > 0 ? (
              <div className="sheet__clash" role="alert">
                {clashes.map((clash) => (
                  <p key={clash.fixtureId + clash.team}>
                    {clash.team} is also down for {clash.code} at {clash.time}
                    {clash.court ? ` on ${clash.court}` : ""}.
                  </p>
                ))}
              </div>
            ) : null}

            <Score
              name={sideName(row.home)}
              value={home}
              onChange={(value) => setHome(clamp(value))}
            />
            <Score
              name={sideName(row.away)}
              value={away}
              onChange={(value) => setAway(clamp(value))}
            />

            {row.settled ? (
              <p className="sheet__note">
                Saving replaces the recorded result. The tables and anything
                seeded from them are rebuilt.
              </p>
            ) : null}

            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={saving}
                onClick={() => onSave(home, away)}
              >
                {saving ? "Saving…" : "Save result"}
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--block"
                disabled={saving}
                onClick={() => setAsking("walkover")}
              >
                Somebody didn't turn up
              </button>
              {row.settled ? (
                <button
                  type="button"
                  className="btn btn--quiet btn--block"
                  disabled={saving}
                  onClick={() => setAsking("clear")}
                >
                  Clear the result
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Score({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
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
          disabled={value <= 0}
          aria-label={`One fewer for ${name}`}
        >
          −
        </button>
        {/* A field, not a label: a 21-point set is twenty-one taps otherwise. */}
        <input
          className="score__value"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_SCORE}
          value={value}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          aria-label={`Score for ${name}`}
        />
        <button
          type="button"
          className="stepper__button"
          onClick={() => onChange(value + 1)}
          aria-label={`One more for ${name}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
