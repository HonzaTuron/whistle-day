import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Id, ScoringConfig, StaffRole } from "@whistleday/engine";
import {
  ensureOrganiser,
  loadBoard,
  myTournaments,
  loadTournament,
  loadTeams,
  loadCourts,
  loadGames,
  loadHistory,
  loadStaff,
  createDraft,
  renameDraft,
  deleteDraft,
  addTeam,
  removeTeam,
  addCourt,
  renameCourt,
  removeCourt,
  updateDisplay,
  updateScoring,
  saveResult,
  saveGames,
  saveWalkover,
  clearResult,
  setSchedule,
  setLive,
  withdrawEntry,
  reinstateEntry,
  ensureInvite,
  resetInvite,
  removeStaff,
  previewInvite,
  previewHandoff,
  joinWithInvite,
  claimAccount,
  signIn,
  storedSession,
  type Session,
  type Board,
  type SetScore,
} from "./organiser";
import type { SportId } from "../lib/scoring";
import type { PresetId } from "../lib/presets";
import { launchTournament, type LaunchStep } from "./launch";

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------

export const keys = {
  session: ["session"] as const,
  tournament: (id: Id) => ["tournament", id] as const,
  board: (id: Id) => ["board", id] as const,
  myTournaments: ["myTournaments"] as const,
  teams: (tournament: Id) => ["teams", tournament] as const,
  courts: (tournament: Id) => ["courts", tournament] as const,
  games: (fixture: Id) => ["games", fixture] as const,
  history: (fixture: Id) => ["history", fixture] as const,
  staff: (tournament: Id) => ["staff", tournament] as const,
  invite: (tournament: Id, role: StaffRole) => ["invite", tournament, role] as const,
  preview: (token: string) => ["preview", token] as const,
  handoff: (token: string) => ["handoff", token] as const,
};

// ---------------------------------------------------------------------------
// Session helpers (wraps the imperative session management)
// ---------------------------------------------------------------------------

function sessionQueryKey(userId?: string) {
  return [...keys.session, userId].filter(Boolean);
}

/**
 * Returns a cached session, creating one if needed.
 * Not a query — the session is side-effectful (writes to localStorage).
 */
let sessionPromise: Promise<Session> | null = null;
export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey(storedSession()?.userId),
    queryFn: () => (sessionPromise ??= ensureOrganiser()),
    staleTime: 1000 * 60 * 5,
    gcTime: Infinity,
  });
}

export function useStoredSession() {
  return storedSession();
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useBoard(id: Id) {
  return useQuery({
    queryKey: keys.board(id),
    queryFn: async () => {
      const session = await ensureOrganiser();
      return loadBoard(session, id);
    },
  });
}

export function useMyTournaments() {
  return useQuery({
    queryKey: keys.myTournaments,
    queryFn: async () => {
      const session = await ensureOrganiser();
      return myTournaments(session);
    },
    enabled: !!storedSession(),
  });
}

export function useTournament(id: Id) {
  return useQuery({
    queryKey: keys.tournament(id),
    queryFn: async () => {
      const session = await ensureOrganiser();
      return loadTournament(session, id);
    },
  });
}

export function useTeams(tournament: Id) {
  return useQuery({
    queryKey: keys.teams(tournament),
    queryFn: async () => {
      const session = await ensureOrganiser();
      return loadTeams(session, tournament);
    },
  });
}

export function useCourts(tournament: Id) {
  return useQuery({
    queryKey: keys.courts(tournament),
    queryFn: async () => {
      const session = await ensureOrganiser();
      return loadCourts(session, tournament);
    },
  });
}

export function useGames(fixture: Id) {
  return useQuery({
    queryKey: keys.games(fixture),
    queryFn: async () => {
      const session = await ensureOrganiser();
      return loadGames(session, fixture);
    },
    enabled: !!fixture,
  });
}

export function useHistory(fixture: Id) {
  return useQuery({
    queryKey: keys.history(fixture),
    queryFn: async () => {
      const session = await ensureOrganiser();
      return loadHistory(session, fixture);
    },
    enabled: !!fixture,
  });
}

export function useStaff(tournament: Id) {
  return useQuery({
    queryKey: keys.staff(tournament),
    queryFn: async () => {
      const session = await ensureOrganiser();
      return loadStaff(session, tournament);
    },
  });
}

export function usePreviewInvite(token: string) {
  return useQuery({
    queryKey: keys.preview(token),
    queryFn: () => previewInvite(token),
    enabled: !!token,
  });
}

/**
 * What a handoff link is for.
 *
 * `retry: false` because the failure worth showing is "this link is not valid
 * any more", and retrying a spent link three times only delays saying so.
 */
export function usePreviewHandoff(token: string) {
  return useQuery({
    queryKey: keys.handoff(token),
    queryFn: () => previewHandoff(token),
    enabled: !!token,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ session, name, sport }: { session: Session; name: string; sport: SportId }) =>
      createDraft(session, name, sport),
    onSuccess: (tournament) => {
      qc.setQueryData(keys.tournament(tournament.id), tournament);
    },
  });
}

