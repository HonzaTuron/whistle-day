import type {
  Court,
  Display,
  Entry,
  Fixture,
  FixtureEvent,
  Game,
  EntryExit,
  Id,
  Invite,
  Pool,
  ScoringConfig,
  Slot,
  Stage,
  StaffRole,
} from "@whistleday/engine";
import { tr } from "../lib/i18n";
import { sportById, type SportId } from "../lib/scoring";

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
 * real email is the fix, offered at `/account`.
 */

const SESSION_KEY = "whistleday.organiser.session";
const DRAFT_KEY = "whistleday.organiser.draft";
const RUNNING_KEY = "whistleday.organiser.running";

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
    return new ApiError(body || tr("error.request", { status }), status);
  }

  const fields = Object.entries(parsed.data ?? {})
    .map(([field, detail]) => (detail?.message ? `${field}: ${detail.message}` : field))
    .join(", ");

  return new ApiError(fields || parsed.message || tr("error.request", { status }), status);
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
  const email = `organiser-${randomString(12)}@device.whistleday.local`;
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
  /** What is being played. Set from the sport chips on the first screen. */
  sport: string;
  /**
   * How the tables are worked out. Written at creation from the sport, and
   * editable afterwards from the scoring sheet — the server reads it on every
   * result, so a correction here rebuilds every table the next result touches.
   */
  scoring: ScoringConfig | null;
  /**
   * Who owns it. Read on the results screen to decide whether this device is
   * looking at its own tournament or one it was invited to help run — the
   * difference between the two is who may hand out the join codes.
   */
  owner: Id;
}

/**
 * A filter, encoded.
 *
 * `&&` in a PocketBase filter is two ampersands in a query string, and the
 * browser reads those as parameter separators — so an unencoded two-condition
 * filter arrives truncated at the first one and is rejected. Single-condition
 * filters happen to survive it, which is exactly why this went unnoticed:
 * every filter here had one condition until the invite lookup needed three.
 *
 * Every filter goes through here so the hazard cannot come back.
 */
const where = (filter: string) => `filter=${encodeURIComponent(filter)}`;

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
  session.email.toLowerCase().endsWith("@device.whistleday.local");

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
 * The tournaments this account can run, newest first — what a device that has
 * just signed in needs before it can show anything.
 *
 * Owned *or* joined. A referee who claimed their account and signed in on a
 * new phone owns nothing at all; a list filtered on ownership would tell them
 * they have no tournaments while they are standing at the court they were
 * invited to. The filter mirrors the `staffOnly` rule the server already
 * applies to every write below a tournament.
 */
