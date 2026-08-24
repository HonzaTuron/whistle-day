import { useEffect, useState } from "react";
import { sideName, type BoardRow } from "../../lib/board";

interface Props {
  row: BoardRow;
  saving: boolean;
  onSave: (home: number, away: number) => void;
  onClose: () => void;
}

const MAX_SCORE = 999;

/**
 * The score, as a sheet over the list rather than a row that expands.
 *
 * An expanding row pushes everything below it, which on a phone means the
 * match you were looking at moves under your thumb as you reach for it. A
 * sheet also gives the two scores the whole width, and they need it: this is
 * tapped with one hand, at the side of a court, by someone being told the
 * score rather than reading it.
 *
 * There is a number field between the two buttons because a 21-point set is
 * twenty-one taps otherwise.
 */
export function ScoreSheet({ row, saving, onSave, onClose }: Props) {
  const [home, setHome] = useState(row.fixture.home_score ?? 0);
  const [away, setAway] = useState(row.fixture.away_score ?? 0);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const clamp = (value: number) => Math.min(Math.max(value, 0), MAX_SCORE);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Enter the result">
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="sheet__panel">
        <p className="sheet__meta">
          {row.fixture.code}
          {row.settled ? " · already recorded" : ""}
        </p>

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
            Saving replaces the recorded result. The tables and anything seeded
            from them are rebuilt.
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
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
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
