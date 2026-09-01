import { useEffect, useRef, useState } from "react";
import {
  launchTournament,
  type LaunchResult,
  type LaunchStep,
} from "../api/launch";
import {
  addCourt,
  addTeam,
  createDraft,
  deleteDraft,
  ensureOrganiser,
  forgetDraft,
  loadCourts,
  loadTournament,
  loadTeams,
  rememberedDraft,
  removeCourt,
  removeTeam,
  renameCourt,
  renameDraft,
  type CourtRecord,
  type TournamentRecord,
  type Session,
  type TeamRecord,
} from "../api/organiser";
import { CourtsStep } from "../components/create/CourtsStep";
import { DoneStep } from "../components/create/DoneStep";
import { FormatStep } from "../components/create/FormatStep";
import { NameStep } from "../components/create/NameStep";
import { TeamsStep } from "../components/create/TeamsStep";
import { defaultPreset, type PresetId } from "../lib/presets";
import {
  DEFAULT_SPORT,
  matchSport,
  sportById,
  type SportId,
} from "../lib/scoring";

type Step = "name" | "teams" | "courts" | "format" | "done";

interface Resumable {
  tournament: TournamentRecord;
  teams: TeamRecord[];
  courts: CourtRecord[];
}

/**
 * Setting up a tournament, start to finish, on the phone in the organiser's
 * hand.
 *
 * The wizard writes as it goes rather than collecting everything and saving at
 * the end. Teams are the reason: twenty names typed into a tab that a locked
 * screen or an incoming call can discard is a betrayal that only shows up at
 * the worst moment. The tournament record exists from the second screen
 * onwards, as a draft — and a draft is invisible to `GET /api/display/{token}`,
 * so nothing half-built can reach a projector.
 *
 * That in turn is why leaving and coming back works: the draft id is on the
 * device, so the first screen can offer to pick it up.
 */
