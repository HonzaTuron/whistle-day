#!/usr/bin/env bun
/**
 * End-to-end check of the Go slot resolver against a real PocketBase instance.
 *
 * Boots the server on a throwaway data dir, drives it over the REST API, and
 * asserts that closing a fixture propagates into the slots that depend on it.
 * Nothing here touches your development pb_data.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const BACKEND = new URL("../backend/", import.meta.url).pathname;
const BIN = `${BACKEND}pocketbase`;
const PORT = 8099;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = { identity: "smoke@seedly.local", password: "smokesmoke123" };

let passed = 0;
const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown) {
  if (Bun.deepEquals(actual, expected)) {
    console.log(`  ok   ${label}`);
    passed++;
  } else {
    console.log(`  FAIL ${label}`);
    console.log(`       expected ${JSON.stringify(expected)}`);
    console.log(`       actual   ${JSON.stringify(actual)}`);
    failures.push(label);
  }
}

let token = "";

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}\n${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const create = (collection: string, data: Record<string, unknown>) =>
  api("POST", `/api/collections/${collection}/records`, data);
const patch = (collection: string, id: string, data: Record<string, unknown>) =>
  api("PATCH", `/api/collections/${collection}/records/${id}`, data);
const get = (collection: string, id: string) =>
  api("GET", `/api/collections/${collection}/records/${id}`);

// ---------------------------------------------------------------------------

const dataDir = await mkdtemp(join(tmpdir(), "seedly-smoke-"));
console.log(`data dir: ${dataDir}\n`);

await $`${BIN} superuser upsert ${ADMIN.identity} ${ADMIN.password} --dir=${dataDir}`.quiet();

const server = Bun.spawn(
  [BIN, "serve", `--http=127.0.0.1:${PORT}`, `--dir=${dataDir}`],
  { stdout: "pipe", stderr: "pipe" },
);

async function shutdown() {
  server.kill();
  await server.exited;
  await rm(dataDir, { recursive: true, force: true });
}

try {
  // wait for readiness
  for (let i = 0; ; i++) {
    try {
      await fetch(`${BASE}/api/health`);
      break;
    } catch {
      if (i > 100) throw new Error("server did not start");
      await Bun.sleep(100);
    }
  }

  const auth = await api("POST", "/api/collections/_superusers/auth-with-password", ADMIN);
  token = auth.token;

  const organiser = await create("users", {
    email: "organiser@seedly.local",
    password: "organiser123",
    passwordConfirm: "organiser123",
  });

  const tournament = await create("tournaments", {
    name: "Smoke Cup",
    slug: `smoke-${Date.now()}`,
    status: "published",
    owner: organiser.id,
  });

  const entry = async (name: string) =>
    create("entries", { tournament: tournament.id, name, status: "active" });

  // =====================================================================
  console.log("1. single elimination: winners propagate into the next round");
  // =====================================================================
  const [a, b, c, d] = await Promise.all([entry("A"), entry("B"), entry("C"), entry("D")]);

  const stage1 = await create("stages", {
    tournament: tournament.id,
    position: 0,
    name: "Playoff",
    format: "single_elim",
    status: "seeded",
  });
  const pool1 = await create("pools", {
    stage: stage1.id, name: "Main", position: 0, kind: "winners",
  });

  const seedSlot = async (position: number, entryId: string) =>
    create("slots", {
      stage: stage1.id, pool: pool1.id, round: 0, position,
      source_type: "direct", entry: entryId,
    });

  const [s0, s1, s2, s3] = await Promise.all([
    seedSlot(0, a.id), seedSlot(1, b.id), seedSlot(2, c.id), seedSlot(3, d.id),
  ]);

  const semi = async (position: number, home: any, away: any, homeSlot: any, awaySlot: any) =>
    create("fixtures", {
      tournament: tournament.id, stage: stage1.id, pool: pool1.id,
      round: 0, position, code: `SF${position + 1}`, status: "ready",
      home_slot: homeSlot.id, away_slot: awaySlot.id,
      home_entry: home.id, away_entry: away.id,
    });

  const sf1 = await semi(0, a, b, s0, s1);
  const sf2 = await semi(1, c, d, s2, s3);

  // The final's slots exist before either semi has been played — this is the
  // whole point of the slot table.
  const w1 = await create("slots", {
    stage: stage1.id, pool: pool1.id, round: 1, position: 0,
    source_type: "fixture_winner", source_fixture: sf1.id, label: "Winner SF1",
  });
  const w2 = await create("slots", {
    stage: stage1.id, pool: pool1.id, round: 1, position: 1,
    source_type: "fixture_winner", source_fixture: sf2.id, label: "Winner SF2",
  });
  const final = await create("fixtures", {
    tournament: tournament.id, stage: stage1.id, pool: pool1.id,
    round: 1, position: 0, code: "F", status: "pending",
    home_slot: w1.id, away_slot: w2.id,
  });

  check("final starts unresolved", (await get("fixtures", final.id)).home_entry, "");

  // A beats B 2:0
  const sf1Done = await patch("fixtures", sf1.id, {
    status: "finished", home_score: 2, away_score: 0,
  });
  check("winner derived from score", sf1Done.winner, a.id);
  check("loser derived from score", sf1Done.loser, b.id);
  check("winner slot resolved", (await get("slots", w1.id)).entry, a.id);
  check("final home side filled", (await get("fixtures", final.id)).home_entry, a.id);
  check("final still pending with one side", (await get("fixtures", final.id)).status, "pending");

  // D beats C 0:2
  await patch("fixtures", sf2.id, { status: "finished", home_score: 0, away_score: 2 });
  const finalReady = await get("fixtures", final.id);
  check("final away side filled", finalReady.away_entry, d.id);
  check("final becomes ready once both sides are known", finalReady.status, "ready");

  // Correcting a result must re-propagate, not strand the old winner.
  await patch("fixtures", sf1.id, { status: "finished", home_score: 0, away_score: 2 });
  check("corrected score re-resolves the slot", (await get("slots", w1.id)).entry, b.id);
  check("corrected score updates the final", (await get("fixtures", final.id)).home_entry, b.id);

  // =====================================================================
  console.log("\n2. byes settle themselves");
  // =====================================================================
  const e = await entry("E");
  const stage2 = await create("stages", {
    tournament: tournament.id, position: 1, name: "Qualifier",
    format: "single_elim", status: "seeded",
  });
  const pool2 = await create("pools", {
    stage: stage2.id, name: "Main", position: 0, kind: "winners",
  });
  const sE = await create("slots", {
    stage: stage2.id, pool: pool2.id, round: 0, position: 0,
    source_type: "direct", entry: e.id,
  });
  const sBye = await create("slots", {
    stage: stage2.id, pool: pool2.id, round: 0, position: 1,
    source_type: "bye", label: "Bye",
  });
  const qb = await create("fixtures", {
    tournament: tournament.id, stage: stage2.id, pool: pool2.id,
    round: 0, position: 0, code: "R1", status: "pending",
    home_slot: sE.id, away_slot: sBye.id,
  });
  const wBye = await create("slots", {
    stage: stage2.id, pool: pool2.id, round: 1, position: 0,
    source_type: "fixture_winner", source_fixture: qb.id, label: "Winner R1",
  });

  const qbSettled = await patch("fixtures", qb.id, { home_entry: e.id });
  check("fixture against a bye settles itself", qbSettled.status, "bye");
  check("the present side wins the bye", qbSettled.winner, e.id);
  check("bye winner advances", (await get("slots", wBye.id)).entry, e.id);

  // =====================================================================
  console.log("\n3. ResolveStage repairs out-of-order writes");
  // =====================================================================
  const [f1, f2] = await Promise.all([entry("F1"), entry("F2")]);
  const stage3 = await create("stages", {
    tournament: tournament.id, position: 2, name: "Repair",
    format: "single_elim", status: "seeded",
  });
  const pool3 = await create("pools", {
    stage: stage3.id, name: "Main", position: 0, kind: "winners",
  });
  const played = await create("fixtures", {
    tournament: tournament.id, stage: stage3.id, pool: pool3.id,
    round: 0, position: 0, code: "R1", status: "finished",
    home_entry: f1.id, away_entry: f2.id, home_score: 2, away_score: 1,
  });

  // Slot created AFTER the fixture was already settled: the event-driven path
  // cannot have seen it.
  const late = await create("slots", {
    stage: stage3.id, pool: pool3.id, round: 1, position: 0,
    source_type: "fixture_winner", source_fixture: played.id,
  });
  check("late slot is missed by event propagation", (await get("slots", late.id)).entry, "");

  const repair = await api("POST", `/api/stages/${stage3.id}/resolve`);
  check("resolve reports the settled fixture", repair.resolved, 1);
  check("late slot is repaired", (await get("slots", late.id)).entry, f1.id);

  const again = await api("POST", `/api/stages/${stage3.id}/resolve`);
  check("resolve is idempotent", again.resolved, 1);
  check("repeated resolve changes nothing", (await get("slots", late.id)).entry, f1.id);
} catch (error) {
  console.error("\nsmoke run threw:");
  console.error(error instanceof Error ? error.message : error);
  failures.push("unhandled error");
} finally {
  await shutdown();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
