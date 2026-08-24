import type { Court, Entry, Fixture, Id, Pool, Slot, Stage } from "@seedly/engine";

/**
 * The organiser's side of the API — the half that writes.
 *
 * Every collection rule here expects an account: `tournaments.createRule` is
 * `@request.auth.id != ''`, and everything below a tournament is gated on
 * being its owner or its staff. Nobody standing in a hall with sixteen teams
 * waiting is going to enjoy a signup form, so the account is created for them:
 * a random address, a random password, both kept on the device. The tournament
 * is owned by a real user from its first request — the person just never had
 * to type anything to get one.
 *
 * The cost is worth stating plainly: those credentials live in this browser
 * and nowhere else. Clear the site data and the tournament stays live and
 * stays on the wall, but nobody can edit it again. Claiming the account with a
 * real email is the fix; that screen is not built yet.
 */

const SESSION_KEY = "seedly.organiser.session";
const DRAFT_KEY = "seedly.organiser.draft";
const RUNNING_KEY = "seedly.organiser.running";

export interface Session {
  userId: Id;
  email: string;
  /** Kept so the token can be renewed after it expires. */
  password: string;
  token: string;
}

// ---------------------------------------------------------------------------
// transport
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface PocketBaseError {
  message?: string;
  data?: Record<string, { message?: string } | undefined>;
}

/**
 * PocketBase reports validation failures per field. "Failed to create record."
 * tells an organiser nothing; "name: The value is required." at least points
 * at the box to fix.
 */
function readError(status: number, body: string): ApiError {
  let parsed: PocketBaseError;
  try {
    parsed = JSON.parse(body) as PocketBaseError;
  } catch {
    return new ApiError(body || `Request failed (${status}).`, status);
  }

  const fields = Object.entries(parsed.data ?? {})
    .map(([field, detail]) => (detail?.message ? `${field}: ${detail.message}` : field))
    .join(", ");

  return new ApiError(fields || parsed.message || `Request failed (${status}).`, status);
}

async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...(options.token ? { Authorization: options.token } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  if (!response.ok) throw readError(response.status, text);
  return (text ? JSON.parse(text) : null) as T;
}

// ---------------------------------------------------------------------------
// the anonymous organiser account
// ---------------------------------------------------------------------------

/**
 * Unambiguous alphabet: no 0/O/1/l. Screen tokens end up read off a wall and
 * typed into a phone by someone who is not looking closely.
 */
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null; // private mode, or something else wrote nonsense here
  }
}

function writeSession(session: Session): Session {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // A session that only lives for this page load still gets the tournament
    // created and started, which is the part that matters right now.
  }
  return session;
}

async function signUp(): Promise<Session> {
  const email = `organiser-${randomString(12)}@device.seedly.local`;
  const password = randomString(24);

  const user = await api<{ id: Id }>("/api/collections/users/records", {
    method: "POST",
    body: { email, password, passwordConfirm: password, name: "Organiser" },
  });

  const auth = await api<{ token: string }>(
    "/api/collections/users/auth-with-password",
    { method: "POST", body: { identity: email, password } },
  );

  return writeSession({ userId: user.id, email, password, token: auth.token });
}

/**
 * The session the whole wizard runs on.
 *
 * Order matters: an existing token is tried first because it costs one request
 * and usually works, then the stored password, and only then is a new account
 * created. Signing up on every reload would orphan the tournament started a
 * minute earlier — it would still be owned by an account nobody holds.
 */
export async function ensureOrganiser(): Promise<Session> {
  const stored = readSession();

  if (stored?.token) {
    try {
      const refreshed = await api<{ token: string }>(
        "/api/collections/users/auth-refresh",
        { method: "POST", token: stored.token },
      );
      return writeSession({ ...stored, token: refreshed.token });
    } catch {
      // expired or revoked — fall through to the password
    }
  }

  if (stored?.email && stored.password) {
    try {
      const auth = await api<{ token: string }>(
        "/api/collections/users/auth-with-password",
        { method: "POST", body: { identity: stored.email, password: stored.password } },
      );
      return writeSession({ ...stored, token: auth.token });
    } catch {
      // the account is gone (a reset database, most likely) — start over
    }
  }

  return signUp();
}

