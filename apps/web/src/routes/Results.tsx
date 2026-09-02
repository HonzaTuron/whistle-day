import { Link } from "@tanstack/react-router";
import { useRef, useState, useSyncExternalStore } from "react";
import {
  ensureOrganiser,
  ensureInvite,
  rememberTournament,
  removeStaff,
  resetInvite,
  reinstateEntry,
  statusAfterClearing,
  storedSession,
  updateDisplay,
  updateScoring,
  withdrawEntry,
  type Board,
  type Session,
  type StaffRecord,
} from "../api/organiser";
import { readBoard, writeBoard } from "../api/cache";
import { useBoard } from "../api/hooks";
import {
  acknowledge,
  dismissRejections,
  enqueue,
  flush,
  getSnapshot,
  sentSoFar,
  subscribe,
} from "../api/outbox";
import { overlay, waitingFixtures, type Intent } from "../lib/pending";
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

export function Results({ id }: { id: string }) {
  const [tab, setTab] = useState<Tab>("todo");
  const [selected, setSelected] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [crew, setCrew] = useState(false);
  const [roster, setRoster] = useState(false);
  const [invite, setInvite] = useState<{ role: StaffRole; url: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [screenState, setScreenState] = useState<"idle" | "saving" | "failed">("idle");
  const [scoringState, setScoringState] = useState<"idle" | "saving" | "failed">("idle");

  const session = useRef<Promise<Session> | null>(null);
  const getSession = () => (session.current ??= ensureOrganiser());

  const queue = useSyncExternalStore(subscribe, getSnapshot);
  const held = queue.entries.filter((entry) => entry.tournament === id);
  const waiting = held.filter((entry) => entry.state === "queued").length;
  const refused = queue.rejections.filter((one) => one.tournament === id);

  const {
    data: board,
    isLoading,
    error: queryError,
    refetch,
  } = useBoard(id);

  // Cache-first: hydrate from IndexedDB while the query loads
  const [cachedBoard, setCachedBoard] = useState<Board | null>(null);
  const [cachedLoading, setCachedLoading] = useState(true);
  const hydrated = useRef(false);

  if (!hydrated.current && !board) {
    hydrated.current = true;
    void readBoard(id).then((cached) => {
      if (cached && !board) {
        setCachedBoard(cached);
        setCachedLoading(false);
      }
    });
  }

  const displayBoard = board ?? cachedBoard;
  const loading = isLoading && cachedLoading && !cachedBoard;
  const stale = !board && !!cachedBoard;

  // Write the board to IndexedDB whenever it loads fresh from the server
  const prevBoardId = useRef<string | undefined>(undefined);
  if (board && board.tournament.id !== prevBoardId.current) {
    prevBoardId.current = board.tournament.id;
    writeBoard(id, board);
    acknowledge(sentSoFar());
    rememberTournament({
      id: board.tournament.id,
      name: board.tournament.name,
      token: board.token,
    });
  }

  // Refresh the board once the queue has drained
  const sending = queue.sending;
  const outstanding = held.length;
  const prevSending = useRef(sending);
  if (prevSending.current && !sending && waiting === 0 && outstanding > 0) {
    prevSending.current = sending;
    void refetch();
  } else {
    prevSending.current = sending;
  }

  const write = async (work: (active: Session) => Promise<unknown>, close: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await work(await getSession());
      await refetch();
      if (close) setSelected(null);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  const record = (intent: Intent, close: boolean) => {
    setError(null);
    enqueue(id, intent);
    if (close) setSelected(null);
  };

  const writeScreen = async (patch: Partial<Display>) => {
    const screen = displayBoard?.screen;
    if (!screen) return;
    setScreenState("saving");
    try {
      await updateDisplay(await getSession(), screen.id, patch);
      setScreenState("idle");
      void refetch();
    } catch {
      setScreenState("failed");
      void refetch();
    }
  };

  const writeScoring = async (next: ScoringConfig, sport: string) => {
    setScoringState("saving");
    try {
      await updateScoring(await getSession(), id, next, sport);
      setScoringState("idle");
      void refetch();
    } catch {
      setScoringState("failed");
      void refetch();
    }
  };

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
      setError(thrown instanceof Error ? thrown.message : "Could not make a join code.");
    } finally {
      setInviting(false);
    }
  };

  const dropStaff = (member: StaffRecord) =>
    void write((active) => removeStaff(active, member.id), false);

  if (loading) return <p className="results__message">Loading…</p>;
  if (!displayBoard) return <p className="results__message">{queryError?.message ?? "Nothing here."}</p>;

  const entries = new Map(displayBoard.entries.map((entry) => [entry.id, entry]));
  const fixtures = overlay(displayBoard.fixtures, held);
  const unsent = waitingFixtures(held);
  const rows = fixtures.map((fixture) => toRow(fixture, entries));
  const done = progress(rows);
  const visible = rows.filter((row) =>
    tab === "done" ? row.settled || row.cancelled : !row.settled && !row.cancelled,
  );
  const open = selected ? rows.find((row) => row.fixture.id === selected) ?? null : null;
  const token = displayBoard.token;
  const isOwner = displayBoard.tournament.owner === storedSession()?.userId;

  const crewNames = new Map<string, string>([
    [displayBoard.tournament.owner, "Organiser"],
    ...displayBoard.staff.map((member) => [member.user, member.name || "Someone"] as const),
  ]);

  const remaining = new Map<string, number>();
  for (const team of displayBoard.entries) remaining.set(team.id, 0);
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
          <h1>{displayBoard.tournament.name}</h1>
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
          {token && displayBoard.screen ? (
            <button
              type="button"
              className="results__screen results__screen--settings"
              onClick={() => setSettings(true)}
            >
              Set up
            </button>
          ) : null}
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
              Crew {displayBoard.staff.length > 0 ? `· ${displayBoard.staff.length}` : ""}
            </button>
          ) : null}
        </div>
      </header>

      {waiting > 0 ? (
        <div
          className={"results__queue" + (queue.offline ? " is-offline" : "")}
          role="status"
        >
          <span>
            {waiting === 1 ? "1 result" : `${waiting} results`}{" "}
            {sending
              ? "sending…"
              : queue.offline
                ? "waiting for a signal"
                : "waiting to send"}
          </span>
          {!sending ? (
            <button type="button" onClick={() => void flush()}>
              Send now
            </button>
          ) : null}
        </div>
      ) : stale ? (
        <div className="results__queue" role="status">
          <span>Showing the last board this phone saw.</span>
          <button type="button" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      {refused.length > 0 ? (
        <div className="wiz__error" role="alert">
          <span>
            {refused.length === 1
              ? refused[0]!.message
              : `${refused.length} results were refused: ` +
                refused.map((one) => one.message).join("; ")}
          </span>
          <button type="button" onClick={dismissRejections} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ) : null}

      <StageProgress stages={displayBoard.stages} pools={displayBoard.pools} fixtures={fixtures} />

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
          sections(displayBoard, visible).map((section) => (
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
                    courts={displayBoard.courts}
                    unsent={unsent.has(row.fixture.id)}
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
          teams={displayBoard.entries}
          remaining={remaining}
          busy={saving}
          onWithdraw={takeOut}
          onReinstate={putBack}
          onClose={() => setRoster(false)}
        />
      ) : null}

      {crew ? (
        <CrewSheet
          crew={displayBoard.staff}
          link={invite}
          busy={inviting}
          onRole={(role) => void showInvite(role, false)}
          onReset={() => invite && void showInvite(invite.role, true)}
          onRemove={dropStaff}
          onClose={() => setCrew(false)}
        />
      ) : null}

      {settings && displayBoard.screen ? (
        <ScreenSheet
          screen={displayBoard.screen}
          stages={displayBoard.stages}
          pools={displayBoard.pools}
          courts={displayBoard.courts}
          state={screenState}
          onChange={(patch) => void writeScreen(patch)}
          onClose={() => setSettings(false)}
        />
      ) : null}

      {scoring ? (
        <ScoringSheet
          sport={displayBoard.tournament.sport}
          scoring={displayBoard.tournament.scoring}
          state={scoringState}
          onChange={(next, sport) => void writeScoring(next, sport)}
          onClose={() => setScoring(false)}
        />
      ) : null}

      {open ? (
        <MatchSheet
          row={open}
          courts={displayBoard.courts}
          allFixtures={fixtures}
          entries={entries}
          crew={crewNames}
          saving={saving}
          onSave={(home, away, sets) =>
            record({ kind: "result", fixture: open.fixture.id, home, away, sets }, true)
          }
          onWalkover={(winner) =>
            record({ kind: "walkover", fixture: open.fixture.id, winner }, true)
          }
          onClear={() =>
            record(
              {
                kind: "clear",
                fixture: open.fixture.id,
                status: statusAfterClearing(open.fixture),
              },
              true,
            )
          }
          onSchedule={(schedule) =>
            record(
              {
                kind: "schedule",
                fixture: open.fixture.id,
                ...(schedule.court === undefined ? {} : { court: schedule.court }),
                ...(schedule.scheduled_at === undefined
                  ? {}
                  : { scheduled_at: schedule.scheduled_at }),
              },
              false,
            )
          }
          onLive={(live) =>
            record({ kind: "live", fixture: open.fixture.id, live }, false)
          }
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