export function useRenameDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      id,
      name,
      sport,
      scoring,
    }: {
      session: Session;
      id: Id;
      name: string;
      sport: string;
      scoring: ScoringConfig;
    }) => renameDraft(session, id, name, sport, scoring),
    onSuccess: (tournament) => {
      qc.setQueryData(keys.tournament(tournament.id), tournament);
    },
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ session, id }: { session: Session; id: Id }) => deleteDraft(session, id),
    onSuccess: (_data, { id }) => {
      qc.removeQueries({ queryKey: keys.tournament(id) });
    },
  });
}

export function useAddTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      tournament,
      name,
      shortName,
      seed,
    }: {
      session: Session;
      tournament: Id;
      name: string;
      shortName: string;
      seed: number;
    }) => addTeam(session, tournament, { name, shortName, seed }),
    onSuccess: (_data, { tournament }) => {
      qc.invalidateQueries({ queryKey: keys.teams(tournament) });
    },
  });
}

export function useRemoveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ session, id, tournament }: { session: Session; id: Id; tournament: Id }) =>
      removeTeam(session, id).then(() => tournament),
    onSuccess: (tournament) => {
      qc.invalidateQueries({ queryKey: keys.teams(tournament) });
    },
  });
}

export function useAddCourt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      tournament,
      name,
      position,
    }: {
      session: Session;
      tournament: Id;
      name: string;
      position: number;
    }) => addCourt(session, tournament, name, position),
    onSuccess: (_data, { tournament }) => {
      qc.invalidateQueries({ queryKey: keys.courts(tournament) });
    },
  });
}

export function useRenameCourt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      id,
      name,
      tournament,
    }: {
      session: Session;
      id: Id;
      name: string;
      tournament: Id;
    }) => renameCourt(session, id, name).then(() => tournament),
    onSuccess: (tournament) => {
      qc.invalidateQueries({ queryKey: keys.courts(tournament) });
    },
  });
}

export function useRemoveCourt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      id,
      tournament,
    }: {
      session: Session;
      id: Id;
      tournament: Id;
    }) => removeCourt(session, id).then(() => tournament),
    onSuccess: (tournament) => {
      qc.invalidateQueries({ queryKey: keys.courts(tournament) });
    },
  });
}

export function useSaveResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      fixture,
      homeScore,
      awayScore,
      at,
    }: {
      session: Session;
      fixture: Id;
      homeScore: number;
      awayScore: number;
      at?: Date;
    }) => saveResult(session, fixture, homeScore, awayScore, at),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board"] });
    },
  });
}

export function useSaveGames() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      fixture,
      sets,
      settled,
    }: {
      session: Session;
      fixture: Id;
      sets: SetScore[];
      settled: boolean;
    }) => saveGames(session, fixture, sets, settled),
    onSuccess: (_data, { fixture }) => {
      qc.invalidateQueries({ queryKey: keys.games(fixture) });
      qc.invalidateQueries({ queryKey: ["board"] });
    },
  });
}

export function useSaveWalkover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      fixture,
      winner,
      at,
    }: {
      session: Session;
      fixture: Id;
      winner: Id;
      at?: Date;
    }) => saveWalkover(session, fixture, winner, at),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board"] });
    },
  });
}