// ---------------------------------------------------------------------------
// records
// ---------------------------------------------------------------------------

export interface TeamRecord {
  id: Id;
  name: string;
  short_name: string;
  seed: number;
}

export interface CourtRecord {
  id: Id;
  name: string;
  position: number;
}

export interface TournamentRecord {
  id: Id;
  name: string;
  slug: string;
  status: string;
}

const records = <T>(session: Session, collection: string, query: string) =>
  api<{ items: T[] }>(
    `/api/collections/${collection}/records?${query}`,
    { token: session.token },
  ).then((page) => page.items);

/**
 * The session this device already has, if any — without making one.
 *
 * `ensureOrganiser` creates an account when there is none, which is right in
 * the wizard and wrong on a screen somebody opened to sign in: it would leave
 * an empty account behind every time.
 */
export const storedSession = (): Session | null => readSession();

/** True while the account is still the throwaway one the wizard made. */
export const isDeviceAccount = (session: Session) =>
  session.email.toLowerCase().endsWith("@device.seedly.local");

/**
 * Put a real email and password on the device account, so it can be signed
 * into from somewhere else.
 *
 * Claiming invalidates every token the anonymous account ever had — including
 * the one making the request — so this signs in again immediately and keeps
 * the new session. Nothing else changes: it is the same owner record, now with
 * a way back to it.
 */
export async function claimAccount(
  session: Session,
  email: string,
  password: string,
): Promise<Session> {
  await api<{ email: string }>("/api/organiser/claim", {
    method: "POST",
    token: session.token,
    body: { email, password },
  });
  return signIn(email, password);
}

/** Sign in on a device that has never seen this account. */
export async function signIn(email: string, password: string): Promise<Session> {
  const auth = await api<{ token: string; record: { id: Id } }>(
    "/api/collections/users/auth-with-password",
    { method: "POST", body: { identity: email, password } },
  );
  return writeSession({ userId: auth.record.id, email, password, token: auth.token });
}

/**
 * The tournaments this account owns, newest first — what a device that has
 * just signed in needs before it can show anything.
 */
export const myTournaments = (session: Session) =>
  records<TournamentRecord>(
    session,
    "tournaments",
    `filter=(owner='${session.userId}')&sort=-created&perPage=50`,
  );

/** A URL-safe slug, with a random tail because `tournaments.slug` is unique. */
function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics: "Podzimní" -> "Podzimni"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return `${base || "tournament"}-${randomString(5)}`;
}

export async function createDraft(session: Session, name: string): Promise<TournamentRecord> {
  const tournament = await api<TournamentRecord>("/api/collections/tournaments/records", {
    method: "POST",
    token: session.token,
    body: {
      name,
      slug: slugify(name),
      status: "draft",
      owner: session.userId,
      // Generic defaults: one game per fixture, three points for a win, draws
      // possible. A sport-specific setup (best of five, no draws) is a later
      // screen; guessing it here would be worse than a sane default.
      scoring: {
        bestOf: 1,
        pointsWin: 3,
        pointsDraw: 1,
        pointsLoss: 0,
        tiebreakers: ["points", "head_to_head", "score_diff", "score_for", "seed"],
      },
    },
  });

  rememberDraft(tournament.id);
  return tournament;
}

export const renameDraft = (session: Session, id: Id, name: string) =>
  api<TournamentRecord>(`/api/collections/tournaments/records/${id}`, {
    method: "PATCH",
    token: session.token,
    body: { name },
  });

/** One tournament record, draft or running. */
export const loadTournament = (session: Session, id: Id) =>
  api<TournamentRecord>(`/api/collections/tournaments/records/${id}`, {
    token: session.token,
  });

/** Cascade deletes take the entries, courts, stages and screens with it. */
export const deleteDraft = (session: Session, id: Id) =>
  api<null>(`/api/collections/tournaments/records/${id}`, {
    method: "DELETE",
    token: session.token,
  });

export const loadTeams = (session: Session, tournament: Id) =>
  records<TeamRecord>(session, "entries", `filter=(tournament='${tournament}')&sort=seed&perPage=200`);