export function Create() {
  const [step, setStep] = useState<Step>("name");
  const [tournament, setTournament] = useState<TournamentRecord | null>(null);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [courts, setCourts] = useState<CourtRecord[]>([]);
  const [preset, setPreset] = useState<PresetId>("groups");
  const [sport, setSport] = useState<SportId>(DEFAULT_SPORT);
  const [resumable, setResumable] = useState<Resumable | null>(null);
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState<LaunchStep | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * The account is created in the background while the first name is being
   * typed. It costs two requests and it is never the thing anyone is waiting
   * for — by the time "Add the teams" is tapped, it has long since finished.
   */
  const session = useRef<Promise<Session> | null>(null);
  const getSession = () => (session.current ??= ensureOrganiser());

  /**
   * Seeds count up from here rather than from the length of the list, for two
   * reasons: removing the third team of five must not hand its number to the
   * sixth, and two teams typed while the first request is still in flight must
   * not both read the same "next" number off state that has not updated yet.
   */
  const nextSeed = useRef(1);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const active = await getSession();
        const draftId = rememberedDraft();
        if (!draftId || cancelled) return;

        const draft = await loadTournament(active, draftId);
        // A tournament that has already started is not a draft to resume; it
        // is somebody's live event and the wizard has no business in it.
        if (draft.status !== "draft") {
          forgetDraft();
          return;
        }

        const [draftTeams, draftCourts] = await Promise.all([
          loadTeams(active, draft.id),
          loadCourts(active, draft.id),
        ]);
        if (!cancelled) {
          setResumable({ tournament: draft, teams: draftTeams, courts: draftCourts });
        }
      } catch {
        // A draft that cannot be read — a wiped database, a revoked account —
        // is not worth an error on a screen whose job is to start a new one.
        forgetDraft();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const report = (thrown: unknown) =>
    setError(thrown instanceof Error ? thrown.message : "Something went wrong.");

  /** Every write goes through here: one busy flag, one error surface. */
  async function run<T>(work: (active: Session) => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await work(await getSession());
    } catch (thrown) {
      report(thrown);
      return null;
    } finally {
      setBusy(false);
    }
  }

  // --- steps ---------------------------------------------------------------

  const submitName = (name: string) =>
    void run(async (active) => {
      if (tournament) {
        // Coming back from a later step to fix a typo — or to correct the
        // sport, which is the same trip and has to land the same way.
        const picked = sportById(sport);
        setTournament(
          await renameDraft(active, tournament.id, name, picked.sport, picked.scoring),
        );
      } else {
        // Starting fresh with an abandoned draft still around: it was going to
        // be offered on this screen and was not taken, so it goes.
        if (resumable) {
          await deleteDraft(active, resumable.tournament.id).catch(() => undefined);
          setResumable(null);
        }
        setTournament(await createDraft(active, name, sport));
      }
      setStep("teams");
    });

  const pickUpDraft = () => {
    if (!resumable) return;
    setTournament(resumable.tournament);
    setTeams(resumable.teams);
    setCourts(resumable.courts);
    // A resumed draft was already scored as something. The chip follows the
    // record rather than the record following the chip, or picking a draft up
    // would silently re-score it as whatever this screen happened to show.
    setSport(
      matchSport(resumable.tournament.sport, resumable.tournament.scoring) ?? DEFAULT_SPORT,
    );
    nextSeed.current =
      resumable.teams.reduce((highest, team) => Math.max(highest, team.seed), 0) + 1;
    setResumable(null);
    setStep("teams");
  };

  const discardDraft = () =>
    void run(async (active) => {
      if (!resumable) return;
      await deleteDraft(active, resumable.tournament.id).catch(() => undefined);
      forgetDraft();
      setResumable(null);
    });

  /**
   * Adding a team deliberately does NOT raise the busy flag: the whole point
   * of the step is that names can be typed as fast as they can be read out,
   * and a disabled button between each one would put the network in the way of
   * that.
   */
  const addTeamToDraft = async (name: string, shortName: string) => {
    if (!tournament) return false;
    const seed = nextSeed.current++;
    try {
      const added = await addTeam(await getSession(), tournament.id, {
        name,
        shortName,
        seed,
      });
      setTeams((current) => [...current, added]);
      return true;
    } catch (thrown) {
      nextSeed.current = seed; // nothing was written; give the number back
      report(thrown);
      return false;
    }
  };

  const removeTeamFromDraft = (id: string) => {
    const previous = teams;
    setTeams((current) => current.filter((team) => team.id !== id));
    void run((active) => removeTeam(active, id)).then((ok) => {
      if (ok === null) setTeams(previous); // put it back; the server still has it
    });
  };

  const submitCourts = (names: string[]) =>
    void run(async (active) => {
      if (!tournament) return;

      // Deletions go first: court names are unique per tournament, so dropping
      // "Court 3" before renaming anything keeps the obvious edits clear of
      // each other.
      for (const stale of courts.slice(names.length)) {
        await removeCourt(active, stale.id);
      }

      const saved: CourtRecord[] = [];
      for (const [position, name] of names.entries()) {
        const existing = courts[position];
        if (!existing) {
          saved.push(await addCourt(active, tournament.id, name, position));
        } else if (existing.name !== name) {
          saved.push(await renameCourt(active, existing.id, name));
        } else {
          saved.push(existing);
        }
      }

      setCourts(saved);
      setPreset(defaultPreset(teams.length));
      setStep("format");
    });

  const start = () =>
    void (async () => {
      if (!tournament) return;
      setError(null);
      setLaunching("stages");
      try {
        const active = await getSession();
        const launched = await launchTournament(
          active,
          tournament.id,
          tournament.name,
          preset,
          teams.length,
          setLaunching,
        );
        setResult(launched);
        setStep("done");
      } catch (thrown) {
        report(thrown);
      } finally {
        setLaunching(null);
      }
    })();

  // --- render --------------------------------------------------------------

  return (
    <>
      {error ? (
        <div className="wiz__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ) : null}

      {step === "name" ? (
        <NameStep
          initial={tournament?.name ?? ""}
          sport={sport}
          busy={busy}
          resume={
            resumable
              ? {
                  name: resumable.tournament.name,
                  teams: resumable.teams.length,
                  onContinue: pickUpDraft,
                  onDiscard: discardDraft,
                }
              : null
          }
          onSport={setSport}
          onNext={submitName}
        />
      ) : null}

      {step === "teams" ? (
        <TeamsStep
          teams={teams}
          busy={busy}
          onAdd={addTeamToDraft}
          onRemove={removeTeamFromDraft}
          onBack={() => setStep("name")}
          onDone={() => setStep("courts")}
        />
      ) : null}

      {step === "courts" ? (
        <CourtsStep
          initial={courts}
          busy={busy}
          onBack={() => setStep("teams")}
          onNext={submitCourts}
        />
      ) : null}

      {step === "format" ? (
        <FormatStep
          teams={teams.length}
          courts={courts.length}
          value={preset}
          launching={launching}
          onChange={setPreset}
          onBack={() => setStep("courts")}
          onStart={start}
        />
      ) : null}

      {step === "done" && result ? (
        <DoneStep
          name={tournament?.name ?? "Your tournament"}
          tournamentId={tournament?.id ?? ""}
          result={result}
        />
      ) : null}
    </>
  );
}
