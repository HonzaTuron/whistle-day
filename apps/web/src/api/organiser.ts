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
  Sponsor,
  Stage,
  StaffRole,
} from "@whistleday/engine";
import { tr } from "../lib/i18n";
import { call, pb } from "./client";

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
  /**
   * Whether the address has been confirmed. Always false for the device
   * account (there is no address to confirm); it is the claimed-account
   * nudge on `/account` that reads it, to say whether a password reset would
   * actually reach anybody.
   */
  verified?: boolean;
}

// ---------------------------------------------------------------------------
// transport
// ---------------------------------------------------------------------------

export { ApiError } from "./client";

/**
 * Point the SDK at a session and hand the client back.
 *
 * The session is passed to every function in this file rather than being read
 * from ambient state, and that is worth keeping: it is what makes it obvious
 * at the call site whose tournament is being written to. The SDK wants the
 * token on its own store, so this is where the two meet.
 */
function as(session: Session | null) {
  const client = pb();
  if (session) client.authStore.save(session.token, null as never);
  else client.authStore.clear();
  return client;
}

const create = <T>(session: Session, collection: string, body: Record<string, unknown>) =>
  call(() => as(session).collection(collection).create<T>(body));

const update = <T>(session: Session, collection: string, id: Id, body: Record<string, unknown>) =>
  call(() => as(session).collection(collection).update<T>(id, body));

const remove = (session: Session, collection: string, id: Id) =>
  call(async () => {
    await as(session).collection(collection).delete(id);
    return null;
  });

const one = <T>(session: Session, collection: string, id: Id) =>
  call(() => as(session).collection(collection).getOne<T>(id));

/**
 * Every record matching a filter.
 *
 * `getFullList` pages until it runs out, which is why no call here names a
 * page size any more. The ones that used to were guesses — `perPage=200` for
 * teams, `perPage=500` for fixtures — and a guess that is too small is a board
 * missing the end of itself.
 *
 * Filters are built with `client.filter`, which escapes what it interpolates.
 * The hand-rolled version had to encode `&&` itself, because two ampersands in
 * a query string are read as a parameter separator and a two-condition filter
 * arrived truncated at the first one. Single-condition filters survived it,
 * which is exactly why it went unnoticed until an invite lookup needed three.
 * That hazard is now somebody else's.
 */
const list = <T>(
  session: Session,
  collection: string,
  options: { filter?: string; sort?: string; expand?: string } = {},
) => call(() => as(session).collection(collection).getFullList<T>(options));

/**
 * A custom route — the ones collection rules cannot express, like generating a
 * stage or taking a team out. `session` is null for the public ones.
 *
 * Exported so api/connect.ts — the browser side of an agent asking to
 * connect, which calls its own custom routes rather than any collection —
 * can reuse it instead of re-deriving the same `as(session).send(...)` call.
 */
export const send = <T>(
  session: Session | null,
  path: string,
  options: { method?: string; body?: unknown } = {},
) =>
  call(
    () =>
      as(session).send(path, {
        method: options.method ?? "GET",
        ...(options.body === undefined ? {} : { body: options.body }),
      }) as Promise<T>,
  );

/** Escaped filter interpolation, for the call sites below. */
const filter = (expression: string, params: Record<string, unknown>) =>
  pb().filter(expression, params);

