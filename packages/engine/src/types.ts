/**
 * Seedly domain types.
 *
 * These mirror the PocketBase collections in
 * backend/pb_migrations/1787270400_init_schema.js one-to-one. If you change a
 * field there, change it here — nothing enforces it automatically yet.
 */

export type Id = string;
/** PocketBase serialises dates as "2026-08-21 14:30:00.000Z". */
export type IsoDate = string;

// ---------------------------------------------------------------------------
// tournaments
// ---------------------------------------------------------------------------

export type TournamentStatus =
  | "draft"
  | "published"
  | "live"
  | "finished"
  | "archived";

export interface ScoringConfig {
  /** Sets per fixture. 1 = a single game decides it. */
  bestOf: number;
  pointsPerSet?: number;
  winBy?: number;
  /** League points awarded in round-robin stages. */
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  /**
   * Credited to whoever turned up when the other side did not. Zero unless a
   * rulebook says otherwise, so an absence never flatters a goal difference.
   */
  walkoverScore?: number;
  /** Ordered tiebreak criteria, applied left to right. */
  tiebreakers: Tiebreaker[];
}

export type Tiebreaker =
  | "points"
  | "head_to_head"
  | "score_diff"
  | "score_for"
  | "sub_diff"
  | "wins"
  | "seed"
  | "draw";

export interface Tournament {
  id: Id;
  name: string;
  slug: string;
  sport: string;
  location: string;
  starts_on: IsoDate | "";
  ends_on: IsoDate | "";
  status: TournamentStatus;
  owner: Id;
  logo: string;
  scoring: ScoringConfig;
  settings: {
    timezone?: string;
    public_results?: boolean;
    allow_self_registration?: boolean;
  };
}

export type StaffRole = "organizer" | "referee" | "scorer";

export interface Staff {
  id: Id;
  tournament: Id;
  user: Id;
  role: StaffRole;
}

