import { useEffect, useRef, useState } from "react";
import {
  addCourt,
  addTeam,
  createDraft,
  deleteDraft,
  ensureOrganiser,
  forgetDraft,
  loadCourts,
  loadTeams,
  loadTournament,
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
import { launchTournament, type LaunchResult, type LaunchStep } from "../api/launch";
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

  const session = useRef<Promise<Session> | null>(null);
  const getSession = () => (session.current ??= ensureOrganiser());

  const nextSeed = useRef(1);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const active = await getSession();
        const draftId = rememberedDraft();
        if (!draftId || cancelled) return;

        const draft = await loadTournament(active, draftId);
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
        forgetDraft();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const report = (thrown: unknown) =>
    setError(thrown instanceof Error ? thrown.message : "Something went wrong.");

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

  const submitName = (name: string) =>
    void run(async (active) => {
      if (tournament) {
        const picked = sportById(sport);
        setTournament(
          await renameDraft(active, tournament.id, name, picked.sport, picked.scoring),
        );
      } else {
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
      nextSeed.current = seed;
      report(thrown);
      return false;
    }
  };

  const removeTeamFromDraft = (id: string) => {
    const previous = teams;
    setTeams((current) => current.filter((team) => team.id !== id));
    void run((active) => removeTeam(active, id)).then((ok) => {
      if (ok === null) setTeams(previous);
    });
  };

  const submitCourts = (names: string[]) =>
    void run(async (active) => {
      if (!tournament) return;

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