export const loadCourts = (session: Session, tournament: Id) =>
  records<CourtRecord>(session, "courts", `filter=(tournament='${tournament}')&sort=position&perPage=100`);

/**
 * `seed` is the position in the list, and the list is the order they were
 * typed. The generator snakes seeds across pools, so this is what keeps the
 * first two teams entered out of the same group — worth saying out loud on
 * screen, because it is otherwise invisible.
 */
export const addTeam = (session: Session, tournament: Id, team: {
  name: string;
  shortName: string;
  seed: number;
}) =>
  api<TeamRecord>("/api/collections/entries/records", {
    method: "POST",
    token: session.token,
    body: {
      tournament,
      name: team.name,
      short_name: team.shortName,
      seed: team.seed,
      status: "active",
    },
  });

export const removeTeam = (session: Session, id: Id) =>
  api<null>(`/api/collections/entries/records/${id}`, {
    method: "DELETE",
    token: session.token,
  });

export const addCourt = (session: Session, tournament: Id, name: string, position: number) =>
  api<CourtRecord>("/api/collections/courts/records", {
    method: "POST",
    token: session.token,
    body: { tournament, name, position, active: true },
  });

export const renameCourt = (session: Session, id: Id, name: string) =>
  api<CourtRecord>(`/api/collections/courts/records/${id}`, {
    method: "PATCH",
    token: session.token,
    body: { name },
  });

export const removeCourt = (session: Session, id: Id) =>
  api<null>(`/api/collections/courts/records/${id}`, {
    method: "DELETE",
    token: session.token,
  });

// ---------------------------------------------------------------------------
// running a tournament
// ---------------------------------------------------------------------------

/** Everything the results screen needs, in five requests that run together. */
export interface Board {
  tournament: TournamentRecord;
  entries: Entry[];
  stages: Stage[];
  pools: Pool[];
  courts: Court[];
  fixtures: BoardFixture[];
  /** The screen token, so the organiser can always find the wall. */
  token: string;
}

/**
 * A fixture with its two slots expanded.
 *
 * `home_entry` is a cache of the slot and is null until the slot resolves, so
 * a bracket match waiting on the groups has nothing to render without the slot
 * it came from — that is where "Winner SF1" and "1. A" live. The server words
 * those labels; the client never invents one.
 */
export interface BoardFixture extends Fixture {
  expand?: {
    home_slot?: Slot;
    away_slot?: Slot;
  };
}

/** The shape PocketBase stores dates in: "2026-08-24 14:30:00.000Z". */
export const stamp = (date: Date) => date.toISOString().replace("T", " ");

export async function loadBoard(session: Session, id: Id): Promise<Board> {
  const [tournament, entries, stages, pools, courts, fixtures, screens] = await Promise.all([
    loadTournament(session, id),
    records<Entry>(session, "entries", `filter=(tournament='${id}')&sort=seed&perPage=200`),
    records<Stage>(session, "stages", `filter=(tournament='${id}')&sort=position&perPage=50`),
    records<Pool>(session, "pools", `filter=(stage.tournament='${id}')&sort=position&perPage=100`),
    records<Court>(session, "courts", `filter=(tournament='${id}')&sort=position&perPage=50`),
    records<BoardFixture>(
      session,
      "fixtures",
      `filter=(tournament='${id}')&sort=round,position` +
        `&expand=home_slot,away_slot&perPage=500`,
    ),
    // Staff can read their own screens; the public still needs the token.
    records<{ token: string }>(session, "displays", `filter=(tournament='${id}')&perPage=5`),
  ]);

  return {
    tournament,
    entries,
    stages,
    pools,
    courts,
    fixtures,
    token: screens[0]?.token ?? "",
  };
}

/**
 * Write a result and let the server do the rest.
 *
 * Closing a fixture is the only call the organiser ever makes: the hooks
 * derive the winner from the score, push it into the slots that name this
 * fixture as their source, rebuild the pool tables, and fill any playoff slot
 * waiting on a position in a table that has just become final. A corrected
 * score runs exactly the same chain — the tables are rebuilt from scratch
 * rather than adjusted, and a slot whose ranking changed is overwritten.
 */
