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
// The compiled server, which `bun run smoke` rebuilds first. It used to run
// whatever binary happened to be lying there: a backend change could pass the
// smoke run without ever being in it, which is the one thing this script
// exists to make impossible.
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
  // =====================================================================
  console.log("\n4. generation runs on the server, preview and commit alike");
  // =====================================================================
  const cup = await create("tournaments", {
    name: "Group Cup",
    slug: `groups-${Date.now()}`,
    status: "published",
    owner: organiser.id,
    scoring: { pointsWin: 3, pointsDraw: 1, pointsLoss: 0 },
  });

  // Eight seeded entries so the snake distribution is deterministic.
  const teams: Record<string, any> = {};
  for (let i = 1; i <= 8; i++) {
    teams[`T${i}`] = await create("entries", {
      tournament: cup.id, name: `T${i}`, seed: i, status: "active",
    });
  }
  const teamName = (id: string) =>
    Object.entries(teams).find(([, t]) => t.id === id)?.[0] ?? "?";

  const groups = await create("stages", {
    tournament: cup.id, position: 0, name: "Groups",
    format: "round_robin", status: "draft",
    config: { poolCount: 2, advancePerPool: 2 },
  });

  const preview = await api("POST", `/api/stages/${groups.id}/generate?dry_run=1`);
  check("dry run reports itself", preview.dry_run, true);
  check("dry run plans two pools", preview.plan.pools.length, 2);
  check("dry run plans 2x6 fixtures", preview.plan.fixtures.length, 12);

  const beforeCommit = await api(
    "GET", `/api/collections/fixtures/records?filter=(stage='${groups.id}')`);
  check("dry run wrote nothing", beforeCommit.totalItems, 0);

  const committed = await api("POST", `/api/stages/${groups.id}/generate`);
  check("commit creates the planned fixtures", committed.fixtures, 12);
  check("commit creates the planned pools", committed.pools, 2);

  // =====================================================================
  console.log("\n5. standings, tiebreaks and pool_rank slots");
  // =====================================================================
  const playoff = await create("stages", {
    tournament: cup.id, position: 1, name: "Playoff",
    format: "single_elim", status: "draft",
    config: { seedFrom: { stage: groups.id, advancePerPool: 2 }, thirdPlace: true },
  });
  await api("POST", `/api/stages/${playoff.id}/generate`);

  const poolList = await api(
    "GET", `/api/collections/pools/records?filter=(stage='${groups.id}')&sort=position`);
  const [poolA, poolB] = poolList.items;

  const playoffFixtures = await api(
    "GET",
    `/api/collections/fixtures/records?filter=(stage='${playoff.id}')&sort=round,position&expand=home_slot,away_slot`,
  );
  const semis = playoffFixtures.items.filter((f: any) => f.round === 0);
  check("playoff has two semi-finals", semis.length, 2);
  check(
    "playoff slots start unresolved",
    semis.every((f: any) => f.home_entry === "" && f.away_entry === ""),
    true,
  );
  check(
    "no semi pairs two teams from the same pool",
    semis.every(
      (f: any) => f.expand.home_slot.source_pool !== f.expand.away_slot.source_pool,
    ),
    true,
  );

  // Play every group fixture. T1/T4 are in pool A, T2/T3 in pool B (snake).
  // Lower-numbered (better-seeded) team always wins, so the tables are known.
  const groupFixtures = await api(
    "GET", `/api/collections/fixtures/records?filter=(stage='${groups.id}')&sort=round,position`);

  for (const f of groupFixtures.items) {
    const home = Number(teamName(f.home_entry).slice(1));
    const away = Number(teamName(f.away_entry).slice(1));
    await patch("fixtures", f.id, {
      status: "finished",
      home_score: home < away ? 2 : 0,
      away_score: home < away ? 0 : 2,
    });
  }

  const tableA = await api(
    "GET", `/api/collections/standings/records?filter=(pool='${poolA.id}')&sort=position`);
  check("pool A table has four rows", tableA.items.length, 4);
  check("pool A is won by its top seed", teamName(tableA.items[0].entry), "T1");
  check("pool A winner took maximum points", tableA.items[0].points, 9);
  check("pool A winner played three", tableA.items[0].played, 3);
  check("pool A runner-up", teamName(tableA.items[1].entry), "T4");
  check("top two qualify", tableA.items.map((r: any) => r.qualified), [true, true, false, false]);
  check("the table records how it was ranked", tableA.items[0].tiebreak.applied, ["points"]);

  const tableB = await api(
    "GET", `/api/collections/standings/records?filter=(pool='${poolB.id}')&sort=position`);
  check("pool B is won by its top seed", teamName(tableB.items[0].entry), "T2");
  check("pool B runner-up", teamName(tableB.items[1].entry), "T3");

  // With both pools complete, the playoff slots must now be filled.
  const resolvedSemis = await api(
    "GET", `/api/collections/fixtures/records?filter=(stage='${playoff.id}')&sort=round,position`);
  const pairings = resolvedSemis.items
    .filter((f: any) => f.round === 0)
    .map((f: any) => `${teamName(f.home_entry)}v${teamName(f.away_entry)}`)
    .sort();

  // A1=T1 A2=T4 B1=T2 B2=T3, seeded [A1 B1 A2 B2] -> pairs (A1,B2) and (B1,A2).
  check("pool winners meet the other pool's runner-up", pairings, ["T1vT3", "T2vT4"]);
  check(
    "resolved semis are ready to play",
    resolvedSemis.items.filter((f: any) => f.round === 0).every((f: any) => f.status === "ready"),
    true,
  );

  // =====================================================================
  console.log("\n6. regenerating a played stage is refused");
  // =====================================================================
  let refused = false;
  try {
    await api("POST", `/api/stages/${groups.id}/generate`);
  } catch {
    refused = true;
  }
  check("generation will not destroy played results", refused, true);

  // =====================================================================
  console.log("\n7. head-to-head decides a real tie");
  // =====================================================================
  const h2h = await create("tournaments", {
    name: "Tie Cup", slug: `tie-${Date.now()}`, status: "published",
    owner: organiser.id,
  });
  const trio: Record<string, any> = {};
  for (const name of ["X", "Y", "Z"]) {
    trio[name] = await create("entries", {
      tournament: h2h.id, name, status: "active",
    });
  }
  const trioName = (id: string) =>
    Object.entries(trio).find(([, t]) => t.id === id)?.[0] ?? "?";

  const tieStage = await create("stages", {
    tournament: h2h.id, position: 0, name: "Group",
    format: "round_robin", status: "draft",
    config: { poolCount: 1, advancePerPool: 1 },
  });
  await api("POST", `/api/stages/${tieStage.id}/generate`);

  // Y beats X, X beats Z, Y beats Z -> Y 6pts, X 3pts, Z 0pts.
  const tieFixtures = await api(
    "GET", `/api/collections/fixtures/records?filter=(stage='${tieStage.id}')&sort=round,position`);
  const winners: Record<string, string> = { XY: "Y", XZ: "X", YZ: "Y" };
  for (const f of tieFixtures.items) {
    const home = trioName(f.home_entry);
    const away = trioName(f.away_entry);
    const key = [home, away].sort().join("");
    const homeWins = winners[key] === home;
    await patch("fixtures", f.id, {
      status: "finished",
      home_score: homeWins ? 2 : 0,
      away_score: homeWins ? 0 : 2,
    });
  }

  const tiePool = (await api(
    "GET", `/api/collections/pools/records?filter=(stage='${tieStage.id}')`)).items[0];
  const tieTable = await api(
    "GET", `/api/collections/standings/records?filter=(pool='${tiePool.id}')&sort=position`);
  check("clear points order needs no tiebreak",
    tieTable.items.map((r: any) => trioName(r.entry)), ["Y", "X", "Z"]);
  check("set totals are accumulated", tieTable.items[0].score_for, 4);
  check("conceded sets are accumulated", tieTable.items[0].score_against, 0);

  // =====================================================================
  console.log("\n8. the projector payload");
  // =====================================================================
  const screenToken = `tok-${Date.now()}`;
  await create("displays", {
    tournament: cup.id,
    name: "Main hall",
    token: screenToken,
    mode: "auto",
    rotate_seconds: 15,
    active: true,
    theme: {
      accent: "#0a7",
      sponsors: [
        { name: "Hall Sponsor", logo: "https://example.test/hall.svg", tier: "Main partner" },
        { name: "Ball Sponsor", logo: "" },
        { name: "", logo: "" },
      ],
    },
  });

  // Public: no Authorization header at all.
  const raw = await fetch(`${BASE}/api/display/${screenToken}`);
  check("the screen needs no login", raw.status, 200);
  const screen = await raw.json();

  check("payload names the tournament", screen.tournament.name, "Group Cup");
  check("payload carries the display config", screen.display.rotate_seconds, 15);
  check("payload carries the theme", screen.display.theme.accent, "#0a7");
  check("entries arrive as a lookup map", Object.keys(screen.entries).length, 8);
  check("both stages are included", screen.stages.length, 2);

  const groupStage = screen.stages.find((s: any) => s.name === "Groups");
  check("group stage has two pools", groupStage.pools.length, 2);
  check("pool table is embedded", groupStage.pools[0].standings.length, 4);
  check("table marks who qualified", groupStage.pools[0].standings[0].qualified, true);
  check("fixtures are grouped by round", groupStage.pools[0].rounds.length, 3);

  const playoffStage = screen.stages.find((s: any) => s.name === "Playoff");
  const allPlayoff = playoffStage.pools[0].rounds.flatMap((r: any) => r.fixtures);
  check(
    "every fixture side is renderable, resolved or not",
    allPlayoff.every((f: any) =>
      (f.home.entry !== "" || f.home.label !== "") &&
      (f.away.entry !== "" || f.away.label !== "")),
    true,
  );
  const unresolvedFinal = allPlayoff.find((f: any) => f.code === "F");
  check("an unplayed final shows placeholders", unresolvedFinal.home.label, "Winner SF1");

  check("finished fixtures land in recent", screen.recent.length > 0, true);
  check("resolved semis land in next up", screen.next_up.length, 2);

  // Polling must be cheap.
  const etag = raw.headers.get("etag");
  check("payload is tagged", typeof etag === "string" && etag.length > 0, true);
  const repeat = await fetch(`${BASE}/api/display/${screenToken}`, {
    headers: { "If-None-Match": etag as string },
  });
  check("an unchanged tournament returns 304", repeat.status, 304);

  // A result must invalidate the tag.
  const semiToPlay = (await api(
    "GET", `/api/collections/fixtures/records?filter=(stage='${playoff.id}'%26%26round=0)`)).items[0];
  await patch("fixtures", semiToPlay.id, {
    status: "finished", home_score: 2, away_score: 0,
  });
  const afterResult = await fetch(`${BASE}/api/display/${screenToken}`, {
    headers: { "If-None-Match": etag as string },
  });
  check("a played fixture invalidates the tag", afterResult.status, 200);

  // The sponsor slots are the one thing on this endpoint somebody pays for, so
  // the gate has to hold from the outside: the screen is public, the plan is
  // the owner's, and the only way to keep one off the other is to send
  // nothing. `theme.sponsors` is set on this screen throughout — what changes
  // below is only what the owner is paying for.
  const sponsorsOf = async () =>
    (await (await fetch(`${BASE}/api/display/${screenToken}`)).json()).sponsors;

  check("a free tournament sends no sponsors", await sponsorsOf(), []);

  const inAYear = new Date(Date.now() + 365 * 24 * 3600 * 1000)
    .toISOString().replace("T", " ").replace(/\..*/, "Z");

  await patch("users", organiser.id, { subscription_until: inAYear });
  const paid = await sponsorsOf();
  check("a subscription opens the slots", paid.length, 2);
  check("and carries what the screen draws", paid[0].tier, "Main partner");
  // Neither a logo nor a name is a blank box, not a sponsor.
  check("an empty slot is dropped", paid.map((s: any) => s.name), ["Hall Sponsor", "Ball Sponsor"]);

  await patch("users", organiser.id, { subscription_until: "2020-01-01 00:00:00Z" });
  check("a lapsed subscription closes them again", await sponsorsOf(), []);

  await patch("users", organiser.id, { subscription_until: inAYear });
  check("and paying again reopens them", (await sponsorsOf()).length, 2);

  // The fields live on a record their owner may write — that is what lets an
  // organiser put their own email on a device account — so nothing but a hook
  // stands between an account and a free upgrade.
  const freeloader = {
    email: `freeloader-${Date.now()}@example.com`,
    password: "long-enough",
  };
  const signup = await fetch(`${BASE}/api/collections/users/records`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: freeloader.email,
      password: freeloader.password,
      passwordConfirm: freeloader.password,
      subscription_until: inAYear,
    }),
  });
  check(
    "signing up asking for a subscription does not grant one",
    (await signup.json()).subscription_until,
    "",
  );

  const freeloaderAuth = await api("POST", "/api/collections/users/auth-with-password", {
    identity: freeloader.email, password: freeloader.password,
  });
  const asFreeloader = (body: unknown) =>
    fetch(`${BASE}/api/collections/users/records/${freeloaderAuth.record.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        Authorization: freeloaderAuth.token,
      },
      body: JSON.stringify(body),
    });

  check(
    "nor does asking again afterwards",
    (await asFreeloader({ subscription_until: inAYear })).status,
    403,
  );
  // A guard that blocks the whole record instead of two fields would pass every
  // check above and break the account screen.
  check("the rest of the record is still their own", (await asFreeloader({ name: "Someone" })).status, 200);

  // =====================================================================
  console.log("\n9. the projector endpoint does not leak");
  // =====================================================================
  const missing = await fetch(`${BASE}/api/display/definitely-not-a-token`);
  check("unknown token is 404", missing.status, 404);

  const draft = await create("tournaments", {
    name: "Secret", slug: `secret-${Date.now()}`, status: "draft",
    owner: organiser.id,
  });
  const draftToken = `draft-${Date.now()}`;
  await create("displays", {
    tournament: draft.id, token: draftToken, mode: "auto", active: true,
  });
  const draftScreen = await fetch(`${BASE}/api/display/${draftToken}`);
  check("a draft tournament is not exposed", draftScreen.status, 404);

  const offToken = `off-${Date.now()}`;
  await create("displays", {
    tournament: cup.id, token: offToken, mode: "auto", active: false,
  });
  const offScreen = await fetch(`${BASE}/api/display/${offToken}`);
  check("a deactivated screen is 404", offScreen.status, 404);

  const listAttempt = await fetch(`${BASE}/api/collections/displays/records`);
  const listed = await listAttempt.json();
  check("displays cannot be enumerated without a token", listed.items?.length ?? 0, 0);

  // =====================================================================
  console.log("\n10. clearing a result unrolls what it filled in");
  // =====================================================================
  // Section 8 played a semi-final, so the final knows one of its sides. Taking
  // that result away has to take the finalist with it: a bracket still naming
  // a team that has not qualified is the same class of bug as promoting a
  // provisionally-first team out of a group.
  const finalOf = async () =>
    (await api("GET",
      `/api/collections/fixtures/records?filter=(stage='${playoff.id}'%26%26code='F')`)).items[0];

  const filledFinal = await finalOf();
  check("the played semi put a team in the final", filledFinal.home_entry !== "", true);

  await patch("fixtures", semiToPlay.id, { status: "ready" });
  const emptiedFinal = await finalOf();
  check("clearing the semi empties the finalist", emptiedFinal.home_entry, "");

  const clearedSlot = (await api("GET",
    `/api/collections/slots/records?filter=(source_fixture='${semiToPlay.id}')`)).items[0];
  check("the slot it came from is cleared too", clearedSlot.entry, "");

  // And back again: the same result must land in the same place.
  await patch("fixtures", semiToPlay.id, {
    status: "finished", home_score: 2, away_score: 0,
  });
  const refilledFinal = await finalOf();
  check("replaying the result refills the final", refilledFinal.home_entry, filledFinal.home_entry);
  // The final stays "pending" throughout: only one semi has been played, so
  // its other side is still a placeholder either way.
  check("and it is still waiting on the other semi", refilledFinal.status, "pending");

  // =====================================================================
  console.log("\n11. claiming a device account");
  // =====================================================================
  // The wizard's accounts are anonymous by design; this is the only way one
  // ever becomes something a person can sign in with, so its refusals matter
  // as much as its success.
  const deviceEmail = `organiser-${Date.now()}@device.seedly.local`;
  const devicePassword = "device-generated-secret";
  await create("users", {
    email: deviceEmail,
    password: devicePassword,
    passwordConfirm: devicePassword,
    name: "Organiser",
  });
  const deviceAuth = await api("POST", "/api/collections/users/auth-with-password", {
    identity: deviceEmail, password: devicePassword,
  });

  const claim = (body: unknown, authToken?: string) =>
    fetch(`${BASE}/api/organiser/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authToken ? { Authorization: authToken } : {}),
      },
      body: JSON.stringify(body),
    });

  const anonymous = await claim({ email: "a@example.com", password: "long-enough" });
  check("claiming needs an account", anonymous.status, 401);

  const tooShort = await claim({ email: "a@example.com", password: "abc" }, deviceAuth.token);
  check("a short password is refused", tooShort.status, 400);

  const realEmail = `organiser-${Date.now()}@example.com`;
  const claimed = await claim({ email: realEmail, password: "long-enough" }, deviceAuth.token);
  check("a device account can be claimed", claimed.status, 200);

  const signedIn = await fetch(`${BASE}/api/collections/users/auth-with-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: realEmail, password: "long-enough" }),
  });
  check("and signed into with the new password", signedIn.status, 200);
  const signedInBody = await signedIn.json();
  check("as the same account", signedInBody.record.id, deviceAuth.record.id);

  // The old token was minted before the claim. If it still worked, a leaked
  // one would outlive the claim that was meant to secure the account.
  const stale = await fetch(`${BASE}/api/collections/users/auth-refresh`, {
    method: "POST",
    headers: { Authorization: deviceAuth.token },
  });
  check("the pre-claim token stops working", stale.status, 401);

  const secondClaim = await claim(
    { email: "someone-else@example.com", password: "long-enough" },
    signedInBody.token,
  );
  check("a claimed account cannot be claimed again", secondClaim.status, 400);

  // Staff read their own screens; the public still needs the token.
  const ownScreens = await api(
    "GET", `/api/collections/displays/records?filter=(tournament='${cup.id}')`);
  check("staff can list their tournament's screens", ownScreens.items.length > 0, true);

  // =====================================================================
  console.log("\n12. the result log");
  // =====================================================================
  // Section 8 played this semi-final, section 10 cleared it and played it
  // again. All three are somebody changing a result, and all three should be
  // recoverable the morning after.
  const history = await api("GET",
    `/api/collections/fixture_events/records?filter=(fixture='${semiToPlay.id}')&sort=created`);
  check("every change to a result is logged", history.items.length, 3);
  check(
    "in the order they happened",
    history.items.map((e: any) => e.kind).join(","),
    "recorded,cleared,recorded",
  );
  check("each one keeps what it replaced", history.items[1].previous.home_score, 2);

  // Putting a match on a court is not a claim about what happened in it.
  const scheduled = (await api("GET",
    `/api/collections/fixtures/records?filter=(stage='${playoff.id}'%26%26round=0)`)).items[1];
  await patch("fixtures", scheduled.id, { status: "live" });
  const afterLive = await api("GET",
    `/api/collections/fixture_events/records?filter=(fixture='${scheduled.id}')`);
  check("going on court is not history", afterLive.items.length, 0);

  const forged = await fetch(`${BASE}/api/collections/fixture_events/records`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fixture: semiToPlay.id, kind: "recorded" }),
  });
  check("the log cannot be written to over the API", forged.ok, false);

  // =====================================================================
  console.log("\n13. a double elimination plays itself out");
  // =====================================================================
  // Six teams, so the bracket of eight has two byes in it — which is where a
  // losers bracket goes wrong. A bye has a winner and no loser, and the match
  // waiting on that loser waits for ever unless somebody notices.
  const deCup = await create("tournaments", {
    name: "Double Cup",
    slug: `double-${Date.now()}`,
    status: "published",
    owner: organiser.id,
    scoring: { pointsWin: 3, pointsDraw: 1, pointsLoss: 0 },
  });
  for (let i = 1; i <= 6; i++) {
    await create("entries", {
      tournament: deCup.id, name: `D${i}`, seed: i, status: "active",
    });
  }
  const deStage = await create("stages", {
    tournament: deCup.id, position: 0, name: "Double elimination",
    format: "double_elim", status: "draft", config: {},
  });
  const generated = await api("POST", `/api/stages/${deStage.id}/generate`);

  // Everyone but the winner loses twice: 2·8 − 2 matches in a bracket of eight.
  check("the bracket has both halves and a final", generated.fixtures, 14);
  check("and three pools to draw them in", generated.pools, 3);

  const deFixtures = () =>
    api("GET",
      `/api/collections/fixtures/records?filter=(stage='${deStage.id}')&perPage=100`);

  // Play whatever is playable, over and over. A deadlock — a losers bracket
  // waiting on a loser a bye never produced — shows up as a round that never
  // becomes ready, and the loop runs out before the grand final is decided.
  let matchesPlayed = 0;
  for (let pass = 0; pass < 30; pass++) {
    const ready = (await deFixtures()).items.filter((f: any) => f.status === "ready");
    if (ready.length === 0) break;
    for (const fixture of ready) {
      await patch("fixtures", fixture.id, {
        status: "finished", home_score: 2, away_score: 1,
      });
      matchesPlayed++;
    }
  }

  const settled = (await deFixtures()).items;
  const grandFinal = settled.find((f: any) => f.code === "GF");
  check("the grand final was reached", grandFinal.status, "finished");
  check("and it has a winner", grandFinal.winner !== "", true);
  check(
    "nothing was left waiting",
    settled.filter((f: any) => f.status === "pending" || f.status === "ready").length,
    0,
  );
  // Six teams in a bracket of eight means two first-round byes, and the two
  // losers-bracket matches waiting on those non-existent losers inherit them.
  // Before that was handled they simply never became playable.
  const byes = settled.filter((f: any) => f.status === "bye");
  check("the top seeds get a first-round bye", byes.filter((f: any) => f.code.startsWith("W")).length, 2);
  check(
    "and the losers bracket inherits the gap rather than deadlocking",
    byes.filter((f: any) => f.code.startsWith("L")).length,
    2,
  );
  check("every match with two teams in it was played", matchesPlayed, 10);
  check("which is the whole bracket", byes.length + matchesPlayed, 14);

  // =====================================================================
  console.log("\n14. a Swiss stage draws its own rounds as the results come in");
  // =====================================================================
  // Nine teams, so somebody sits out every round — and a Swiss bye is the
  // opposite of a bracket bye: it is the round, so it has to score.
  const swissCup = await create("tournaments", {
    name: "Swiss Cup",
    slug: `swiss-${Date.now()}`,
    status: "published",
    owner: organiser.id,
    scoring: { pointsWin: 3, pointsDraw: 1, pointsLoss: 0 },
  });
  const swissTeams: Record<string, string> = {};
  for (let i = 1; i <= 9; i++) {
    const record = await create("entries", {
      tournament: swissCup.id, name: `S${i}`, seed: i, status: "active",
    });
    swissTeams[record.id] = `S${i}`;
  }
  const swissName = (id: string) => (id ? swissTeams[id] ?? "?" : "bye");

  const swissStage = await create("stages", {
    tournament: swissCup.id, position: 0, name: "Swiss",
    // No rounds configured: ceil(log2(9)) = 4 is worked out from the field.
    format: "swiss", status: "draft", config: { advancePerPool: 4 },
  });
  const swissPlan = await api("POST", `/api/stages/${swissStage.id}/generate`);

  check("a Swiss stage is one table", swissPlan.pools, 1);
  check("with a slot each, plus the empty chair", swissPlan.slots, 10);
  check("and only round one drawn", swissPlan.fixtures, 5);

  const swissFixtures = async () =>
    (await api("GET",
      `/api/collections/fixtures/records?filter=(stage='${swissStage.id}')&sort=round,position&perPage=100`)
    ).items;

  const roundPairs = (fixtures: any[], round: number) =>
    fixtures
      .filter((f: any) => f.round === round)
      .map((f: any) => `${swissName(f.home_entry)}-${swissName(f.away_entry)}`);

  // Round one has no table to read, so the fold runs on the seeding alone:
  // the top half meets the bottom half in order, and the seed nobody is left
  // to play sits out.
  check("round one folds the seeding",
    roundPairs(await swissFixtures(), 0),
    ["S1-S5", "S2-S6", "S3-S7", "S4-S8", "S9-bye"]);

  const swissPool = (await api(
    "GET", `/api/collections/pools/records?filter=(stage='${swissStage.id}')`)).items[0];
  const swissTable = async () =>
    (await api("GET",
      `/api/collections/standings/records?filter=(pool='${swissPool.id}')&sort=position`)).items;

  check("the team that sat out is credited with the win, not punished for it",
    (await swissTable()).find((r: any) => swissName(r.entry) === "S9").points, 3);

  // A playoff hangs off the table. It must stay empty until the Swiss has
  // played every round it owes — "all its fixtures are settled" is true after
  // round one and means nothing here.
  const swissPlayoff = await create("stages", {
    tournament: swissCup.id, position: 1, name: "Playoff",
    format: "single_elim", status: "draft",
    config: { seedFrom: { stage: swissStage.id, advancePerPool: 4 }, thirdPlace: true },
  });
  await api("POST", `/api/stages/${swissPlayoff.id}/generate`);
  const playoffSemis = async () =>
    (await api("GET",
      `/api/collections/fixtures/records?filter=(stage='${swissPlayoff.id}'%26%26round=0)&sort=position`)).items;

  const playRound = async (round: number) => {
    for (const f of (await swissFixtures()).filter((x: any) => x.round === round)) {
      if (f.status === "bye") continue;
      await patch("fixtures", f.id, {
        status: "finished", home_score: 2, away_score: 0,
      });
    }
  };

  await playRound(0);

  check("the top four are not promoted off one round",
    (await playoffSemis()).every((f: any) => f.home_entry === "" && f.away_entry === ""),
    true);

  let drawn = await swissFixtures();
  check("finishing round one draws round two", roundPairs(drawn, 1).length, 5);

  // Everyone who won plays somebody who won. The one exception is the odd
  // score group's bottom team, which floats down a group to find an opponent.
  const winsAfterRoundOne: Record<string, number> = {};
  for (const row of await swissTable()) winsAfterRoundOne[swissName(row.entry)] = row.won;
  const mismatched = drawn
    .filter((f: any) => f.round === 1 && f.away_entry !== "")
    .filter((f: any) =>
      winsAfterRoundOne[swissName(f.home_entry)] !== winsAfterRoundOne[swissName(f.away_entry)]);
  check("round two pairs like with like, bar one float", mismatched.length <= 1, true);

  // A result corrected while the next round is still unplayed redraws it: the
  // table it was drawn from was wrong.
  const beforeCorrection = roundPairs(drawn, 1).sort().join(",");
  const upset = drawn.find((f: any) => f.code === "R1.1");
  await patch("fixtures", upset.id, {
    status: "finished", home_score: 0, away_score: 2,
  });
  drawn = await swissFixtures();
  check("correcting a result redraws the round it fed",
    roundPairs(drawn, 1).sort().join(",") !== beforeCorrection, true);
  check("and the redrawn round is still a full one", roundPairs(drawn, 1).length, 5);

  // A round that carries history is never redrawn, even when the fixtures look
  // untouched. A score entered and then taken back off is a match that was
  // almost certainly played, and redrawing over it would delete the log of it
  // along with the fixture.
  const scratched = (await swissFixtures()).find((f: any) => f.round === 1 && f.away_entry !== "");
  await patch("fixtures", scratched.id, { status: "finished", home_score: 2, away_score: 1 });
  await patch("fixtures", scratched.id, { status: "ready" });

  const settledRound = roundPairs(await swissFixtures(), 1).sort().join(",");
  const secondUpset = (await swissFixtures()).find((f: any) => f.code === "R1.2");
  await patch("fixtures", secondUpset.id, {
    status: "finished", home_score: 0, away_score: 2,
  });
  check("a round somebody has already scored is left alone",
    roundPairs(await swissFixtures(), 1).sort().join(","), settledRound);

  for (let round = 1; round < 4; round++) {
    await playRound(round);
  }

  const swissPlayed = await swissFixtures();
  const rounds = new Set(swissPlayed.map((f: any) => f.round));
  check("four rounds were drawn in all", rounds.size, 4);
  check("five matches in each", swissPlayed.length, 20);
  check("and nothing is still waiting",
    swissPlayed.filter((f: any) => !["finished", "walkover", "bye"].includes(f.status)).length,
    0);

  // The one hard constraint. Everything else in the pairing is a preference.
  const meetings = swissPlayed
    .filter((f: any) => f.away_entry !== "")
    .map((f: any) => [swissName(f.home_entry), swissName(f.away_entry)].sort().join("-"));
  check("nobody played the same opponent twice",
    meetings.length, new Set(meetings).size);

  const satOut = swissPlayed.filter((f: any) => f.status === "bye").map((f: any) => swissName(f.winner));
  check("a different team sat out each round", satOut.length, new Set(satOut).size);

  const finalTable = await swissTable();
  check("everybody played every round",
    finalTable.every((r: any) => r.played === 4), true);
  check("the table qualifies exactly four",
    finalTable.filter((r: any) => r.qualified).length, 4);

  const swissSemis = await playoffSemis();
  check("the played-out table promotes the top four",
    swissSemis.flatMap((f: any) => [swissName(f.home_entry), swissName(f.away_entry)]).sort().join(","),
    finalTable.slice(0, 4).map((r: any) => swissName(r.entry)).sort().join(","));
  check("first plays fourth", 
    [swissName(swissSemis[0].home_entry), swissName(swissSemis[0].away_entry)],
    [swissName(finalTable[0].entry), swissName(finalTable[3].entry)]);


  // =====================================================================
  console.log("\n15. the best third-placed teams qualify across the pools");
  // =====================================================================
  //
  // Three pools of three: one winner each, plus the best two of the three
  // runners-up. Which two is not a position in any pool table — it is a
  // comparison between teams who never played each other, which is what the
  // stage table and its stage_rank slots exist for.
  const thirds = await create("tournaments", {
    name: "Thirds Cup", slug: `thirds-${Date.now()}`, status: "published",
    owner: organiser.id,
  });
  const nine: Record<string, any> = {};
  for (let i = 1; i <= 9; i++) {
    nine[`T${i}`] = await create("entries", {
      tournament: thirds.id, name: `T${i}`, seed: i, status: "active",
    });
  }
  const thirdName = (id: string) =>
    Object.entries(nine).find(([, t]) => t.id === id)?.[0] ?? "?";

  const thirdGroups = await create("stages", {
    tournament: thirds.id, position: 0, name: "Groups",
    format: "round_robin", status: "draft",
    config: { poolCount: 3, advancePerPool: 1 },
  });
  await api("POST", `/api/stages/${thirdGroups.id}/generate`);

  const thirdPlayoff = await create("stages", {
    tournament: thirds.id, position: 1, name: "Playoff",
    format: "single_elim", status: "draft",
    config: { seedFrom: { stage: thirdGroups.id, advancePerPool: 1, bestOfNext: 2 } },
  });
  const thirdPlan = await api("POST", `/api/stages/${thirdPlayoff.id}/generate?dry_run=1`);
  const stageRankSlots = thirdPlan.plan.slots.filter(
    (s: any) => s.source_type === "stage_rank");
  check("the plan asks for two best-of-next seeds", stageRankSlots.length, 2);
  check("they point at the stage, not a pool",
    stageRankSlots.every((s: any) => s.source_stage === thirdGroups.id && s.source_pool === ""),
    true);
  // Three pools, one qualifying automatically, so the runners-up are stage
  // positions 4, 5 and 6 — and the best two of them are 4 and 5.
  check("and at the first two places of the runners-up tier",
    stageRankSlots.map((s: any) => s.source_position).sort((x: number, y: number) => x - y),
    [4, 5]);

  await api("POST", `/api/stages/${thirdPlayoff.id}/generate`);

  const thirdPools = (await api(
    "GET", `/api/collections/pools/records?filter=(stage='${thirdGroups.id}')&sort=position`)).items;
  const thirdFixtures = async (poolId: string) => (await api(
    "GET", `/api/collections/fixtures/records?filter=(pool='${poolId}')&sort=round,position`)).items;
  // The stage-wide rows are the ones with no pool, picked out here rather than
  // asked for with `pool=''` — what an unset relation compares equal to inside
  // a filter is not what this section is trying to find out.
  const stageTable = async () => (await api(
    "GET",
    `/api/collections/standings/records?filter=(stage='${thirdGroups.id}')&sort=position`,
  )).items.filter((r: any) => r.pool === "");
  const thirdSemis = async () => (await api(
    "GET", `/api/collections/fixtures/records?filter=(stage='${thirdPlayoff.id}'%26%26round=0)&sort=position`)).items;

  // Play the first two pools; the third is still out.
  for (const pool of thirdPools.slice(0, 2)) {
    for (const f of await thirdFixtures(pool.id)) {
      await patch("fixtures", f.id, { status: "finished", home_score: 2, away_score: 0 });
    }
  }

  check("the stage table is kept up to date while the groups run",
    (await stageTable()).length, 9);
  check("but nothing is seeded from it yet",
    (await thirdSemis()).flatMap((f: any) => [f.home_entry, f.away_entry])
      .filter((e: string) => e !== "").length,
    2); // the two finished pools' winners, on pool_rank — no runners-up

  // The last pool comes in.
  for (const f of await thirdFixtures(thirdPools[2].id)) {
    await patch("fixtures", f.id, { status: "finished", home_score: 2, away_score: 0 });
  }

  const finalStage = await stageTable();
  check("the stage table holds every pool's three places", finalStage.length, 9);
  check("positions run 1..9 with no gaps",
    finalStage.map((r: any) => r.position), [1, 2, 3, 4, 5, 6, 7, 8, 9]);

  const poolWinners = new Set<string>();
  const poolRunnersUp = new Set<string>();
  for (const pool of thirdPools) {
    const table = (await api(
      "GET", `/api/collections/standings/records?filter=(pool='${pool.id}')&sort=position`)).items;
    poolWinners.add(thirdName(table[0].entry));
    poolRunnersUp.add(thirdName(table[1].entry));
  }
  check("the first tier is exactly the pool winners",
    finalStage.slice(0, 3).map((r: any) => thirdName(r.entry)).sort(),
    [...poolWinners].sort());
  check("the second tier is exactly the runners-up",
    finalStage.slice(3, 6).map((r: any) => thirdName(r.entry)).sort(),
    [...poolRunnersUp].sort());

  // Five qualifiers into a bracket of eight, so three of the round-1 places
  // are byes. Nothing should still be *waiting*: a seed is either a named team
  // or a declared bye, and a match against a bye has already settled itself.
  const seededSemis = await thirdSemis();
  check("no seed in the bracket is left waiting",
    seededSemis.every((f: any) => f.status === "bye" || f.status === "ready"), true);

  const qualified = seededSemis
    .flatMap((f: any) => [f.home_entry, f.away_entry])
    .filter((e: string) => e !== "")
    .map(thirdName);
  check("the best two runners-up went through and the third did not",
    [...qualified].sort(),
    [...poolWinners, thirdName(finalStage[3].entry), thirdName(finalStage[4].entry)].sort());
  check("the runner-up left out is the one the stage table put third",
    qualified.includes(thirdName(finalStage[5].entry)), false);


  // =====================================================================
  console.log("\n16. a second person joins by scanning a code");
  // =====================================================================
  // `staff` has gated every write below a tournament since the first
  // migration and had no way to get a row in it. This is that way, so what is
  // being checked is not really the endpoint — it is that joining actually
  // buys the thing it is for: a second phone that can enter a result.
  const chiefEmail = `chief-${Date.now()}@example.com`;
  await create("users", {
    email: chiefEmail, password: "chief-secret-1", passwordConfirm: "chief-secret-1",
  });
  const chiefAuth = await api("POST", "/api/collections/users/auth-with-password", {
    identity: chiefEmail, password: "chief-secret-1",
  });

  const hall = await create("tournaments", {
    name: "Hall Cup", slug: `hall-${Date.now()}`,
    status: "published", owner: chiefAuth.record.id,
  });
  const [hallA, hallB] = await Promise.all([
    create("entries", { tournament: hall.id, name: "Alpha", seed: 1, status: "active" }),
    create("entries", { tournament: hall.id, name: "Beta", seed: 2, status: "active" }),
  ]);
  const hallStage = await create("stages", {
    tournament: hall.id, position: 0, name: "Final",
    format: "single_elim", status: "draft",
  });
  await api("POST", `/api/stages/${hallStage.id}/generate`);
  const hallFixture = (await api(
    "GET", `/api/collections/fixtures/records?filter=(stage='${hallStage.id}')`)).items[0];

  // Minted by the owner through the ordinary collection API, exactly as the
  // crew sheet does it — the token is the client's to generate, like a
  // screen's.
  const refToken = `ref${Date.now()}`;
  const orgToken = `org${Date.now()}`;
  const mint = (value: string, role: string, auth: string) =>
    fetch(`${BASE}/api/collections/invites/records`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: auth },
      body: JSON.stringify({ tournament: hall.id, token: value, role, active: true }),
    });

  const minted = await mint(refToken, "referee", chiefAuth.token);
  check("the owner can mint a join code", minted.status, 200);
  const refInvite = await minted.json();
  await mint(orgToken, "organizer", chiefAuth.token);

  // The crew sheet reads before it writes — it reuses a live code rather than
  // minting one per visit — so the list rule is on the path, not beside it.
  const ownList = await fetch(
    `${BASE}/api/collections/invites/records` +
      `?filter=(tournament='${hall.id}' %26%26 role='referee' %26%26 active=true)`,
    { headers: { Authorization: chiefAuth.token } },
  );
  check("the owner can find a code they already minted", ownList.status, 200);
  check("and finds exactly the live one", (await ownList.json()).items.length, 1);

  // The preview is public: a join screen that could not name the tournament
  // would be asking somebody to accept a blank invitation.
  const preview16 = await fetch(`${BASE}/api/staff/invite/${refToken}`);
  check("a join code names its tournament without a login", preview16.status, 200);
  const previewBody = await preview16.json();
  check("and says what it is for", [previewBody.name, previewBody.role], ["Hall Cup", "referee"]);

  const unknown = await fetch(`${BASE}/api/staff/invite/nonsense`);
  check("a token nobody minted is not valid", unknown.status, 404);

  // The referee's phone: a device account it never had to type for, which is
  // what `ensureOrganiser` makes on the join screen.
  const refEmail = `referee-${Date.now()}@device.seedly.local`;
  await create("users", {
    email: refEmail, password: "device-secret-1", passwordConfirm: "device-secret-1",
    name: "Organiser",
  });
  const refAuth = await api("POST", "/api/collections/users/auth-with-password", {
    identity: refEmail, password: "device-secret-1",
  });

  // Codes are the owner's to see as well as to mint: a crew member who could
  // list them could re-scan the organiser one.
  const strangerList = await fetch(
    `${BASE}/api/collections/invites/records?filter=(tournament='${hall.id}')`,
    { headers: { Authorization: refAuth.token } },
  );
  check("a stranger listing codes gets none",
    (await strangerList.json()).items?.length ?? 0, 0);

  const scoreIt = (auth: string, home: number, away: number) =>
    fetch(`${BASE}/api/collections/fixtures/records/${hallFixture.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", Authorization: auth },
      body: JSON.stringify({ status: "finished", home_score: home, away_score: away }),
    });

  // The point of the whole feature, stated as a before and after.
  const strangerWrite = await scoreIt(refAuth.token, 2, 0);
  check("a stranger cannot enter a result", strangerWrite.status === 200, false);

  const join = (body: unknown, auth?: string) =>
    fetch(`${BASE}/api/staff/join`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body: JSON.stringify(body),
    });

  const anonymousJoin = await join({ token: refToken });
  check("joining needs an account on the device", anonymousJoin.status, 401);

  const badJoin = await join({ token: "nonsense" }, refAuth.token);
  check("a made-up code joins nothing", badJoin.status, 404);

  const joined = await join({ token: refToken, name: "  Jana  " }, refAuth.token);
  check("scanning the code joins the tournament", joined.status, 200);
  const joinedBody = await joined.json();
  check("and lands on the right tournament",
    [joinedBody.tournament, joinedBody.role], [hall.id, "referee"]);

  const afterJoin = await scoreIt(refAuth.token, 2, 0);
  check("having joined, the same phone can enter a result", afterJoin.status, 200);

  const crew = await api(
    "GET", `/api/collections/staff/records?filter=(tournament='${hall.id}')`);
  check("the crew is one referee", crew.totalItems, 1);
  check("named as they typed it, trimmed", crew.items[0].name, "Jana");

  // The log is why the name is asked for at all: with two people writing,
  // "changed 2–0 to 2–1" is a different sentence depending on who did it.
  const log = await api(
    "GET", `/api/collections/fixture_events/records?filter=(fixture='${hallFixture.id}')`);
  check("the result is logged against whoever entered it",
    log.items[0].actor, refAuth.record.id);

  // Idempotent: a phone that gets locked and reopened re-scans the same code.
  const rejoined = await join({ token: refToken, name: "Jana" }, refAuth.token);
  check("scanning the same code twice is not an error", rejoined.status, 200);
  const stillOne = await api(
    "GET", `/api/collections/staff/records?filter=(tournament='${hall.id}')`);
  check("and does not add a second row", stillOne.totalItems, 1);

  // A link does what the link says, including when that is a promotion.
  const promoted = await join({ token: orgToken, name: "Jana" }, refAuth.token);
  check("the co-organiser code promotes rather than duplicating", promoted.status, 200);
  const promotedCrew = await api(
    "GET", `/api/collections/staff/records?filter=(tournament='${hall.id}')`);
  check("still one row, now an organiser",
    [promotedCrew.totalItems, promotedCrew.items[0].role], [1, "organizer"]);

  // The owner scanning their own code has everything it grants already.
  const ownerJoin = await join({ token: refToken }, chiefAuth.token);
  check("the owner scanning their own code is a no-op", ownerJoin.status, 200);
  check("and is told so", (await ownerJoin.json()).role, "owner");
  const unchanged = await api(
    "GET", `/api/collections/staff/records?filter=(tournament='${hall.id}')`);
  check("the owner does not become their own staff", unchanged.totalItems, 1);

  // Escalation: an invite mints staff, so writing one has to be owner-only or
  // it is a way around `staff`'s own owner-only create rule.
  const selfMinted = await mint(`self${Date.now()}`, "organizer", refAuth.token);
  check("a crew member cannot mint their own codes", selfMinted.status === 200, false);

  // Withdrawing a link that got out. Anyone already on the crew stays — they
  // are a staff row now, and the invite was only ever the door.
  await fetch(`${BASE}/api/collections/invites/records/${refInvite.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", Authorization: chiefAuth.token },
    body: JSON.stringify({ active: false }),
  });

  const withdrawn = await fetch(`${BASE}/api/staff/invite/${refToken}`);
  check("a withdrawn code stops naming its tournament", withdrawn.status, 404);

  const lateEmail = `late-${Date.now()}@device.seedly.local`;
  await create("users", {
    email: lateEmail, password: "device-secret-2", passwordConfirm: "device-secret-2",
  });
  const lateAuth = await api("POST", "/api/collections/users/auth-with-password", {
    identity: lateEmail, password: "device-secret-2",
  });
  const lateJoin = await join({ token: refToken }, lateAuth.token);
  check("and stops letting anybody new in", lateJoin.status, 404);

  const survivors = await api(
    "GET", `/api/collections/staff/records?filter=(tournament='${hall.id}')`);
  check("while whoever already joined stays on the crew", survivors.totalItems, 1);

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