export const myTournaments = (session: Session) =>
  records<TournamentRecord>(
    session,
    "tournaments",
    `${where(`owner='${session.userId}' || staff_via_tournament.user?='${session.userId}'`)}` +
      `&sort=-created&perPage=50`,
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

export async function createDraft(
  session: Session,
  name: string,
  sport: SportId,
): Promise<TournamentRecord> {
  const picked = sportById(sport);
  const tournament = await api<TournamentRecord>("/api/collections/tournaments/records", {
    method: "POST",
    token: session.token,
    body: {
      name,
      slug: slugify(name),
      status: "draft",
      owner: session.userId,
      sport: picked.sport,
      // The sport is the whole question the first screen asks about scoring.
      // Every number it implies is still editable from the scoring sheet on
      // the results screen, because a local league that plays for two points
      // is not a preset going wrong.
      scoring: picked.scoring,
    },
  });

  rememberDraft(tournament.id);
  return tournament;
}

/**
 * Change how the day is scored, mid-day if need be.
 *
 * Nothing is recomputed by this write on its own: `standings` is rebuilt when
 * a result lands, so a table already on the wall keeps the points it was built
 * with until the next fixture in its pool is settled. That is worth saying on
 * the screen rather than papering over here — re-tallying every stage from a
 * settings sheet is a much larger write than the one the organiser asked for,
 * and `POST /api/stages/{stage}/resolve` is the button that already means it.
 */
export const updateScoring = (
  session: Session,
  id: Id,
  scoring: ScoringConfig,
  sport: string,
) =>
  api<TournamentRecord>(`/api/collections/tournaments/records/${id}`, {
    method: "PATCH",
    token: session.token,
    body: { scoring, sport },
  });

/**
 * The first screen, submitted a second time. It carries the sport as well as
 * the name because they are the same screen: going back to correct one and
 * having the other silently ignored is the kind of thing nobody notices until
 * the tables are wrong.
 */
export const renameDraft = (
  session: Session,
  id: Id,
  name: string,
  sport: string,
  scoring: ScoringConfig,
) =>
  api<TournamentRecord>(`/api/collections/tournaments/records/${id}`, {
    method: "PATCH",
    token: session.token,
    body: { name, sport, scoring },
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
  records<TeamRecord>(session, "entries", `${where(`tournament='${tournament}'`)}&sort=seed&perPage=200`);

export const loadCourts = (session: Session, tournament: Id) =>
  records<CourtRecord>(session, "courts", `${where(`tournament='${tournament}'`)}&sort=position&perPage=100`);

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
  /**
   * The screen itself, so it can be configured from here.
   *
   * The first one: a tournament may have several screens and nothing yet
   * makes more than one, so this is the wall the "Screen" link points at.
   */
  screen: Display | null;
  /**
   * Everyone who can write to this tournament.
   *
   * Loaded with the board rather than on demand because the match history
   * needs it to put a name against a correction, and that is read inside a
   * sheet that should not be waiting on a request to say who changed a score.
   */
  staff: StaffRecord[];
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
  const [tournament, entries, stages, pools, courts, fixtures, screens, crew] =
    await Promise.all([
    loadTournament(session, id),
    records<Entry>(session, "entries", `${where(`tournament='${id}'`)}&sort=seed&perPage=200`),
    records<Stage>(session, "stages", `${where(`tournament='${id}'`)}&sort=position&perPage=50`),
    records<Pool>(session, "pools", `${where(`stage.tournament='${id}'`)}&sort=position&perPage=100`),
    records<Court>(session, "courts", `${where(`tournament='${id}'`)}&sort=position&perPage=50`),
    records<BoardFixture>(
      session,
      "fixtures",
      `${where(`tournament='${id}'`)}&sort=round,position` +
        `&expand=home_slot,away_slot&perPage=500`,
    ),
    // Staff can read their own screens; the public still needs the token.
    records<Display>(session, "displays", `${where(`tournament='${id}'`)}&perPage=5`),
    // A crew can see itself. An empty list is the ordinary case — most
    // tournaments are run by the one phone that created them.
    records<StaffRecord>(
      session,
      "staff",
      `${where(`tournament='${id}'`)}&sort=created&perPage=100`,
    ),
  ]);

  return {
    tournament,
    entries,
    stages,
    pools,
    courts,
    fixtures,
    token: screens[0]?.token ?? "",
    screen: screens[0] ?? null,
    staff: crew,
  };
}

/**
 * Change what the wall shows.
 *
 * Every field here is one the projector reads on its next payload, and the
 * server nudges it the moment this lands — so an organiser standing in front
 * of the screen with a phone sees the change on the wall rather than guessing
 * at it. That is also why these save on change rather than behind a button:
 * the wall is the preview.
 */
export const updateDisplay = (session: Session, id: Id, patch: Partial<Display>) =>
  api<Display>(`/api/collections/displays/records/${id}`, {
    method: "PATCH",
    token: session.token,
    body: patch,
  });

/**
 * Write a result and let the server do the rest.
 *
 * Closing a fixture is the only call the organiser ever makes: the hooks
 * derive the winner from the score, push it into the slots that name this
 * fixture as their source, rebuild the pool tables, and fill any playoff slot
 * waiting on a position in a table that has just become final. A corrected
 * score runs exactly the same chain — the tables are rebuilt from scratch
 * rather than adjusted, and a slot whose ranking changed is overwritten.
 *
 * `at` is when the match finished, which is not always when this request is
 * made: a result entered on a phone that had no signal is sent whenever the
 * signal comes back, and stamping it then would put a match played at two
 * o'clock at the top of the projector's recent results at half past. The
 * caller knows the moment; the default is for the ordinary online path, where
 * they are the same.
 */
export const saveResult = (
  session: Session,
  fixture: Id,
  homeScore: number,
  awayScore: number,
  at: Date = new Date(),
) =>
  api<Fixture>(`/api/collections/fixtures/records/${fixture}`, {
    method: "PATCH",
    token: session.token,
    body: {
      status: "finished",
      home_score: homeScore,
      away_score: awayScore,
      finished_at: stamp(at),
    },
  });

/** The points in one set. The sets themselves are ordered, and 1-based. */
export interface SetScore {
  home: number;
  away: number;
}

/** The per-set points of one match, first set first. */
export const loadGames = (session: Session, fixture: Id) =>
  records<Game>(session, "games", `${where(`fixture='${fixture}'`)}&sort=number&perPage=50`);

/**
 * Write the points set by set.
 *
 * The fixture keeps the match score — sets won, or goals — and these are the
 * numbers underneath it. They are not decoration: `standings` sums them into
 * sub_for / sub_against, which is the tiebreak that separates two teams level
 * on points and on sets, and the projector's "Now playing" reads them to show
 * a match in progress set by set.
 *
 * Rows are matched by set number rather than replaced wholesale, so correcting
 * the second set of a match leaves the first one's record alone. The server
 * rebuilds the tables on every one of these writes, hence the sequence rather
 * than a burst: they are three requests for a volleyball match, and the last
 * one to land should be the one the tables end up agreeing with.
 *
 * `existing` is read here rather than passed in. The sheet may have been open
 * a while, and the list it loaded is not what the write should be diffed
 * against.
 */
export async function saveGames(
  session: Session,
  fixture: Id,
  sets: SetScore[],
  settled: boolean,
): Promise<void> {
  const existing = await loadGames(session, fixture);

  for (const [index, set] of sets.entries()) {
    const number = index + 1;
    // Everything but the set being played is over; when the match itself is
    // over, so is the last one. The projector highlights the unfinished set.
    const finished = settled || index < sets.length - 1;
    const current = existing.find((game) => game.number === number);

    if (
      current &&
      current.home_score === set.home &&
      current.away_score === set.away &&
      current.finished === finished
    ) {
      continue;
    }

    await api<Game>(
      current
        ? `/api/collections/games/records/${current.id}`
        : "/api/collections/games/records",
      {
        method: current ? "PATCH" : "POST",
        token: session.token,
        body: {
          fixture,
          number,
          home_score: set.home,
          away_score: set.away,
          finished,
        },
      },
    );
  }

  // A match that went to three sets and is corrected to two leaves a third
  // row behind, and that row would still be counted in the tiebreak.
  for (const surplus of existing.filter((game) => game.number > sets.length)) {
    await api<null>(`/api/collections/games/records/${surplus.id}`, {
      method: "DELETE",
      token: session.token,
    });
  }
}

/**
 * What has been done to one match, oldest first.
 *
 * Loaded when the sheet opens rather than with the board: most matches are
 * entered once and never touched, so this is a request that usually returns
 * one row and only matters for the ones that get argued about.
 */
export const loadHistory = (session: Session, fixture: Id) =>
  records<FixtureEvent>(
    session,
    "fixture_events",
    `${where(`fixture='${fixture}'`)}&sort=created&perPage=50`,
  );

/**
 * Take a result back off a match.
 *
 * The server unrolls what it had filled in: the slots this fixture fed are
 * cleared, and the fixtures those slots feed lose the side they were given. A
 * match whose own sides are still known goes back to "ready"; one that was
 * only ever playable because of a result upstream goes back to "pending".
 *
 * Which of the two is the caller's to decide — `statusAfterClearing` reads it
 * off the board. It is a parameter rather than a lookup here because this call
 * can be made from a queue draining half an hour later, and the board it was
 * decided against is the one the organiser was looking at when they tapped.
 */
export const clearResult = (
  session: Session,
  fixture: Id,
  status: "ready" | "pending",
) =>
  api<Fixture>(`/api/collections/fixtures/records/${fixture}`, {
    method: "PATCH",
    token: session.token,
    body: {
      status,
      home_score: 0,
      away_score: 0,
      winner: "",
      loser: "",
      finished_at: "",
    },
  });

/** Where a fixture lands when its result is taken off. */
export const statusAfterClearing = (fixture: BoardFixture): "ready" | "pending" =>
  fixture.home_entry && fixture.away_entry ? "ready" : "pending";

/**
 * A match nobody played, won by the side that turned up.
 *
 * The winner is named rather than derived, because there is no score to derive
 * it from — and the scores are cleared, so a walkover recorded over an earlier
 * result does not leave that result's numbers behind it. The server credits
 * `scoring.walkoverScore` (0 by default) in the table; what is stored on the
 * fixture is an outcome, not a scoreline.
 */
export const saveWalkover = (
  session: Session,
  fixture: Id,
  winner: Id,
  at: Date = new Date(),
) =>
  api<Fixture>(`/api/collections/fixtures/records/${fixture}`, {
    method: "PATCH",
    token: session.token,
    body: {
      status: "walkover",
      winner,
      home_score: 0,
      away_score: 0,
      finished_at: stamp(at),
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
export const setLive = (
  session: Session,
  fixture: Id,
  live: boolean,
  at: Date = new Date(),
) =>
  api<Fixture>(`/api/collections/fixtures/records/${fixture}`, {
    method: "PATCH",
    token: session.token,
    body: live
      ? { status: "live", started_at: stamp(at) }
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
// a team going home
// ---------------------------------------------------------------------------

/**
 * Take a team out of a tournament that is already running.
 *
 * One call rather than a status write and then a lot of tidying up: the server
 * closes everything they had left and retallies every stage in one
 * transaction. Doing it by hand — a walkover per remaining fixture — is five
 * sheets in a group of six and a chance to miss one, and a tournament with one
 * fixture missed is a tournament whose table is quietly wrong.
 *
 * `policy` has no default here because it has none on the server either. The
 * two answers rank everybody else differently, so choosing one on the
 * organiser's behalf would be deciding their competition for them.
 */
export const withdrawEntry = (
  session: Session,
  entry: Id,
  policy: "forfeit" | "void",
  status: EntryExit = "withdrawn",
) =>
  api<{ entry: Id; status: string; policy: string }>(
    `/api/entries/${entry}/withdraw`,
    { method: "POST", token: session.token, body: { policy, status } },
  );

/**
 * What happened to one stage when a team arrived late.
 *
 * `waiting` is a stage that has nothing to do about them: it has not been
 * drawn yet, or it is a playoff fed by a table they can still qualify through.
 * `already` is admitting somebody twice, which is a no-op rather than a second
 * seat.
 */
export interface Admission {
  stage: Id;
  name: string;
  action: "waiting" | "already" | "pool" | "field" | "redrawn";
  pool?: Id;
  fixtures: number;
}

/**
 * Fit a team into a tournament that is already under way.
 *
 * The record itself is created the ordinary way, through `addTeam` — this is
 * the part the collection API cannot do: the matches they now owe a group, a
 * seat in a Swiss table, a bracket drawn again. All of it in one transaction,
 * and refused outright rather than half-applied when a bracket has already
 * been played.
 *
 * Not queued offline, for the same reason a withdrawal is not: who is in the
 * field decides who gets drawn into the next round, and an arrival sitting in
 * a queue for ten minutes is a round paired without them.
 */
export const admitEntry = (session: Session, entry: Id) =>
  api<{ entry: Id; stages: Admission[] }>(`/api/entries/${entry}/admit`, {
    method: "POST",
    token: session.token,
  });

/**
 * Put one back.
 *
 * Undoes what taking them out did and nothing else — the server tracks which
 * fixtures their exit closed, so a walkover the organiser recorded on purpose
 * an hour beforehand survives this untouched.
 */
export const reinstateEntry = (session: Session, entry: Id) =>
  api<{ entry: Id; status: string }>(`/api/entries/${entry}/reinstate`, {
    method: "POST",
    token: session.token,
  });

// ---------------------------------------------------------------------------
// the crew
// ---------------------------------------------------------------------------

/**
 * One person on the crew, as the owner's phone sees them.
 *
 * `name` lives on this row rather than on the account behind it. The users
 * collection lets an account view itself and nobody else, so expanding `user`
 * would give the owner a list of ids; and the question being asked here is not
 * "who is this account" but "who is this, at this tournament".
 */
export interface StaffRecord {
  id: Id;
  tournament: Id;
  user: Id;
  name: string;
  role: StaffRole;
  created: string;
}

export const loadStaff = (session: Session, tournament: Id) =>
  records<StaffRecord>(
    session,
    "staff",
    `${where(`tournament='${tournament}'`)}&sort=created&perPage=100`,
  );

/**
 * Take somebody off the crew.
 *
 * This is the revocation that matters day to day: one person, one row, and the
 * device in their pocket stops being able to write the moment it is gone.
 * Withdrawing the *link* is a different question — see `resetInvite`.
 */
export const removeStaff = (session: Session, id: Id) =>
  api<null>(`/api/collections/staff/records/${id}`, {
    method: "DELETE",
    token: session.token,
  });

/**
 * The live join link for one role, made on first ask.
 *
 * One link per role, not per person: the organiser shows the referee code to
 * whoever turns up, all morning. Minting a token per name would mean typing
 * names into a phone in a hall, which is the friction the QR exists to avoid —
 * the name is asked for at the other end, by the person who knows it.
 *
 * Created lazily so that a tournament nobody delegates never carries tokens
 * that were never shown to anyone.
 */
export async function ensureInvite(
  session: Session,
  tournament: Id,
  role: StaffRole,
): Promise<Invite> {
  const existing = await records<Invite>(
    session,
    "invites",
    `${where(`tournament='${tournament}' && role='${role}' && active=true`)}&perPage=1`,
  );
  if (existing[0]) return existing[0];

  return api<Invite>("/api/collections/invites/records", {
    method: "POST",
    token: session.token,
    body: { tournament, token: randomString(22), role, active: true },
  });
}

/**
 * Withdraw a link that got out, and put a fresh one in its place.
 *
 * Deactivating rather than deleting: the old row is what a stale QR code still
 * points at, and a token that resolves to an inactive invite is refused by the
 * server in the same breath as one that never existed. Anyone who already
 * joined on the old link stays on the crew — they are a `staff` row now, and
 * this was only ever the door they came through.
 */
export async function resetInvite(
  session: Session,
  tournament: Id,
  role: StaffRole,
): Promise<Invite> {
  const live = await records<Invite>(
    session,
    "invites",
    `${where(`tournament='${tournament}' && role='${role}' && active=true`)}&perPage=20`,
  );

  for (const invite of live) {
    await api<Invite>(`/api/collections/invites/records/${invite.id}`, {
      method: "PATCH",
      token: session.token,
      body: { active: false },
    });
  }

  return ensureInvite(session, tournament, role);
}

/** What a join code is for, read before anyone signs up to anything. */
export const previewInvite = (token: string) =>
  api<{ name: string; role: StaffRole }>(`/api/staff/invite/${token}`);

export interface JoinResult {
  tournament: Id;
  name: string;
  role: StaffRole | "owner";
}

/**
 * Accept an invitation as whoever this device is.
 *
 * The account comes from `ensureOrganiser`, which is the same call the wizard
 * makes: a referee's phone gets a device account it never had to type for, and
 * a referee who has claimed theirs and signed in joins as the account they
 * already have. Both are one request from here.
 */
export const joinWithInvite = (session: Session, token: string, name: string) =>
  api<JoinResult>("/api/staff/join", {
    method: "POST",
    token: session.token,
    body: { token, name },
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
