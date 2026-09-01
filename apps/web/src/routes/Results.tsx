import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ensureOrganiser,
  ensureInvite,
  loadBoard,
  rememberTournament,
  reinstateEntry,
  removeStaff,
  statusAfterClearing,
  storedSession,
  resetInvite,
  updateDisplay,
  updateScoring,
  withdrawEntry,
  type Board,
  type Session,
  type StaffRecord,
} from "../api/organiser";
import { readBoard, writeBoard } from "../api/cache";
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

/**
 * Running the day: the list of matches, and a score for each.
 *
 * Everything downstream of a result — the winner, the bracket, the tables, the
 * playoff slots waiting on a final position — is the server's job. This screen
 * writes one fixture and reads the whole board back, rather than trying to
 * predict what a result changed. One result can move four tables and fill two
 * slots two stages away; a client that guessed at that would be wrong in ways
 * nobody could see until the projector disagreed with the hall.
 *
 * ## What happens when the hall has no signal
 *
 * The reading and the writing are decoupled from the network separately, and
 * neither of them changes the rule above.
 *
 * Reading: the last board is kept on the device (`api/cache.ts`) and drawn
 * immediately, then replaced by whatever the server says. A reload mid-outage
 * is a match list, not a spinner and an error.
 *
 * Writing: a tap goes into a queue (`api/outbox.ts`) that is durable before
 * the sheet closes, and the queue is sent whenever there is a signal. What is
 * on screen is the server's board with the queue laid over it — so the match
 * shows its score straight away, and the bracket it feeds does not move until
 * the server has actually been told. Those are the honest two halves of
 * working offline, and pretending otherwise is how a projector ends up
 * disagreeing with the hall.
 *
 * Only the match sheet's writes are queued. Taking a team out, handing out a
 * join code and the settings sheets all still need a signal, because each of
 * them means something the device cannot work out on its own.
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
  /** The board on screen is the cached one, and the server has not answered. */
  const [stale, setStale] = useState(false);

  const session = useRef<Promise<Session> | null>(null);
  const getSession = () => (session.current ??= ensureOrganiser());

  const queue = useSyncExternalStore(subscribe, getSnapshot);
  /**
   * The queue is global — a device could in principle be holding work for two
   * tournaments — but this screen is about one, so the entries it draws and
   * the number it reports are filtered to it.
   */
  const held = queue.entries.filter((entry) => entry.tournament === id);
  const waiting = held.filter((entry) => entry.state === "queued").length;
  const refused = queue.rejections.filter((one) => one.tournament === id);

  const refresh = useCallback(async () => {
    // Taken before the load, not after: an entry sent while this is in flight
    // may not be in the response, and dropping it here is the one-render blink
    // the `sent` state exists to prevent.
    const accounted = sentSoFar();
    try {
      const loaded = await loadBoard(await getSession(), id);
      setBoard(loaded);
      setError(null);
      setStale(false);
      writeBoard(id, loaded);
      acknowledge(accounted);
      // Keeps the landing page's way back pointing at the tournament actually
      // being run, including on a device that signed in rather than creating
      // it here — which is also where the screen token comes from now.
      rememberTournament({
        id: loaded.tournament.id,
        name: loaded.tournament.name,
        token: loaded.token,
      });
    } catch (thrown) {
      // A 404 is an answer: this device cannot manage this tournament, and no
      // amount of cache makes that untrue. Anything else is a phone in a hall,
      // and whatever is already on screen is better than an error page.
      const missing = thrown instanceof Error && thrown.message.includes("404");
      if (missing) {
        setBoard(null);
        setError("This tournament cannot be managed from this device.");
      } else {
        // Not an error the organiser has to dismiss — the board is on screen
        // and the queue is holding their work. The stale pill says the rest.
        setStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  /**
   * The cache first, then the server.
   *
   * Not a race — the cached board is only put up if the network has not
   * already answered, so a device with signal never sees the old one flash
   * past. `cancelled` covers the tournament being switched underneath.
   */
  useEffect(() => {
    let cancelled = false;

    void readBoard(id).then((cached) => {
      if (cancelled || !cached) return;
      setBoard((live) => live ?? cached);
      setLoading(false);
    });

    void refresh();
    // A queue left over from the last time this device was open — the tab was
    // closed in a hall with no signal and reopened in the car park. Nothing
    // else would try it until the organiser entered another result.
    void flush();

    return () => {
      cancelled = true;
    };
  }, [id, refresh]);

  /**
   * Read the board back once the queue has drained.
   *
   * The server derives everything a result implies, so the only way to find
   * out what one changed is to ask. Waiting for the whole queue rather than
   * refreshing per write means one reload after a burst of six results comes
   * in off a recovered signal, not six.
   */
  const sending = queue.sending;
  const outstanding = held.length;
  useEffect(() => {
    if (!sending && waiting === 0 && outstanding > 0) void refresh();
  }, [sending, waiting, outstanding, refresh]);

  if (loading) return <p className="results__message">Loading…</p>;
  if (!board) return <p className="results__message">{error ?? "Nothing here."}</p>;

  const entries = new Map(board.entries.map((entry) => [entry.id, entry]));
  /**
   * What the server last said, plus what this device has done since.
   *
   * Every count on this screen is built from these rather than from
   * `board.fixtures`, so "14 of 20 matches in" includes the two still sitting
   * in the queue. A progress bar that ignores the results an organiser just
   * entered is a progress bar they stop believing.
   */
  const fixtures = overlay(board.fixtures, held);
  const unsent = waitingFixtures(held);
  const rows = fixtures.map((fixture) => toRow(fixture, entries));
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
   * The writes that are not queued: send it, read the whole board back, and
   * only then decide whether the sheet should close.
   *
   * Taking a team out and putting one back go through here rather than the
   * outbox on purpose. Both are one server call that closes fixtures and
   * retallies every stage in a transaction, and both change who gets drawn
   * into the next round — a withdrawal held in a queue for ten minutes is a
   * Swiss round paired around somebody who has already gone home. Failing
   * loudly while there is no signal is the right answer for those; the
   * organiser can do it again in a minute, and nothing is wrong in between.
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
   * The match sheet's writes: recorded here, sent when there is a signal.
   *
   * There is no `await` and no spinner. The queue is durable before this
   * returns, the overlay puts the result on the list in the same render, and
   * the sheet closes on the tap rather than on a round trip — which is the
   * behaviour a person standing at the side of a court was always owed, and
   * happens to be the only behaviour available when the wifi has gone.
   *
   * A refusal comes back through the queue's rejections rather than from here,
   * because by the time the server has one the organiser is two matches away.
   */
  const record = (intent: Intent, close: boolean) => {
    setError(null);
    enqueue(id, intent);
    if (close) setSelected(null);
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

      {/*
        What the queue is doing, in the one place an organiser will look.

        The failure this exists for is not the outage — it is a person who
        cannot tell whether their tap landed, entering the same result twice
        and arguing with the wall about it. So the count is always visible
        while anything is held, and it says which state it is in: trying, or
        waiting for a signal that is not there. "Send now" is there for the
        moment somebody walks to the door and wants to push rather than wait.
      */}
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
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : null}

      {/*
        A refusal, which is a different thing from an outage and has to read
        like one. The server will not store a level score in a knockout, or in
        a tournament whose scoring says draws are not a result — the queue
        drops those rather than retrying forever, and this is where they land.
      */}
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

      <StageProgress stages={board.stages} pools={board.pools} fixtures={fixtures} />

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
          allFixtures={fixtures}
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
                // Decided against the board the organiser is looking at, not
                // the one the queue drains into an hour later.
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
                // Built key by key rather than spread: an absent key means
                // "leave it alone" when two of these are merged in the queue,
                // and a key present-but-undefined would read as "unset it".
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
