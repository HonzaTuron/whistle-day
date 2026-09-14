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
import { useI18n, useT } from "../lib/i18n";
import { defaultPreset, presetById, type PresetId } from "../lib/presets";
import {
  DEFAULT_SPORT,
  drawsAllowed,
  matchSport,
  sportById,
  type SportId,
} from "../lib/scoring";
import type { ScoringConfig } from "@whistleday/engine";

type Step = "name" | "teams" | "courts" | "format" | "done";

interface Resumable {
  tournament: TournamentRecord;
  teams: TeamRecord[];
  courts: CourtRecord[];
}

interface Props {
  /**
   * The format the marketing page that sent them here was about. A suggestion
   * the organiser can override on the way through — a page about an 8-team
   * double elimination should not drop somebody onto a blank format screen,
   * and it should not stop them picking groups either.
   */
  initialPreset?: PresetId;
}

export function Create({ initialPreset }: Props = {}) {
  const t = useT();
  const { locale } = useI18n();
  const [step, setStep] = useState<Step>("name");
  const [tournament, setTournament] = useState<TournamentRecord | null>(null);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [courts, setCourts] = useState<CourtRecord[]>([]);
  const [preset, setPreset] = useState<PresetId>("groups");
  const [sport, setSport] = useState<SportId>(DEFAULT_SPORT);
  // Overrides the preset's own default sets, once the organiser has picked
  // one — `null` means "whatever the sport implies", not "one set".
  const [bestOf, setBestOf] = useState<number | null>(null);
  const [customSportName, setCustomSportName] = useState("");
  const [customDrawsAllowed, setCustomDrawsAllowed] = useState(true);
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
    setError(thrown instanceof Error ? thrown.message : t("error.generic"));

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

  /**
   * The sport chip plus its two small overrides — how many sets, and what a
   * custom sport is even called — collapsed into what the record actually
   * needs: a name for `tournaments.sport` and a full scoring table.
   */
  const effectiveSport = (): { sport: string; scoring: ScoringConfig } => {
    const picked = sportById(sport);
    const resolvedBestOf = bestOf ?? picked.scoring.bestOf;
    if (sport === "other") {
      return {
        sport: customSportName.trim(),
        scoring: {
          ...picked.scoring,
          bestOf: resolvedBestOf,
          // A match settled by sets never ends level; the toggle only means
          // something once a single score is what decides it.
          drawsAllowed: resolvedBestOf > 1 ? false : customDrawsAllowed,
        },
      };
    }
    return { sport: picked.sport, scoring: { ...picked.scoring, bestOf: resolvedBestOf } };
  };

  const submitName = (name: string) =>
    void run(async (active) => {
      const { sport: sportName, scoring } = effectiveSport();
      if (tournament) {
        setTournament(await renameDraft(active, tournament.id, name, sportName, scoring));
      } else {
        if (resumable) {
          await deleteDraft(active, resumable.tournament.id).catch(() => undefined);
          setResumable(null);
        }
        setTournament(await createDraft(active, name, sportName, scoring));
      }
      setStep("teams");
    });

  const pickUpDraft = () => {
    if (!resumable) return;
    setTournament(resumable.tournament);
    setTeams(resumable.teams);
    setCourts(resumable.courts);
    const matched = matchSport(resumable.tournament.sport, resumable.tournament.scoring);
    setSport(matched ?? "other");
    setCustomSportName(matched ? "" : resumable.tournament.sport);
    setBestOf(resumable.tournament.scoring?.bestOf ?? null);
    setCustomDrawsAllowed(drawsAllowed(resumable.tournament.scoring));
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
      // The format the page advertised wins, but only while the field is
      // actually big enough for it — arriving from "16 team Swiss" and then
      // entering five teams has to fall back to something that can be drawn.
      setPreset(
        initialPreset && teams.length >= presetById(initialPreset).minTeams
          ? initialPreset
          : defaultPreset(teams.length),
      );
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
          locale,
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
          <button type="button" onClick={() => setError(null)} aria-label={t("common.dismiss")}>
            ✕
          </button>
        </div>
      ) : null}

      {step === "name" ? (
        <NameStep
          initial={tournament?.name ?? ""}
          sport={sport}
          bestOf={bestOf}
          customSportName={customSportName}
          customDrawsAllowed={customDrawsAllowed}
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
          onSport={(next) => {
            setSport(next);
            setBestOf(null);
          }}
          onBestOf={setBestOf}
          onCustomSportName={setCustomSportName}
          onCustomDrawsAllowed={setCustomDrawsAllowed}
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
          sport={sport}
          busy={busy}
          onBack={() => setStep("teams")}
          onNext={submitCourts}
        />
      ) : null}

      {step === "format" ? (
        <FormatStep
          teams={teams.length}
          courts={courts.length}
          sport={sport}
          value={preset}
          launching={launching}
          onChange={setPreset}
          onBack={() => setStep("courts")}
          onStart={start}
        />
      ) : null}

      {step === "done" && result ? (
        <DoneStep
          name={tournament?.name ?? t("wizard.doneFallbackName")}
          tournamentId={tournament?.id ?? ""}
          result={result}
        />
      ) : null}
    </>
  );
}
