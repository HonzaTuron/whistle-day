import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureOrganiser,
  loadBoard,
  rememberedTournament,
  rememberTournament,
  saveResult,
  type Board,
  type Session,
} from "../api/organiser";
import { FixtureRow } from "../components/results/FixtureRow";
import { ScoreSheet } from "../components/results/ScoreSheet";
import { progress, sections, toRow, type BoardRow } from "../lib/board";

type Tab = "todo" | "done";

/**
 * Running the day: the list of matches, and a score for each.
 *
 * Everything downstream of a result — the winner, the bracket, the tables, the
 * playoff slots waiting on a final position — is the server's job. This screen
 * writes one fixture and reads the whole board back, rather than trying to
 * predict what a result changed. One result can move four tables and fill two
 * slots two stages away; a client that guessed at that would be wrong in ways
 * nobody could see until the projector disagreed with the hall.
 */
export function Results({ id }: { id: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [tab, setTab] = useState<Tab>("todo");
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const session = useRef<Promise<Session> | null>(null);
  const getSession = () => (session.current ??= ensureOrganiser());

  const refresh = useCallback(async () => {
    try {
      const loaded = await loadBoard(await getSession(), id);
      setBoard(loaded);
      setError(null);
      // Keeps the landing page's way back pointing at the tournament actually
      // being run, including on a device that opened the link rather than
      // creating it here.
      const remembered = rememberedTournament();
      rememberTournament({
        id: loaded.tournament.id,
        name: loaded.tournament.name,
        token: remembered?.id === id ? remembered.token : "",
      });
    } catch (thrown) {
      setError(
        thrown instanceof Error && thrown.message.includes("404")
          ? "This tournament cannot be managed from this device."
          : thrown instanceof Error
            ? thrown.message
            : "Could not load the tournament.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <p className="results__message">Loading…</p>;
  if (!board) return <p className="results__message">{error ?? "Nothing here."}</p>;

  const entries = new Map(board.entries.map((entry) => [entry.id, entry]));
  const rows = board.fixtures.map((fixture) => toRow(fixture, entries));
  const done = progress(rows);
  const visible = rows.filter((row) => (tab === "done" ? row.settled : !row.settled));
  const open = selected ? rows.find((row) => row.fixture.id === selected) ?? null : null;
  const token = rememberedTournament()?.token ?? "";

  const save = async (row: BoardRow, home: number, away: number) => {
    setSaving(true);
    setError(null);
    try {
      await saveResult(await getSession(), row.fixture.id, home, away);
      await refresh();
      setSelected(null);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : "Could not save the result.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="results">
      {error ? (
        <div className="wiz__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ) : null}

      <header className="results__head">
        <div>
          <h1>{board.tournament.name}</h1>
          <p>
            {done.played} of {done.total} matches in
          </p>
        </div>
        {token ? (
          <Link to="/display/$token" params={{ token }} className="results__screen">
            Screen
          </Link>
        ) : null}
      </header>

      <nav className="results__tabs">
        <button
          type="button"
          className={"results__tab" + (tab === "todo" ? " is-active" : "")}
          onClick={() => setTab("todo")}
        >
          To play {done.total - done.played > 0 ? `· ${done.total - done.played}` : ""}
        </button>
        <button
          type="button"
          className={"results__tab" + (tab === "done" ? " is-active" : "")}
          onClick={() => setTab("done")}
        >
          Played {done.played > 0 ? `· ${done.played}` : ""}
        </button>
      </nav>

      <main className="results__body">
        {visible.length === 0 ? (
          <p className="results__empty">
            {tab === "todo"
              ? "Every match is in."
              : "No results yet — the first one goes in from To play."}
          </p>
        ) : (
          sections(board, visible).map((section) => (
            <section key={section.key} className="results__section">
              <h2>
                {section.stage}
                {section.pool ? <small>{section.pool}</small> : null}
              </h2>
              <div className="matches">
                {section.rows.map((row) => (
                  <FixtureRow
                    key={row.fixture.id}
                    row={row}
                    onOpen={() => setSelected(row.fixture.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {open ? (
        <ScoreSheet
          row={open}
          saving={saving}
          onSave={(home, away) => void save(open, home, away)}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
