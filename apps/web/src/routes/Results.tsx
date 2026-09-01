import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureOrganiser,
  clearResult,
  ensureInvite,
  loadBoard,
  rememberedTournament,
  rememberTournament,
  saveGames,
  saveResult,
  saveWalkover,
  setLive,
  setSchedule,
  reinstateEntry,
  removeStaff,
  storedSession,
  resetInvite,
  updateDisplay,
  updateScoring,
  withdrawEntry,
  type Board,
  type Session,
  type StaffRecord,
} from "../api/organiser";
import type { Display, Entry, ScoringConfig, StaffRole } from "@seedly/engine";
import { CrewSheet } from "../components/results/CrewSheet";
import { FixtureRow } from "../components/results/FixtureRow";
import { TeamsSheet } from "../components/results/TeamsSheet";
import { MatchSheet } from "../components/results/MatchSheet";
import { ScoringSheet } from "../components/results/ScoringSheet";
import { ScreenSheet } from "../components/results/ScreenSheet";
import { StageProgress } from "../components/results/StageProgress";
import { progress, sections, toRow } from "../lib/board";

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
  const [settings, setSettings] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [crew, setCrew] = useState(false);
  const [roster, setRoster] = useState(false);
  const [invite, setInvite] = useState<{ role: StaffRole; url: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [screenState, setScreenState] = useState<"idle" | "saving" | "failed">(
    "idle",
  );
  const [scoringState, setScoringState] = useState<"idle" | "saving" | "failed">(
    "idle",
  );
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
      // being run, including on a device that signed in rather than creating
      // it here — which is also where the screen token comes from now.
      rememberTournament({
        id: loaded.tournament.id,
        name: loaded.tournament.name,
        token: loaded.token,
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
  // A cancelled match belongs in neither tab's headline but has to stay
  // findable, so it sits with the settled ones — an organiser who took a team
  // out and wants to see what that did to the day should not have to guess.
  const visible = rows.filter((row) =>
    tab === "done" ? row.settled || row.cancelled : !row.settled && !row.cancelled,
  );
  const open = selected ? rows.find((row) => row.fixture.id === selected) ?? null : null;
  const token = board.token;
  // Read rather than awaited: the board has already loaded, so the session it
  // loaded with is on the device by now.
  const isOwner = board.tournament.owner === storedSession()?.userId;

  /**
   * Who wrote what, for the match history.
   *
   * The owner is in here under a generic label rather than a name: they never
   * scanned a join code, so nobody ever typed one for them, and their account
   * is only visible to itself. That is enough — the question the history
   * answers is "was this me or was this somebody else", and one named side is
   * all that takes. A map of one means a one-phone day, and the history draws
   * no names at all.
   */
  const crewNames = new Map<string, string>([
    [board.tournament.owner, "Organiser"],
    ...board.staff.map((member) => [member.user, member.name || "Someone"] as const),
  ]);

  /**
   * Setting the screen up is the one write that does not read the board back.
   *
   * Nothing else on this page renders the display record, and the round trip
   * is what made the rotation flinch: the sheet would fall back to the order
   * the board still held, then jump forward again when the reload landed — a
   * blink on every drag. The new value is put on the board as it is sent, and
   * only a failure goes to the server to find out what is actually there.
   */
  const writeScreen = async (patch: Partial<Display>) => {
    const screen = board.screen;
    if (!screen) return;

    setBoard((prev) =>
      prev?.screen ? { ...prev, screen: { ...prev.screen, ...patch } } : prev,
    );
    setScreenState("saving");

    try {
      await updateDisplay(await getSession(), screen.id, patch);
      setScreenState("idle");
    } catch {
      setScreenState("failed");
      await refresh();
    }
  };

  /**
   * Scoring saves the way the screen does, and for the same reason: the sheet
   * is the only thing rendering it, and a round trip between a tap and the
   * chip lighting up is a chip that flickers back to what it was.
   *
   * No stage is re-tallied here. `standings` is rebuilt when a result lands,
   * so a table already on the wall keeps the points it was built with until
   * the next fixture in its pool is settled — which the sheet says in as many
   * words, because firing a resolve of every stage off a settings tap is a far
   * larger write than the one anybody asked for.
   */
  const writeScoring = async (next: ScoringConfig, sport: string) => {
    setBoard((prev) =>
      prev
        ? { ...prev, tournament: { ...prev.tournament, scoring: next, sport } }
        : prev,
    );
    setScoringState("saving");

    try {
      await updateScoring(await getSession(), id, next, sport);
      setScoringState("idle");
    } catch {
      setScoringState("failed");
      await refresh();
    }
  };

  /**
   * Every other write goes the same way: send it, read the whole board back,
   * and only then decide whether the sheet should close. `close` is what
   * separates recording a result from putting a match on a court — one ends
   * the interaction, the other is in the middle of it.
   */
  const write = async (
    work: (active: Session) => Promise<unknown>,
    close: boolean,
  ) => {
    setSaving(true);
    setError(null);
    try {
      await work(await getSession());
      await refresh();
      if (close) setSelected(null);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * The join code for one role, minted the first time it is asked for.
   *
   * The sheet asks for a role and gets a code back, rather than the whole set
   * up front: a tournament nobody delegates should not be carrying three live
   * tokens that were never shown to anyone.
   */
  const showInvite = async (role: StaffRole, fresh: boolean) => {
    setInviting(true);
    setError(null);
    try {
      const active = await getSession();
      const record = fresh
        ? await resetInvite(active, id, role)
        : await ensureInvite(active, id, role);
      setInvite({ role, url: `${window.location.origin}/join/${record.token}` });
    } catch (thrown) {
      setError(
        thrown instanceof Error ? thrown.message : "Could not make a join code.",
      );
    } finally {
      setInviting(false);
    }
  };

  const dropStaff = (member: StaffRecord) =>
    void write((active) => removeStaff(active, member.id), false);

  /**
   * How many matches each team still has to play, which is the number that
   * makes the choice concrete: "they have four left" is what tells an
   * organiser whether this is a formality or a decision.
   */
  const remaining = new Map<string, number>();
  for (const team of board.entries) remaining.set(team.id, 0);
  for (const row of rows) {
    if (row.settled) continue;
    for (const side of [row.fixture.home_entry, row.fixture.away_entry]) {
      if (side && remaining.has(side)) remaining.set(side, remaining.get(side)! + 1);
    }
  }

  const takeOut = (team: Entry, policy: "forfeit" | "void") =>
    void write((active) => withdrawEntry(active, team.id, policy), false);

  const putBack = (team: Entry) =>
    void write((active) => reinstateEntry(active, team.id), false);

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
        <div className="results__screens">
          {token ? (
            <Link to="/display/$token" params={{ token }} className="results__screen">
              Screen
            </Link>
          ) : null}
          {token && board.screen ? (
            <button
              type="button"
              className="results__screen results__screen--settings"
              onClick={() => setSettings(true)}
            >
              Set up
            </button>
          ) : null}
          {/*
            Handing out access is the owner's alone — `invites.createRule` is
            owner-only on the server, so offering the button to a referee would
            be offering them a request that comes back 403.
          */}
          <button
            type="button"
            className="results__screen results__screen--settings"
            onClick={() => setRoster(true)}
          >
            Teams
          </button>
          <button
            type="button"
            className="results__screen results__screen--settings"
            onClick={() => setScoring(true)}
          >
            Scoring
          </button>
          {isOwner ? (
            <button
              type="button"
              className="results__screen results__screen--settings"
              onClick={() => setCrew(true)}
            >
              Crew {board.staff.length > 0 ? `· ${board.staff.length}` : ""}
            </button>
          ) : null}
        </div>
      </header>

      <StageProgress stages={board.stages} pools={board.pools} fixtures={board.fixtures} />

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
                    courts={board.courts}
                    onOpen={() => setSelected(row.fixture.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {roster ? (
        <TeamsSheet
          teams={board.entries}
          remaining={remaining}
          busy={saving}
          onWithdraw={takeOut}
          onReinstate={putBack}
          onClose={() => setRoster(false)}
        />
      ) : null}

      {crew ? (
        <CrewSheet
          crew={board.staff}
          link={invite}
          busy={inviting}
          onRole={(role) => void showInvite(role, false)}
          onReset={() => invite && void showInvite(invite.role, true)}
          onRemove={dropStaff}
          onClose={() => setCrew(false)}
        />
      ) : null}

      {settings && board.screen ? (
        <ScreenSheet
          screen={board.screen}
          stages={board.stages}
          pools={board.pools}
          courts={board.courts}
          state={screenState}
          onChange={(patch) => void writeScreen(patch)}
          onClose={() => setSettings(false)}
        />
      ) : null}

      {scoring ? (
        <ScoringSheet
          sport={board.tournament.sport}
          scoring={board.tournament.scoring}
          state={scoringState}
          onChange={(next, sport) => void writeScoring(next, sport)}
          onClose={() => setScoring(false)}
        />
      ) : null}

      {open ? (
        <MatchSheet
          row={open}
          courts={board.courts}
          allFixtures={board.fixtures}
          entries={entries}
          crew={crewNames}
          saving={saving}
          /**
           * Points first, then the result. Both orders save the same rows, but
           * the fixture write is the one that rebuilds the tables, and it
           * should be the last thing the server sees — otherwise the tiebreak
           * is computed from the sets as they were a request ago.
           *
           * A result that goes away takes its points with it, on both paths: a
           * cleared match whose sets were left behind would still be feeding
           * sub_for and sub_against to a table it is no longer part of.
           */
          onSave={(home, away, sets) =>
            void write(async (active) => {
              await saveGames(active, open.fixture.id, sets, true);
              await saveResult(active, open.fixture.id, home, away);
            }, true)
          }
          onWalkover={(winner) =>
            void write(async (active) => {
              await saveGames(active, open.fixture.id, [], true);
              await saveWalkover(active, open.fixture.id, winner);
            }, true)
          }
          onClear={() =>
            void write(async (active) => {
              await saveGames(active, open.fixture.id, [], false);
              await clearResult(active, open.fixture);
            }, true)
          }
          onSchedule={(schedule) =>
            void write(
              (active) => setSchedule(active, open.fixture.id, schedule),
              false,
            )
          }
          onLive={(live) =>
            void write((active) => setLive(active, open.fixture.id, live), false)
          }
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
