import { useRef, useState } from "react";

/**
 * A list reordered by dragging a handle, with the keyboard doing the same job
 * on the same handle.
 *
 * This was written for the projector's panel rotation and is shared with the
 * tiebreak order, which is the same interaction over a different list. Copying
 * it would have been the third time this codebase learned that lesson: round
 * titles were duplicated between two screens and immediately drifted, which is
 * why `lib/bracket.ts` exists.
 *
 * Two things about it are not incidental:
 *
 * - **The order under the finger is local until it is let go.** A write per row
 *   the pointer crosses would put the network inside the drag.
 * - **It is pointer events, not HTML5 drag-and-drop**, which does not exist on
 *   touch — and every screen here is used on a phone.
 */
export interface Reorder<T> {
  /** What to render: the dragged order while dragging, the real one otherwise. */
  shown: T[];
  /** Index of the row under the finger, for the dragging class. */
  draggingAt: number | null;
  /** Ref callback for each row, so the drop target can be measured. */
  rowRef: (index: number) => (node: HTMLElement | null) => void;
  /** Spread onto the grip. */
  gripProps: (index: number) => {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  };
}

const moveTo = <T,>(order: T[], from: number, to: number): T[] => {
  const next = [...order];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};

export function useReorder<T>(order: T[], onReorder: (next: T[]) => void): Reorder<T> {
  const [dragging, setDragging] = useState<{ at: number; order: T[] } | null>(null);
  const rows = useRef<(HTMLElement | null)[]>([]);
  const shown = dragging?.order ?? order;

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
    setDragging({ at: index, order });
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
      setDragging({ at: target, order: moveTo(dragging.order, dragging.at, target) });
    }
  };

  const onGripUp = () => {
    if (!dragging) return;
    const next = dragging.order;
    setDragging(null);
    if (next.some((item, i) => item !== order[i])) onReorder(next);
  };

  /** The keyboard's way to do the same thing, on the same handle. */
  const nudge = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= order.length) return;
    onReorder(moveTo(order, index, to));
  };

  return {
    shown,
    draggingAt: dragging?.at ?? null,
    rowRef: (index) => (node) => {
      rows.current[index] = node;
    },
    gripProps: (index) => ({
      onPointerDown: onGripDown(index),
      onPointerMove: onGripMove,
      onPointerUp: onGripUp,
      onPointerCancel: onGripUp,
      onKeyDown: (event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          nudge(index, -1);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          nudge(index, 1);
        }
      },
    }),
  };
}