export const saveResult = (
  session: Session,
  fixture: Id,
  homeScore: number,
  awayScore: number,
) =>
  api<Fixture>(`/api/collections/fixtures/records/${fixture}`, {
    method: "PATCH",
    token: session.token,
    body: {
      status: "finished",
      home_score: homeScore,
      away_score: awayScore,
      finished_at: stamp(new Date()),
    },
  });

/**
 * Take a result back off a match.
 *
 * The server unrolls what it had filled in: the slots this fixture fed are
 * cleared, and the fixtures those slots feed lose the side they were given. A
 * match whose own sides are still known goes back to "ready"; one that was
 * only ever playable because of a result upstream goes back to "pending".
 */
export const clearResult = (session: Session, fixture: BoardFixture) =>
  api<Fixture>(`/api/collections/fixtures/records/${fixture.id}`, {
    method: "PATCH",
    token: session.token,
    body: {
      status: fixture.home_entry && fixture.away_entry ? "ready" : "pending",
      home_score: 0,
      away_score: 0,
      winner: "",
      loser: "",
      finished_at: "",
    },
  });

/**
 * A match nobody played, won by the side that turned up.
 *
 * The winner is named rather than derived, because there is no score to derive
 * it from — and the scores are cleared, so a walkover recorded over an earlier
 * result does not leave that result's numbers behind it. The server credits
 * `scoring.walkoverScore` (0 by default) in the table; what is stored on the
 * fixture is an outcome, not a scoreline.
 */
export const saveWalkover = (session: Session, fixture: Id, winner: Id) =>
  api<Fixture>(`/api/collections/fixtures/records/${fixture}`, {
    method: "PATCH",
    token: session.token,
    body: {
      status: "walkover",
      winner,
      home_score: 0,
      away_score: 0,
      finished_at: stamp(new Date()),
    },
  });

/**
 * Where and when. Both are written the moment they are tapped rather than with
 * the result: putting a match on a court is a decision that has already
 * happened by the time it is recorded, and the score may be an hour away.
 */
export const setSchedule = (
  session: Session,
  fixture: Id,
  schedule: { court?: Id | null; scheduled_at?: string },
) =>
  api<Fixture>(`/api/collections/fixtures/records/${fixture}`, {
    method: "PATCH",
    token: session.token,
    body: {
      ...(schedule.court === undefined ? {} : { court: schedule.court ?? "" }),
      ...(schedule.scheduled_at === undefined
        ? {}
        : { scheduled_at: schedule.scheduled_at }),
    },
  });

/**
 * On or off court. `live` is what the projector's "Now playing" panel reads —
 * every live fixture appears on it, so this is the switch that puts a match on
 * the wall.
 */
export const setLive = (session: Session, fixture: Id, live: boolean) =>
  api<Fixture>(`/api/collections/fixtures/records/${fixture}`, {
    method: "PATCH",
    token: session.token,
    body: live
      ? { status: "live", started_at: stamp(new Date()) }
      : { status: "ready", started_at: "" },
  });

/**
 * The tournament this device is running, kept so the landing page can offer to
 * go back to it. The name is stored too — the whole point is to render that
 * offer without waiting for a request first.
 *
 * The screen token is stored for a duller reason: `displays.listRule` is
 * `active = true && token = @request.query.token`, so not even the owner can
 * ask which screens a tournament has. The wizard knows the token because it
 * generated it, and this is where it survives a reload.
 */
export interface RunningTournament {
  id: Id;
  name: string;
  token: string;
}

export function rememberTournament(tournament: RunningTournament) {
  try {
    localStorage.setItem(RUNNING_KEY, JSON.stringify(tournament));
  } catch {
    /* nothing to remember it with; the link still works */
  }
}

export function rememberedTournament(): RunningTournament | null {
  try {
    const raw = localStorage.getItem(RUNNING_KEY);
    return raw ? (JSON.parse(raw) as RunningTournament) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// the draft this device is in the middle of
// ---------------------------------------------------------------------------

export function rememberDraft(id: Id) {
  try {
    localStorage.setItem(DRAFT_KEY, id);
  } catch {
    /* nothing to remember it with; the wizard still works in this tab */
  }
}

export function forgetDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* see above */
  }
}

export function rememberedDraft(): Id | null {
  try {
    return localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}
