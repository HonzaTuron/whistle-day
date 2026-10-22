import type { FixtureDraft, SlotDraft, StagePlan } from "@whistleday/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePreview, type PreviewRequest } from "../../api/preview";
import { roundTitle } from "../../lib/bracket";
import { translate, type Locale, type MessageKey, type Vars } from "../../lib/i18n";
import { parsePastedTeams } from "../../lib/teams";

/** The fields `POST /api/preview` will draw: two teams up to its limit. */
const MIN_TEAMS = 2;
const MAX_TEAMS = 128;

const PRINT_I18N = {
  en: {
    teamCount: "Number of teams",
    putTeamsHeading: "Put your own teams on it",
    putTeamsPara:
      "Optional — the sheet prints with numbered places if you leave this empty. You can paste a list of clubs into any box, add more teams, or type them in.",
    placeholder: "Team",
    addTeam: "+ Add team",
    pasteTeams: "Paste list of teams",
    hidePaste: "Hide paste box",
    clearNames: "Clear names",
    pastePlaceholder: "Paste team or club names here (one per line, or comma-separated)…",
    applyTeams: "Apply teams",
    cancel: "Cancel",
    printSheet: (n: number) => `Print this sheet (${n} teams)`,
    drawing: "Drawing it…",
    failed: (msg: string) =>
      `The draw could not be fetched (${msg}). The numbers above are still right — they are worked out here rather than asked for.`,
    round: (n: number) => `Round ${n}`,
  },
  cs: {
    teamCount: "Počet týmů",
    putTeamsHeading: "Doplňte vlastní týmy",
    putTeamsPara:
      "Volitelné – pokud pole necháte prázdné, formulář se vytiskne s očíslovanými pozicemi (Tým 1, Tým 2...). Můžete vložit seznam týmů nebo je vepsat ručně.",
    placeholder: "Tým",
    addTeam: "+ Přidat tým",
    pasteTeams: "Vložit seznam týmů",
    hidePaste: "Skrýt pole pro vložení",
    clearNames: "Vymazat názvy",
    pastePlaceholder: "Vložte sem názvy týmů nebo klubů (jeden na řádek nebo oddělené čárkou)…",
    applyTeams: "Použít týmy",
    cancel: "Zrušit",
    printSheet: (n: number) => `Vytisknout tento rozpis (${n} týmů)`,
    drawing: "Generuji rozpis…",
    failed: (msg: string) =>
      `Rozpis se nepodařilo načíst (${msg}). Čísla nahoře jsou stále správná – počítají se přímo zde.`,
    round: (n: number) => `${n}. kolo`,
  },
  es: {
    teamCount: "Número de equipos",
    putTeamsHeading: "Pon tus propios equipos",
    putTeamsPara:
      "Opcional: la hoja se imprime con puestos numerados si lo dejas vacío. Puedes pegar una lista de clubes, añadir más equipos o escribirlos.",
    placeholder: "Equipo",
    addTeam: "+ Añadir equipo",
    pasteTeams: "Pegar lista de equipos",
    hidePaste: "Ocultar cuadro",
    clearNames: "Borrar nombres",
    pastePlaceholder: "Pega los nombres aquí (uno por línea o separados por comas)…",
    applyTeams: "Aplicar equipos",
    cancel: "Cancelar",
    printSheet: (n: number) => `Imprimir esta hoja (${n} equipos)`,
    drawing: "Generando…",
    failed: (msg: string) => `No se pudo obtener el cuadro (${msg}).`,
    round: (n: number) => `Ronda ${n}`,
  },
};

