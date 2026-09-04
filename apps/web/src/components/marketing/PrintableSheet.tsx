import type { FixtureDraft, SlotDraft, StagePlan } from "@whistleday/engine";
import { useMemo, useState } from "react";
import { usePreview, type PreviewRequest } from "../../api/preview";
import { roundTitle } from "../../lib/bracket";
import { useT } from "../../lib/i18n";

/**
 * A blank sheet, drawn by the server, for printing and filling in by hand.
 *
 * The paper version is not a lesser thing than the app. A hall with no wifi,
 * a referee who does not want a phone, and a wall that wants a draw pinned to
 * it before anyone arrives are all real, and all of them end at a printer.
 *
 * What matters is that this is the same bracket the tournament would get: the
 * plan comes from `POST /api/preview`, which runs the same generators as a
 * real stage. A sheet printed on Friday that disagrees with the draw on
 * Saturday would be the worst bug this could have, because nobody would find
 * out until the hall did.
 */
export function PrintableSheet({
  request,
  teams,
}: {
  request: PreviewRequest;
  teams: number;
}) {
  const [names, setNames] = useState<string[]>([]);
  const filled = names.filter((name) => name.trim().length > 0).length;

  // Only send names once there are enough to draw with; a half-typed list
  // would redraw the bracket on every keystroke against a shrinking field.
  const withNames = useMemo<PreviewRequest>(
    () =>
      filled === teams
        ? { ...request, names: names.map((n) => n.trim()) }
        : request,
    [request, names, filled, teams],
  );

  const state = usePreview(withNames);

  return (
    <div className="sheet">
      <div className="sheet__controls">
        <h2 className="doc__heading">Put your own teams on it</h2>
        <p className="doc__para">
          Optional — the sheet prints with numbered places if you leave this
          empty. Nothing is sent anywhere until you ask for the draw, and
          nothing is saved.
        </p>
        <ol className="sheet__names">
          {Array.from({ length: teams }, (_, i) => (
            <li key={i}>
              <input
                className="wiz__input sheet__name"
                value={names[i] ?? ""}
                onChange={(event) =>
                  setNames((current) => {
                    const next = [...current];
                    next.length = teams;
                    next[i] = event.target.value;
                    return next;
                  })
                }
                placeholder={`Team ${i + 1}`}
                aria-label={`Team ${i + 1}`}
                maxLength={40}
                autoComplete="off"
              />
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => window.print()}
          disabled={state.status !== "ready"}
        >
          Print this sheet
        </button>
      </div>

      {state.status === "loading" && (
        <p className="doc__para sheet__status">Drawing it…</p>
      )}
      {state.status === "failed" && (
        <p className="doc__para sheet__status">
          The draw could not be fetched ({state.message}). The numbers above are
          still right — they are worked out here rather than asked for.
        </p>
      )}
      {state.status === "ready" && <Plan plan={state.plan} />}
    </div>
  );
}

/**
 * Rounds for a bracket, pools for anything with a table. Which one this is
 * comes from the plan rather than from the page: a pool named "A" is a group
 * whatever format asked for it.
 */
function Plan({ plan }: { plan: StagePlan }) {
  const slots = useMemo(
    () => new Map(plan.slots.map((slot) => [slot.key, slot])),
    [plan],
  );

  return (
    <div className="sheet__paper">
      {plan.pools.map((pool) => {
        const fixtures = plan.fixtures.filter((f) => f.pool_key === pool.key);
        if (fixtures.length === 0) return null;
        return (
          <section className="sheet__pool" key={pool.key}>
            <h3 className="sheet__pool-name">{pool.name}</h3>
            <Rounds fixtures={fixtures} slots={slots} bracket={pool.kind !== "group"} />
          </section>
        );
      })}
    </div>
  );
}

function Rounds({
  fixtures,
  slots,
  bracket,
}: {
  fixtures: FixtureDraft[];
  slots: Map<string, SlotDraft>;
  bracket: boolean;
}) {
  const t = useT();

  const rounds = useMemo(() => {
    // A bracket holds a power of two, so a field of 12 is drawn into 16 and
    // the four spare positions become bye slots. The fixtures against them are
    // still written — they settle themselves as soon as the other side is
    // known — and their status is "pending" like any other, so they have to be
    // found through the slot rather than through the fixture. Printing them
    // would put four "Team 5 vs Bye" lines on a sheet somebody has to cross
    // out before the first match.
    const isBye = (key: string) => slots.get(key)?.source_type === "bye";

    const byRound = new Map<number, FixtureDraft[]>();
    for (const fixture of fixtures) {
      if (isBye(fixture.home_slot_key) || isBye(fixture.away_slot_key)) continue;
      const list = byRound.get(fixture.round) ?? [];
      list.push(fixture);
      byRound.set(fixture.round, list);
    }
    return [...byRound.entries()].sort(([a], [b]) => a - b);
  }, [fixtures, slots]);

  const side = (key: string) => slots.get(key)?.label ?? "TBD";

  return (
    <>
      {rounds.map(([round, list], index) => (
        <div className="sheet__round" key={round}>
          <h4 className="sheet__round-name">
            {bracket
              ? roundTitle(t, rounds.length - index)
              : `Round ${round + 1}`}
          </h4>
          <table className="sheet__table">
            <tbody>
              {list.map((fixture) => (
                <tr key={fixture.key}>
                  <td className="sheet__code">{fixture.code}</td>
                  <td className="sheet__team">{side(fixture.home_slot_key)}</td>
                  {/* Ruled boxes rather than a 0–0: this is printed to be
                      written on, and a printed score is one somebody has to
                      cross out. */}
                  <td className="sheet__score" />
                  <td className="sheet__score" />
                  <td className="sheet__team sheet__team--away">
                    {side(fixture.away_slot_key)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
