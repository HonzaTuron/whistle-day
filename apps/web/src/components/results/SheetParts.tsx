import { useState } from "react";

/**
 * The pieces both settings sheets are built from.
 *
 * They were the screen sheet's own until the scoring sheet needed the same
 * section heading and the same drag handle. A second grip drawn slightly
 * differently is how two sheets stop looking like one app.
 */

/** A labelled block of settings. */
export function Group({ label, children }: { label: string; children: React.ReactNode }) {
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

/** The six-dot handle on a draggable row. */
export function Grip() {
  return (
    <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden focusable="false">
      {[3, 8, 13].map((y) =>
        [2, 8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />),
      )}
    </svg>
  );
}