/** The field size asked for in the URL, if it is one the sheet can draw. */
function sizeFromUrl(): number | undefined {
  const asked = Number(new URLSearchParams(window.location.search).get("teams"));
  return Number.isInteger(asked) && asked >= MIN_TEAMS && asked <= MAX_TEAMS
    ? asked
    : undefined;
}

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
  locale = "en",
}: {
  request: PreviewRequest;
  teams: number;
  locale?: Locale;
}) {
  const [teamCount, setTeamCount] = useState(teams);
  const [countDraft, setCountDraft] = useState<string | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [showPaste, setShowPaste] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const settled = useRef(false);

  const ui = PRINT_I18N[locale] ?? PRINT_I18N.en;

  // The page is prerendered at its own size, so `?teams=` is read after
  // hydration rather than during it: rendering the asked-for size on the first
  // pass would disagree with the HTML the server sent.
  useEffect(() => {
    setTeamCount(sizeFromUrl() ?? teams);
    setNames([]);
    settled.current = false;
  }, [teams]);

  // And written back, so the sheet somebody sized can be sent to somebody
  // else. The page's own size is the bare URL. The first run is skipped: it
  // sees the prerendered size, not the one just read, and would erase it.
  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    const url = new URL(window.location.href);
    if (teamCount === teams) url.searchParams.delete("teams");
    else url.searchParams.set("teams", String(teamCount));
    if (url.href !== window.location.href) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [teamCount, teams]);

  const changeCount = (value: string) => {
    setCountDraft(value);
    const next = Number(value);
    if (Number.isInteger(next) && next >= MIN_TEAMS && next <= MAX_TEAMS) {
      setTeamCount(next);
    }
  };

  const filledCount = names
    .slice(0, teamCount)
    .filter((name) => name?.trim().length > 0).length;

  const effectiveNames = useMemo(
    () =>
      Array.from(
        { length: teamCount },
        (_, i) => (names[i]?.trim() || `${ui.placeholder} ${i + 1}`).slice(0, 40),
      ),
    [teamCount, names, ui.placeholder],
  );

  const withNames = useMemo<PreviewRequest>(() => {
    if (filledCount === 0) {
      return {
        ...request,
        teams: teamCount,
      };
    }
    return {
      ...request,
      teams: teamCount,
      names: effectiveNames,
    };
  }, [request, teamCount, effectiveNames, filledCount]);

  const state = usePreview(withNames);

  const handleNameChange = (index: number, value: string) => {
    setNames((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handlePaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    const text = event.clipboardData.getData("text");
    const parsed = parsePastedTeams(text);
    if (parsed.length > 1) {
      event.preventDefault();
      setNames((current) => {
        const next = [...current];
        for (let i = 0; i < parsed.length && index + i < MAX_TEAMS; i++) {
          next[index + i] = parsed[i].slice(0, 40);
        }
        return next;
      });
      setTeamCount((current) =>
        Math.min(MAX_TEAMS, Math.max(current, index + parsed.length)),
      );
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (index === teamCount - 1 && teamCount < MAX_TEAMS) {
        const nextCount = teamCount + 1;
        setTeamCount(nextCount);
        setTimeout(() => {
          inputRefs.current[nextCount - 1]?.focus();
        }, 0);
      } else if (index < teamCount - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const addTeam = () => {
    if (teamCount >= MAX_TEAMS) return;
    const nextCount = teamCount + 1;
    setTeamCount(nextCount);
    setTimeout(() => {
      inputRefs.current[nextCount - 1]?.focus();
    }, 0);
  };

  const removeTeam = (index: number) => {
    if (teamCount <= MIN_TEAMS) return;
    setNames((current) => {
      const next = [...current];
      next.splice(index, 1);
      return next;
    });
    setTeamCount((current) => Math.max(MIN_TEAMS, current - 1));
  };

  const applyBulkText = () => {
    const parsed = parsePastedTeams(bulkText);
    if (parsed.length > 0) {
      setNames(parsed.slice(0, MAX_TEAMS).map((s) => s.slice(0, 40)));
      setTeamCount(Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, parsed.length)));
      setBulkText("");
      setShowPaste(false);
    }
  };

  return (
    <div className="print-sheet">
      <div className="print-sheet__controls">
        <label className="print-sheet__count">
          <span className="print-sheet__count-label">{ui.teamCount}</span>
          <input
            type="number"
            inputMode="numeric"
            className="wiz__input print-sheet__count-input"
            min={MIN_TEAMS}
            max={MAX_TEAMS}
            value={countDraft ?? String(teamCount)}
            onChange={(event) => changeCount(event.target.value)}
            onBlur={() => setCountDraft(null)}
          />
        </label>

        <h2 className="doc__heading">{ui.putTeamsHeading}</h2>
        <p className="doc__para">{ui.putTeamsPara}</p>

        <ol className="print-sheet__names">
          {Array.from({ length: teamCount }, (_, i) => (
            <li key={i} className="print-sheet__name-item">
              <input
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                className="wiz__input print-sheet__name"
                value={names[i] ?? ""}
                onChange={(event) => handleNameChange(i, event.target.value)}
                onPaste={(event) => handlePaste(event, i)}
                onKeyDown={(event) => handleKeyDown(event, i)}
                placeholder={`${ui.placeholder} ${i + 1}`}
                aria-label={`${ui.placeholder} ${i + 1}`}
                maxLength={40}
                autoComplete="off"
              />
              {teamCount > MIN_TEAMS && (
                <button
                  type="button"
                  className="print-sheet__name-remove"
                  onClick={() => removeTeam(i)}
                  aria-label={`Remove ${ui.placeholder} ${i + 1}`}
                  title={`Remove ${ui.placeholder} ${i + 1}`}
                >
                  &times;
                </button>
              )}
            </li>
          ))}
        </ol>

        <div className="print-sheet__actions">
          <button
            type="button"
            className="btn btn--quiet btn--small"
            onClick={addTeam}
            disabled={teamCount >= MAX_TEAMS}
          >
            {ui.addTeam}
          </button>
          <button
            type="button"
            className="btn btn--quiet btn--small"
            onClick={() => setShowPaste((prev) => !prev)}
          >
            {showPaste ? ui.hidePaste : ui.pasteTeams}
          </button>
          {filledCount > 0 && (
            <button
              type="button"
              className="btn btn--quiet btn--small"
              onClick={() => setNames([])}
            >
              {ui.clearNames}
            </button>
          )}
        </div>

        {showPaste && (
          <div className="print-sheet__paste-box">
            <textarea
              className="wiz__input"
              rows={4}
              placeholder={ui.pastePlaceholder}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <div className="print-sheet__paste-actions">
              <button
                type="button"
                className="btn btn--primary btn--small"
                onClick={applyBulkText}
                disabled={bulkText.trim().length === 0}
              >
                {ui.applyTeams}
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--small"
                onClick={() => setShowPaste(false)}
              >
                {ui.cancel}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => window.print()}
          disabled={state.status !== "ready"}
        >
          {ui.printSheet(teamCount)}
        </button>
      </div>

      {state.status === "loading" && (
        <p className="doc__para print-sheet__status">{ui.drawing}</p>
      )}
      {state.status === "failed" && (
        <p className="doc__para print-sheet__status">
          {ui.failed(state.message)}
        </p>
      )}
      {state.status === "ready" && (
        <Plan plan={state.plan} effectiveNames={effectiveNames} locale={locale} />
      )}
    </div>
  );
}

/**
 * Rounds for a bracket, pools for anything with a table. Which one this is
 * comes from the plan rather than from the page: a pool named "A" is a group
 * whatever format asked for it.
 */
function Plan({
  plan,
  effectiveNames,
  locale = "en",
}: {
  plan: StagePlan;
  effectiveNames: string[];
  locale?: Locale;
}) {
  const slots = useMemo(
    () => new Map(plan.slots.map((slot) => [slot.key, slot])),
    [plan],
  );

  return (
    <div className="print-sheet__paper">
      {plan.pools.map((pool) => {
        const fixtures = plan.fixtures.filter((f) => f.pool_key === pool.key);
        if (fixtures.length === 0) return null;
        return (
          <section className="print-sheet__pool" key={pool.key}>
            {plan.pools.length > 1 && (
              <h3 className="print-sheet__pool-name">{pool.name}</h3>
            )}
            <Rounds
              fixtures={fixtures}
              slots={slots}
              bracket={pool.kind !== "group"}
              effectiveNames={effectiveNames}
              locale={locale}
            />
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
  effectiveNames,
  locale = "en",
}: {
  fixtures: FixtureDraft[];
  slots: Map<string, SlotDraft>;
  bracket: boolean;
  effectiveNames: string[];
  locale?: Locale;
}) {
  const t = (key: MessageKey, vars?: Vars) => translate(locale, key, vars);
  const ui = PRINT_I18N[locale] ?? PRINT_I18N.en;

  const isBye = (key: string) => slots.get(key)?.source_type === "bye";

  const fixtureByKey = useMemo(
    () => new Map(fixtures.map((fixture) => [fixture.key, fixture])),
    [fixtures],
  );

  const rounds = useMemo(() => {
    const byRound = new Map<number, FixtureDraft[]>();
    for (const fixture of fixtures) {
      if (isBye(fixture.home_slot_key) || isBye(fixture.away_slot_key)) continue;
      const list = byRound.get(fixture.round) ?? [];
      list.push(fixture);
      byRound.set(fixture.round, list);
    }
    return [...byRound.entries()].sort(([a], [b]) => a - b);
  }, [fixtures, slots]);

  const side = (key: string): string => {
    const slot = slots.get(key);
    if (!slot) return "TBD";

    // 0. A bye is not on the sheet, so "Winner R161" would point at a match
    // nobody can find. Whoever drew the bye is its winner: name them instead.
    if (slot.source_type === "fixture_winner") {
      const fed = fixtureByKey.get(slot.source_fixture_key);
      if (fed && isBye(fed.home_slot_key) !== isBye(fed.away_slot_key)) {
        return side(isBye(fed.home_slot_key) ? fed.away_slot_key : fed.home_slot_key);
      }
    }

    // 1. If slot has entry ID matching preview{N}
    const previewMatch = slot.entry?.match(/^preview(\d+)$/);
    if (previewMatch) {
      const idx = parseInt(previewMatch[1], 10) - 1;
      if (effectiveNames[idx]) {
        return effectiveNames[idx];
      }
    }

    // 2. If slot has source_position (1-indexed) and is direct
    if (slot.source_type === "direct" && slot.source_position > 0) {
      const idx = slot.source_position - 1;
      if (effectiveNames[idx]) {
        return effectiveNames[idx];
      }
    }

    // 3. If slot label is pool seed like "A1", "A2"
    const poolSeedMatch = slot.label?.match(/^[A-Z](\d+)$/);
    if (poolSeedMatch) {
      const idx = parseInt(poolSeedMatch[1], 10) - 1;
      if (effectiveNames[idx]) {
        return effectiveNames[idx];
      }
    }

    return slot.label ?? "TBD";
  };

  return (
    <>
      {rounds.map(([round, list], index) => (
        <div className="print-sheet__round" key={round}>
          <h4 className="print-sheet__round-name">
            {bracket
              ? roundTitle(t, rounds.length - index)
              : ui.round(round + 1)}
          </h4>
          <table className="print-sheet__table">
            <colgroup>
              <col className="print-sheet__col-code" />
              <col className="print-sheet__col-team" />
              <col className="print-sheet__col-score" />
              <col className="print-sheet__col-score" />
              <col className="print-sheet__col-team" />
              <col className="print-sheet__col-spacer" />
            </colgroup>
            <tbody>
              {list.map((fixture) => (
                <tr key={fixture.key}>
                  <td className="print-sheet__code">{fixture.code}</td>
                  <td className="print-sheet__team">{side(fixture.home_slot_key)}</td>
                  <td className="print-sheet__score" />
                  <td className="print-sheet__score" />
                  <td className="print-sheet__team print-sheet__team--away">
                    {side(fixture.away_slot_key)}
                  </td>
                  <td className="print-sheet__spacer" aria-hidden="true" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
