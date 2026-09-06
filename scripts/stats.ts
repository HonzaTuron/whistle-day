/**
 * The operating numbers, read straight out of the database.
 *
 * Most of what a product-analytics tool would be installed to answer is
 * already here as domain data: a tournament records how far it got, a stage
 * records which format was picked, an entry records whether somebody went
 * home and under which policy, and `fixture_events` has recorded every result
 * change since the day it was added. Sending all of that to a third party so
 * it can be counted there would be re-recording what the schema already
 * stores, and would put a consent question in front of it on the way.
 *
 * So this is a read-only report rather than a pipeline. It opens the same
 * SQLite file the server uses, in read-only mode, and asks it questions. It
 * takes no locks worth the name and writes nothing, which matters: SQLite has
 * one writer, and during a live tournament that writer is busy propagating a
 * result through slots, tables and a bracket. Nothing in here may compete
 * with that.
 *
 *   bun run stats
 *   bun run stats -- /path/to/other/pb_data/data.db
 *
 * What is deliberately NOT here: anything about a visitor. Who read a
 * marketing page and where they came from is Plausible's, on the marketing
 * pages only — see `Analytics` in `apps/web/src/routes/__root.tsx`. The two
 * do not overlap and neither wants to be the other.
 */

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_DB = join(import.meta.dir, "..", "backend", "pb_data", "data.db");

/**
 * Mirrors `DeviceAccountDomain` in `backend/internal/tournament/routes.go`.
 * The client keeps a third copy; all three have to say the same thing, and
 * this one only decides a number in a report.
 */
const DEVICE_SUFFIX = "@device.whistleday.local";

/** A settled fixture is one that will not change the table again. */
const SETTLED = "('finished', 'walkover', 'bye')";

const path = process.argv[2] ?? DEFAULT_DB;

if (!existsSync(path)) {
  console.error(`no database at ${path}`);
  console.error("run `bun run pb:migrate` first, or pass a path.");
  process.exit(1);
}

const db = new Database(path, { readonly: true });

const one = <T = number,>(sql: string, fallback: T): T => {
  const row = db.query(sql).get() as Record<string, unknown> | null;
  const value = row ? Object.values(row)[0] : null;
  return (value ?? fallback) as T;
};

const rows = <T,>(sql: string): T[] => db.query(sql).all() as T[];

const pct = (part: number, whole: number) =>
  whole === 0 ? "  — " : `${((part / whole) * 100).toFixed(0).padStart(3)}%`;

const heading = (text: string) => console.log(`\n${text}\n${"─".repeat(text.length)}`);

const row = (label: string, value: string | number, note = "") =>
  console.log(`  ${label.padEnd(34)} ${String(value).padStart(6)}  ${note}`);