export { writeSession };

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

  const users = pb().collection("users");
  const user = await call(() =>
    users.create<{ id: Id }>({
      email,
      password,
      passwordConfirm: password,
      name: "Organiser",
    }),
  );
  const auth = await call(() => users.authWithPassword(email, password));

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
      const refreshed = await as(stored).collection("users").authRefresh();
      return writeSession({
        ...stored,
        token: refreshed.token,
        verified: Boolean(refreshed.record.verified),
      });
    } catch {
      // expired or revoked — fall through to the password
    }
  }

  if (stored?.email && stored.password) {
    try {
      const auth = await pb()
        .collection("users")
        .authWithPassword(stored.email, stored.password);
      return writeSession({
        ...stored,
        token: auth.token,
        verified: Boolean(auth.record.verified),
      });
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
const records = list;

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
  await send<{ email: string }>(session, "/api/organiser/claim", {
    method: "POST",
    body: { email, password },
  });
  return signIn(email, password);
}

/** Sign in on a device that has never seen this account. */
export async function signIn(email: string, password: string): Promise<Session> {
  const auth = await call(() =>
    pb().collection("users").authWithPassword(email, password),
  );
  return writeSession({
    userId: auth.record.id,
    email,
    password,
    token: auth.token,
    verified: Boolean(auth.record.verified),
  });
}

/**
 * Sign out from this device, clearing stored session and draft state.
 */
export function signOut(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(RUNNING_KEY);
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
  pb().authStore.clear();
}

/**
 * Permanently delete the user account and all owned tournaments.
 * GDPR right to erasure / user deletion path.
 */
export async function deleteAccount(session: Session): Promise<void> {
  await send(session, "/api/organiser/delete", { method: "POST" });
  signOut();
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
  records<TournamentRecord>(session, "tournaments", {
    filter: filter("owner = {:me} || staff_via_tournament.user ?= {:me}", {
      me: session.userId,
    }),
    sort: "-created",
  });

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
  sport: string,
  scoring: ScoringConfig,
): Promise<TournamentRecord> {
  const tournament = await create<TournamentRecord>(session, "tournaments", {
      name,
      slug: slugify(name),
      status: "draft",
      owner: session.userId,
      sport,
      // The sport is the whole question the first screen asks about scoring.
      // Every number it implies is still editable from the scoring sheet on
      // the results screen, because a local league that plays for two points
      // is not a preset going wrong.
      scoring,
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
  update<TournamentRecord>(session, "tournaments", id, { scoring, sport });

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
  update<TournamentRecord>(session, "tournaments", id, { name, sport, scoring });

/** One tournament record, draft or running. */
export const loadTournament = (session: Session, id: Id) =>
  one<TournamentRecord>(session, "tournaments", id);

/** Cascade deletes take the entries, courts, stages and screens with it. */
export const deleteDraft = (session: Session, id: Id) =>
  remove(session, "tournaments", id);

export const loadTeams = (session: Session, tournament: Id) =>
  records<TeamRecord>(session, "entries", { filter: filter("tournament = {:v}", { v: tournament }), sort: "seed" });

export const loadCourts = (session: Session, tournament: Id) =>
  records<CourtRecord>(session, "courts", { filter: filter("tournament = {:v}", { v: tournament }), sort: "position" });

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
  create<TeamRecord>(session, "entries", {
      tournament,
      name: team.name,
      short_name: team.shortName,
      seed: team.seed,
      status: "active",
    });

export const removeTeam = (session: Session, id: Id) =>
  remove(session, "entries", id);

export const addCourt = (session: Session, tournament: Id, name: string, position: number) =>
  create<CourtRecord>(session, "courts", { tournament, name, position, active: true });

export const renameCourt = (session: Session, id: Id, name: string) =>
  update<CourtRecord>(session, "courts", id, { name });

export const removeCourt = (session: Session, id: Id) =>
  remove(session, "courts", id);

// ---------------------------------------------------------------------------
// the closing panel's sponsors
// ---------------------------------------------------------------------------

export const loadSponsors = (session: Session, tournament: Id) =>
  records<Sponsor>(session, "sponsors", {
    filter: filter("tournament = {:v}", { v: tournament }),
    sort: "position",
  });

/**
 * A thumbnail for the sheet an organiser edits this from, or "" with none
 * uploaded. `100x100` needs no per-field thumb config — PocketBase serves it
 * for any file field.
 */
export const sponsorLogoUrl = (sponsor: Sponsor): string =>
  sponsor.logo ? pb().files.getURL(sponsor, sponsor.logo, { thumb: "100x100" }) : "";

/**
 * A logo is not required to add a row — the name is what makes it a sponsor,
 * and a picture can follow the moment it arrives by email.
 */
export const addSponsor = (
  session: Session,
  tournament: Id,
  sponsor: { name: string; tier: string; position: number; logo?: File },
) =>
  create<Sponsor>(session, "sponsors", {
    tournament,
    name: sponsor.name,
    tier: sponsor.tier,
    position: sponsor.position,
    ...(sponsor.logo ? { logo: sponsor.logo } : {}),
  });

/**
 * `logo` is only sent when a new file was picked. Leaving it out of the patch
 * keeps whatever is already uploaded; `null` clears it without replacing it.
 */
export const updateSponsor = (
  session: Session,
  id: Id,
  patch: { name?: string; tier?: string; logo?: File | null },
) => update<Sponsor>(session, "sponsors", id, patch);

export const removeSponsor = (session: Session, id: Id) =>
  remove(session, "sponsors", id);

/**
 * Swap two rows' places in the rotation.
 *
 * There is no drag handle here the way there is for a screen's panels — a
 * sponsor list is short and reordered rarely, so a pair of buttons is the
 * whole interface, and swapping the two positions is all moving one row up or
 * down ever needs.
 */
export const swapSponsors = (session: Session, a: Sponsor, b: Sponsor) =>
  Promise.all([
    update<Sponsor>(session, "sponsors", a.id, { position: b.position }),
    update<Sponsor>(session, "sponsors", b.id, { position: a.position }),
  ]);

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
  /** The closing panel's sponsors, in the order they run. */
  sponsors: Sponsor[];
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
  const [tournament, entries, stages, pools, courts, fixtures, screens, crew, sponsors] =
    await Promise.all([
    loadTournament(session, id),
    records<Entry>(session, "entries", { filter: filter("tournament = {:v}", { v: id }), sort: "seed" }),
    records<Stage>(session, "stages", { filter: filter("tournament = {:v}", { v: id }), sort: "position" }),
    records<Pool>(session, "pools", { filter: filter("stage.tournament = {:v}", { v: id }), sort: "position" }),
    records<Court>(session, "courts", { filter: filter("tournament = {:v}", { v: id }), sort: "position" }),
    records<BoardFixture>(session, "fixtures", {
      filter: filter("tournament = {:v}", { v: id }),
      sort: "round,position",
      expand: "home_slot,away_slot",
    }),
    // Staff can read their own screens; the public still needs the token.
    records<Display>(session, "displays", { filter: filter("tournament = {:v}", { v: id }) }),
    // A crew can see itself. An empty list is the ordinary case — most
    // tournaments are run by the one phone that created them.
    records<StaffRecord>(
      session,
      "staff",
      { filter: filter("tournament = {:v}", { v: id }), sort: "created" },
    ),
    loadSponsors(session, id),
  ]);

  return {
    tournament,
    entries,
    stages,
    pools,
    courts,
    fixtures,
    sponsors,
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
  update<Display>(session, "displays", id, patch);

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
  update<Fixture>(session, "fixtures", fixture, {
      status: "finished",
      home_score: homeScore,
      away_score: awayScore,
      finished_at: stamp(at),
    });

/** The points in one set. The sets themselves are ordered, and 1-based. */
export interface SetScore {
  home: number;
  away: number;
}

/** The per-set points of one match, first set first. */
export const loadGames = (session: Session, fixture: Id) =>
  records<Game>(session, "games", { filter: filter("fixture = {:v}", { v: fixture }), sort: "number" });

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

    const body = {
      fixture,
      number,
      home_score: set.home,
      away_score: set.away,
      finished,
    };
    await (current
      ? update<Game>(session, "games", current.id, body)
      : create<Game>(session, "games", body));
  }

  // A match that went to three sets and is corrected to two leaves a third
  // row behind, and that row would still be counted in the tiebreak.
  for (const surplus of existing.filter((game) => game.number > sets.length)) {
    await remove(session, "games", surplus.id);
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
    { filter: filter("fixture = {:v}", { v: fixture }), sort: "created" },
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
  update<Fixture>(session, "fixtures", fixture, {
      status,
      home_score: 0,
      away_score: 0,
      winner: "",
      loser: "",
      finished_at: "",
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
  update<Fixture>(session, "fixtures", fixture, {
      status: "walkover",
      winner,
      home_score: 0,
      away_score: 0,
      finished_at: stamp(at),
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
  update<Fixture>(session, "fixtures", fixture, {
      ...(schedule.court === undefined ? {} : { court: schedule.court ?? "" }),
      ...(schedule.scheduled_at === undefined
        ? {}
        : { scheduled_at: schedule.scheduled_at }),
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
  update<Fixture>(session, "fixtures", fixture, live
      ? { status: "live", started_at: stamp(at) }
      : { status: "ready", started_at: "" });

/**
 * Push the score while the match is still on court, without ending it.
 *
 * `saveGames` is how a set-scored match reaches the wall mid-match; a match
 * with no sets has nothing else that writes before the final `saveResult`, so
 * without this its score sits at whatever it was when it went live until
 * somebody taps Save — a scoreboard that only ever shows the final score.
 * Status is left alone: only `saveResult` ends a match, the same way only a
 * completed set's row does under `saveGames`.
 */
export const saveOngoingScore = (
  session: Session,
  fixture: Id,
  homeScore: number,
  awayScore: number,
) =>
  update<Fixture>(session, "fixtures", fixture, {
      home_score: homeScore,
      away_score: awayScore,
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
  send<{ entry: Id; status: string; policy: string }>(
    session,
    `/api/entries/${entry}/withdraw`,
    { method: "POST", body: { policy, status } },
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
  send<{ entry: Id; stages: Admission[] }>(session, `/api/entries/${entry}/admit`, {
    method: "POST",
  });

/**
 * Put one back.
 *
 * Undoes what taking them out did and nothing else — the server tracks which
 * fixtures their exit closed, so a walkover the organiser recorded on purpose
 * an hour beforehand survives this untouched.
 */
export const reinstateEntry = (session: Session, entry: Id) =>
  send<{ entry: Id; status: string }>(session, `/api/entries/${entry}/reinstate`, {
    method: "POST",
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
    { filter: filter("tournament = {:v}", { v: tournament }), sort: "created" },
  );

/**
 * Take somebody off the crew.
 *
 * This is the revocation that matters day to day: one person, one row, and the
 * device in their pocket stops being able to write the moment it is gone.
 * Withdrawing the *link* is a different question — see `resetInvite`.
 */
export const removeStaff = (session: Session, id: Id) =>
  remove(session, "staff", id);

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
    {
      filter: filter("tournament = {:t} && role = {:r} && active = true", {
        t: tournament,
        r: role,
      }),
    },
  );
  if (existing[0]) return existing[0];

  return create<Invite>(session, "invites", { tournament, token: randomString(22), role, active: true });
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
    {
      filter: filter("tournament = {:t} && role = {:r} && active = true", {
        t: tournament,
        r: role,
      }),
    },
  );

  for (const invite of live) {
    await update<Invite>(session, "invites", invite.id, { active: false });
  }

  return ensureInvite(session, tournament, role);
}

/** What a join code is for, read before anyone signs up to anything. */
export const previewInvite = (token: string) =>
  send<{ name: string; role: StaffRole }>(null, `/api/staff/invite/${token}`);

// ---------------------------------------------------------------------------
// being handed a tournament
// ---------------------------------------------------------------------------

/**
 * What a handoff link is for, before anybody accepts it.
 *
 * Public, like the invite preview: the token is the credential, and a screen
 * that could not name the tournament would be asking somebody to accept a
 * blank cheque.
 */
export const previewHandoff = (token: string) =>
  send<{ tournament: string }>(null, `/api/organiser/handoff/${token}`);

/**
 * Take the tournament.
 *
 * The account being claimed is not this device's — it belongs to whatever made
 * the tournament, usually an agent — so there is no session to send and none
 * comes back. The link is the authority, and the way in afterwards is the
 * email and password just set, which is why this signs in rather than
 * returning a token: `RefreshTokenKey` on the server has already invalidated
 * everything that existed before this call.
 */
export async function claimHandoff(
  token: string,
  email: string,
  password: string,
): Promise<{ session: Session; tournament: Id }> {
  const claimed = await send<{ email: string; tournament: Id }>(
    null,
    `/api/organiser/handoff/${token}/claim`,
    { method: "POST", body: { email, password } },
  );
  return {
    session: await signIn(email, password),
    tournament: claimed.tournament,
  };
}

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
  send<JoinResult>(session, "/api/staff/join", {
    method: "POST",
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
