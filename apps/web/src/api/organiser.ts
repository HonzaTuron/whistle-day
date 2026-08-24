import type { Id } from "@seedly/engine";

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

export interface DraftTournament {
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

export async function createDraft(session: Session, name: string): Promise<DraftTournament> {
  const tournament = await api<DraftTournament>("/api/collections/tournaments/records", {
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
  api<DraftTournament>(`/api/collections/tournaments/records/${id}`, {
    method: "PATCH",
    token: session.token,
    body: { name },
  });

export const loadDraft = (session: Session, id: Id) =>
  api<DraftTournament>(`/api/collections/tournaments/records/${id}`, {
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