/** The middle value, which is the honest one for counts with a long tail. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : (sorted[mid] ?? 0);
}

// ---------------------------------------------------------------------------

console.log(`\nWhistle.day — operating numbers`);
console.log(`${path}`);

// ---------------------------------------------------------------------------
// How far a tournament got.
//
// The funnel that matters, and the one an event tracker would be installed to
// draw. Each step is a fact about the tournament rather than a beacon that
// may or may not have been sent: "drew a stage" is a stage out of draft, not
// somebody having reached a screen.
// ---------------------------------------------------------------------------

heading("How far tournaments got");

const created = one("SELECT COUNT(*) FROM tournaments", 0);

const withTeams = one(
  `SELECT COUNT(*) FROM (
     SELECT tournament FROM entries GROUP BY tournament HAVING COUNT(*) >= 2
   )`,
  0,
);

const drawn = one(
  `SELECT COUNT(DISTINCT tournament) FROM stages WHERE status != 'draft'`,
  0,
);

const played = one(
  `SELECT COUNT(DISTINCT tournament) FROM fixtures WHERE status IN ${SETTLED}`,
  0,
);

// Every fixture settled, which is what "the day finished" means whatever the
// organiser remembered to set the status to afterwards.
const completed = one(
  `SELECT COUNT(*) FROM (
     SELECT tournament FROM fixtures
     GROUP BY tournament
     HAVING SUM(CASE WHEN status IN ${SETTLED} THEN 0 ELSE 1 END) = 0
   )`,
  0,
);

row("created", created, pct(created, created));
row("two teams or more", withTeams, pct(withTeams, created));
row("drew a stage", drawn, pct(drawn, created));
row("played a match", played, pct(played, created));
row("played every match", completed, pct(completed, created));

if (created > 0 && drawn < created) {
  console.log(
    `\n  ${created - drawn} never drew. That gap is the wizard's, and it is the\n` +
      `  one number here that does not say why.`,
  );
}

// ---------------------------------------------------------------------------

heading("What people run");

for (const r of rows<{ sport: string; n: number }>(
  `SELECT COALESCE(NULLIF(sport, ''), '(unset)') AS sport, COUNT(*) AS n
   FROM tournaments GROUP BY sport ORDER BY n DESC, sport`,
)) {
  row(r.sport, r.n, pct(r.n, created));
}

heading("Formats drawn");

const stagesTotal = one("SELECT COUNT(*) FROM stages WHERE status != 'draft'", 0);

for (const r of rows<{ format: string; n: number }>(
  `SELECT format, COUNT(*) AS n FROM stages
   WHERE status != 'draft' GROUP BY format ORDER BY n DESC, format`,
)) {
  row(r.format, r.n, pct(r.n, stagesTotal));
}

const multi = one(
  `SELECT COUNT(*) FROM (
     SELECT tournament FROM stages WHERE status != 'draft'
     GROUP BY tournament HAVING COUNT(*) > 1
   )`,
  0,
);
row("more than one stage", multi, pct(multi, drawn));

// ---------------------------------------------------------------------------

heading("Field and day");

const fieldSizes = rows<{ n: number }>(
  `SELECT COUNT(*) AS n FROM entries GROUP BY tournament`,
).map((r) => r.n);

row("median teams", median(fieldSizes));
row("largest field", fieldSizes.length ? Math.max(...fieldSizes) : 0);

const courts = rows<{ n: number }>(
  `SELECT COUNT(*) AS n FROM courts GROUP BY tournament`,
).map((r) => r.n);
row("median courts", median(courts));

// First to last result, which is the answer the "how many courts do I need"
// guide is really being asked for.
const spans = rows<{ minutes: number }>(
  `SELECT (julianday(MAX(finished_at)) - julianday(MIN(finished_at))) * 24 * 60 AS minutes
   FROM fixtures
   WHERE status IN ${SETTLED} AND finished_at != ''
   GROUP BY tournament`,
)
  .map((r) => Math.round(r.minutes))
  .filter((m) => m > 0);

if (spans.length > 0) {
  const m = median(spans);
  row("median day length", `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`);
}

// ---------------------------------------------------------------------------

heading("Screens and crew");

const withScreen = one(`SELECT COUNT(DISTINCT tournament) FROM displays`, 0);
const activeScreens = one(
  `SELECT COUNT(*) FROM displays WHERE active IN (1, 'true')`,
  0,
);
row("tournaments with a screen", withScreen, pct(withScreen, created));
row("active screens", activeScreens);

const withCrew = one(`SELECT COUNT(DISTINCT tournament) FROM staff`, 0);
row("tournaments with crew", withCrew, pct(withCrew, created));

for (const r of rows<{ role: string; n: number }>(
  `SELECT role, COUNT(*) AS n FROM staff GROUP BY role ORDER BY n DESC`,
)) {
  row(`  ${r.role}`, r.n);
}

// ---------------------------------------------------------------------------
// Whether an organiser can still get in tomorrow.
//
// An unclaimed device account lives in one browser and nowhere else, so this
// is not a vanity number: it is the count of people one cleared cache away
// from losing a tournament they cannot be given back.
// ---------------------------------------------------------------------------

heading("Accounts");

const device = one(
  `SELECT COUNT(*) FROM users WHERE email LIKE '%${DEVICE_SUFFIX}'`,
  0,
);
const claimed = one(
  `SELECT COUNT(*) FROM users WHERE email NOT LIKE '%${DEVICE_SUFFIX}'`,
  0,
);

row("claimed an email", claimed, pct(claimed, claimed + device));
row("device only", device, pct(device, claimed + device));

if (device > 0) {
  console.log(
    `\n  ${device} account${device === 1 ? "" : "s"} exist${device === 1 ? "s" : ""} in one browser and nowhere else.`,
  );
}

// ---------------------------------------------------------------------------

heading("Results");

const settled = one(`SELECT COUNT(*) FROM fixtures WHERE status IN ${SETTLED}`, 0);
row("settled fixtures", settled);

const events = rows<{ kind: string; n: number }>(
  `SELECT kind, COUNT(*) AS n FROM fixture_events GROUP BY kind ORDER BY n DESC`,
);
const recorded = events.find((e) => e.kind === "recorded")?.n ?? 0;

for (const e of events) {
  row(`  ${e.kind}`, e.n, e.kind === "corrected" ? pct(e.n, recorded) : "");
}

const walkovers = one(
  `SELECT COUNT(*) FROM fixtures WHERE status = 'walkover'`,
  0,
);
const forfeited = one(
  `SELECT COUNT(*) FROM fixtures WHERE forfeited_by != ''`,
  0,
);
row("walkovers", walkovers, `${forfeited} from somebody leaving`);

const withdrawals = rows<{ policy: string; n: number }>(
  `SELECT COALESCE(NULLIF(withdrawal, ''), '(unset)') AS policy, COUNT(*) AS n
   FROM entries WHERE status = 'withdrawn' GROUP BY policy ORDER BY n DESC`,
);
for (const w of withdrawals) row(`withdrawn — ${w.policy}`, w.n);

console.log();

db.close();