export function useClearResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      fixture,
      status,
    }: {
      session: Session;
      fixture: Id;
      status: "ready" | "pending";
    }) => clearResult(session, fixture, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board"] });
    },
  });
}

export function useSetSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      fixture,
      court,
      scheduled_at,
    }: {
      session: Session;
      fixture: Id;
      court?: Id | null;
      scheduled_at?: string;
    }) => setSchedule(session, fixture, { court, scheduled_at }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board"] });
    },
  });
}

export function useSetLive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      fixture,
      live,
      at,
    }: {
      session: Session;
      fixture: Id;
      live: boolean;
      at?: Date;
    }) => setLive(session, fixture, live, at),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board"] });
    },
  });
}

export function useUpdateDisplay(tournament: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      id,
      patch,
    }: {
      session: Session;
      id: Id;
      patch: Partial<import("@whistleday/engine").Display>;
    }) => updateDisplay(session, id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.board(tournament) });
      const previous = qc.getQueryData<Board>(keys.board(tournament));
      if (previous?.screen && previous.screen.id === id) {
        qc.setQueryData<Board>(keys.board(tournament), {
          ...previous,
          screen: { ...previous.screen, ...patch },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(keys.board(tournament), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.board(tournament) });
    },
  });
}

export function useUpdateScoring(tournament: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      id,
      scoring,
      sport,
    }: {
      session: Session;
      id: Id;
      scoring: ScoringConfig;
      sport: string;
    }) => updateScoring(session, id, scoring, sport),
    onMutate: async ({ scoring, sport }) => {
      await qc.cancelQueries({ queryKey: keys.board(tournament) });
      const previous = qc.getQueryData<Board>(keys.board(tournament));
      if (previous) {
        qc.setQueryData<Board>(keys.board(tournament), {
          ...previous,
          tournament: { ...previous.tournament, scoring, sport },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(keys.board(tournament), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.board(tournament) });
    },
  });
}

export function useWithdrawEntry(tournament: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      entry,
      policy,
      status,
    }: {
      session: Session;
      entry: Id;
      policy: "forfeit" | "void";
      status?: import("@whistleday/engine").EntryExit;
    }) => withdrawEntry(session, entry, policy, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.board(tournament) });
    },
  });
}

export function useReinstateEntry(tournament: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ session, entry }: { session: Session; entry: Id }) =>
      reinstateEntry(session, entry),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.board(tournament) });
    },
  });
}

export function useEnsureInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      tournament,
      role,
    }: {
      session: Session;
      tournament: Id;
      role: StaffRole;
    }) => ensureInvite(session, tournament, role),
    onSuccess: (_data, { tournament, role }) => {
      qc.invalidateQueries({ queryKey: keys.invite(tournament, role) });
    },
  });
}

export function useResetInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      tournament,
      role,
    }: {
      session: Session;
      tournament: Id;
      role: StaffRole;
    }) => resetInvite(session, tournament, role),
    onSuccess: (_data, { tournament, role }) => {
      qc.invalidateQueries({ queryKey: keys.invite(tournament, role) });
    },
  });
}

export function useRemoveStaff(tournament: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ session, id }: { session: Session; id: Id }) => removeStaff(session, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.staff(tournament) });
    },
  });
}

export function useJoinWithInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      session,
      token,
      name,
    }: {
      session: Session;
      token: string;
      name: string;
    }) => joinWithInvite(session, token, name),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: keys.board(result.tournament) });
    },
  });
}

export function useClaimAccount() {
  return useMutation({
    mutationFn: ({
      session,
      email,
      password,
    }: {
      session: Session;
      email: string;
      password: string;
    }) => claimAccount(session, email, password),
  });
}

export function useSignIn() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signIn(email, password),
  });
}

// ---------------------------------------------------------------------------
// Launch mutation
// ---------------------------------------------------------------------------

export function useLaunchTournament() {
  return useMutation({
    mutationFn: async ({
      session,
      tournament,
      name,
      presetId,
      teams,
      onStep,
    }: {
      session: Session;
      tournament: Id;
      name: string;
      presetId: PresetId;
      teams: number;
      onStep: (step: LaunchStep) => void;
    }) => launchTournament(session, tournament, name, presetId, teams, onStep),
  });
}