export interface Court {
  id: Id;
  tournament: Id;
  name: string;
  position: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// entries
// ---------------------------------------------------------------------------

export type EntryStatus =
  | "registered"
  | "checked_in"
  | "active"
  | "withdrawn"
  | "disqualified";

export interface Entry {
  id: Id;
  tournament: Id;
  name: string;
  /** What the projector renders. Keep it under ~16 chars. */
  short_name: string;
  club: string;
  contact: string;
  seed: number | null;
  status: EntryStatus;
  logo: string;
  members: { name: string; role?: string }[];
}

// ---------------------------------------------------------------------------
// stages + pools
// ---------------------------------------------------------------------------

export type StageFormat =
  | "round_robin"
  | "single_elim"
  | "double_elim"
  | "swiss"
  | "ladder";

export type StageStatus = "draft" | "seeded" | "live" | "finished";

/**
 * Where a stage's participants come from. Present means the stage is fed by an
 * earlier stage's pool tables rather than by the raw entry list — this is the
 * "groups feed the playoff" wiring.
 */
export interface SeedSource {
  stage: Id;
  advancePerPool: number;
}

export interface StageConfig {
  /** round_robin */
  poolCount?: number;
  advancePerPool?: number;
  /** How many times every pair meets. 2 = home and away. */
  legs?: number;
  /** single_elim / double_elim */
  thirdPlace?: boolean;
  consolation?: boolean;
  /** swiss */
  rounds?: number;
  /** Seed this stage from an earlier stage's tables. */
  seedFrom?: SeedSource;
}

export interface Stage {
  id: Id;
  tournament: Id;
  /** 0-based. This — and only this — decides groups-first vs playoff-first. */
  position: number;
  name: string;
  format: StageFormat;
  status: StageStatus;
  config: StageConfig;
}

export type PoolKind = "group" | "winners" | "losers" | "final" | "consolation";

/**
 * A self-contained sub-competition inside a stage: one round-robin group, or
 * one side of a double-elimination bracket.
 */
export interface Pool {
  id: Id;
  stage: Id;
  name: string;
  position: number;
  kind: PoolKind;
  advance_count: number | null;
}

// ---------------------------------------------------------------------------
// slots — the placeholder mechanism
// ---------------------------------------------------------------------------

export type SlotSourceType =
  | "direct"
  | "fixture_winner"
  | "fixture_loser"
  | "pool_rank"
  | "stage_rank"
  | "bye";

/**
 * A fillable position. `entry` stays null until `source_*` resolves, which is
 * what lets a full bracket be drawn and projected before it is played.
 */
export interface Slot {
  id: Id;
  stage: Id;
  pool: Id | null;
  round: number;
  position: number;
  /** Rendered while unresolved: "Winner QF1", "1. A", "Bye". */
  label: string;
  entry: Id | null;
  source_type: SlotSourceType;
  source_fixture: Id | null;
  source_pool: Id | null;
  source_stage: Id | null;
  /** Which place in the source table/bracket, 1-based. */
  source_position: number | null;
}

// ---------------------------------------------------------------------------
// fixtures + games
// ---------------------------------------------------------------------------

export type FixtureStatus =
  | "pending"
  | "ready"
  | "live"
  | "finished"
  | "walkover"
  | "bye"
  | "cancelled";

export interface Fixture {
  id: Id;
  tournament: Id;
  stage: Id;
  pool: Id | null;
  round: number;
  position: number;
  /** Human handle: "QF1", "A3". Shown on the projector and on paper sheets. */
  code: string;
  home_slot: Id | null;
  away_slot: Id | null;
  /** Denormalised from the slots so the projector needs one query, one expand. */
  home_entry: Id | null;
  away_entry: Id | null;
  status: FixtureStatus;
  home_score: number | null;
  away_score: number | null;
  winner: Id | null;
  loser: Id | null;
  court: Id | null;
  referee: Id | null;
  scheduled_at: IsoDate | "";
  started_at: IsoDate | "";
  finished_at: IsoDate | "";
  locked: boolean;
  notes: string;
}

/**
 * An append-only note of somebody changing a result.
 *
 * A fixture holds one score and overwriting it destroys the previous one; the
 * tables are rebuilt from scratch every time precisely so that a correction
 * leaves no trace in them. This is where the trace lives instead.
 */
export interface FixtureEvent {
  id: Id;
  fixture: Id;
  actor: Id | null;
  kind: "recorded" | "corrected" | "cleared";
  status: FixtureStatus | "";
  home_score: number | null;
  away_score: number | null;
  winner: Id | null;
  /** What it was before this change. */
  previous: {
    status?: string;
    home_score?: number;
    away_score?: number;
    winner?: string;
  } | null;
  created: IsoDate;
}

/** One set / leg / map inside a fixture. */
export interface Game {
  id: Id;
  fixture: Id;
  number: number;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
}

// ---------------------------------------------------------------------------
// standings
// ---------------------------------------------------------------------------

export interface Standing {
  id: Id;
  stage: Id;
  pool: Id | null;
  entry: Id;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** Sets won/lost (or goals, depending on sport). */
  score_for: number;
  score_against: number;
  /** Points inside sets — the usual second-level tiebreak. */
  sub_for: number;
  sub_against: number;
  points: number;
  /** Audit trail: which criteria were applied and in what order. */
  tiebreak: { applied: Tiebreaker[]; note?: string };
  qualified: boolean;
}

// ---------------------------------------------------------------------------
// displays
// ---------------------------------------------------------------------------

export type DisplayMode =
  | "auto"
  | "bracket"
  | "standings"
  | "schedule"
  | "now_playing"
  | "results";

export interface Display {
  id: Id;
  tournament: Id;
  name: string;
  /** Unguessable URL token — this is the screen's only credential. */
  token: string;
  mode: DisplayMode;
  rotate_seconds: number;
  scope: { stage?: Id; pool?: Id; court?: Id };
  theme: { accent?: string; logo?: string; sponsors?: string[] };
  active: boolean;
}

// ---------------------------------------------------------------------------
// plan drafts — the wire format of POST /api/stages/{stage}/generate
//
// These mirror the Go structs in backend/internal/tournament/generate.go. The
// generators run on the server; `?dry_run=1` returns this shape without
// writing, which is how the organiser previews a draw.
// ---------------------------------------------------------------------------

/** A generator-scoped key wiring drafts together before ids exist. */
export type DraftKey = string;

export interface PoolDraft {
  key: DraftKey;
  name: string;
  position: number;
  kind: PoolKind;
  advance_count: number;
}

export interface SlotDraft {
  key: DraftKey;
  pool_key: DraftKey;
  round: number;
  position: number;
  label: string;
  entry: Id;
  source_type: SlotSourceType;
  source_fixture_key: DraftKey;
  source_pool: Id;
  source_stage: Id;
  source_position: number;
}

export interface FixtureDraft {
  key: DraftKey;
  pool_key: DraftKey;
  round: number;
  position: number;
  code: string;
  home_slot_key: DraftKey;
  away_slot_key: DraftKey;
  status: FixtureStatus;
}

/** Everything one stage needs, written in a single transaction on commit. */
export interface StagePlan {
  pools: PoolDraft[];
  slots: SlotDraft[];
  fixtures: FixtureDraft[];
}

export interface GenerateDryRunResponse {
  stage: Id;
  dry_run: true;
  plan: StagePlan;
}

export interface GenerateCommitResponse {
  stage: Id;
  pools: number;
  slots: number;
  fixtures: number;
}

export interface ResolveResponse {
  stage: Id;
  resolved: number;
}

// ---------------------------------------------------------------------------
// projector payload — the wire format of GET /api/display/{token}
//
// Mirrors the Go structs in backend/internal/tournament/display.go. One
// request replaces subscribing to five collections and joining them in the
// browser. Public: the token in the URL is the only credential.
//
// Poll it with the returned ETag in `If-None-Match`; an unchanged tournament
// answers 304.
// ---------------------------------------------------------------------------

export interface DisplayEntry {
  id: Id;
  name: string;
  short_name: string;
  club: string;
  logo: string;
  seed: number;
}

export interface DisplayCourt {
  id: Id;
  name: string;
  position: number;
}

/**
 * One half of a fixture. `entry` is empty until the slot resolves, and `label`
 * always carries something renderable ("Winner QF1", "1. A", "TBD") — a screen
 * never has to draw a blank box.
 */
export interface DisplaySide {
  entry: Id | "";
  label: string;
  score: number;
}

export interface DisplayGame {
  number: number;
  home: number;
  away: number;
}

export interface DisplayFixture {
  id: Id;
  code: string;
  stage: Id;
  pool: Id | "";
  round: number;
  position: number;
  status: FixtureStatus;
  home: DisplaySide;
  away: DisplaySide;
  winner: Id | "";
  court: Id | "";
  scheduled_at: IsoDate | "";
  games?: DisplayGame[];
}

export interface DisplayStanding {
  position: number;
  entry: Id;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  score_for: number;
  score_against: number;
  points: number;
  qualified: boolean;
  /**
   * Which criteria were needed to place this row, in order. Only interesting
   * when a table has a tie — "why are they above us" is the question that
   * starts arguments in a hall.
   */
  tiebreak: Tiebreaker[] | null;
}

export interface DisplayRound {
  round: number;
  fixtures: DisplayFixture[];
}

export interface DisplayPool {
  id: Id;
  name: string;
  kind: PoolKind;
  advance_count: number;
  standings: DisplayStanding[];
  rounds: DisplayRound[];
}

export interface DisplayStage {
  id: Id;
  position: number;
  name: string;
  format: StageFormat;
  status: StageStatus;
  pools: DisplayPool[];
}

export interface DisplayTheme {
  accent?: string;
  logo?: string;
  sponsors?: string[];
}

export interface DisplayPayload {
  generated_at: IsoDate;
  tournament: {
    id: Id;
    name: string;
    sport: string;
    location: string;
    logo: string;
    status: TournamentStatus;
  };
  display: {
    id: Id;
    name: string;
    mode: DisplayMode;
    rotate_seconds: number;
    scope: { stage?: Id; pool?: Id; court?: Id };
    theme: DisplayTheme | null;
  };
  /** Sent once, referenced by id everywhere else. */
  entries: Record<Id, DisplayEntry>;
  courts: DisplayCourt[];
  stages: DisplayStage[];
  now_playing: DisplayFixture[];
  next_up: DisplayFixture[];
  recent: DisplayFixture[];
}
