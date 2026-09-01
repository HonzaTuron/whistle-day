#!/usr/bin/env bun
/**
 * Fills a running Seedly instance with a realistic tournament.
 *
 * The point is not "some data" — it is data that exercises the parts most
 * likely to be wrong: a three-way tie that only the tiebreak chain can rank, a
 * playoff seeded from those tables, a match in progress, and a bracket half
 * full of unresolved placeholders.
 */

const BASE = process.env.SEEDLY_API ?? "http://127.0.0.1:8090";
const ADMIN = {
  identity: process.env.SEEDLY_ADMIN ?? "admin@seedly.local",
  password: process.env.SEEDLY_ADMIN_PASSWORD ?? "seedlyadmin1",
};
const SCREEN_TOKEN = process.env.SEEDLY_TOKEN ?? "hala-1";

let token = "";

async function api(method: string, path: string, body?: unknown) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

const create = (collection: string, data: Record<string, unknown>) =>
  api("POST", `/api/collections/${collection}/records`, data);
const patch = (collection: string, id: string, data: Record<string, unknown>) =>
  api("PATCH", `/api/collections/${collection}/records/${id}`, data);
const list = (collection: string, query: string) =>
  api("GET", `/api/collections/${collection}/records?${query}`);

/** Today at HH:MM, in the format PocketBase stores. */
function todayAt(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString().replace("T", " ").replace("Z", "Z");
}

// ---------------------------------------------------------------------------

const TEAMS = [
  { name: "VK Dukla Liberec", short: "Liberec", seed: 1 },
  { name: "ČEZ Karlovarsko", short: "Karlovarsko", seed: 2 },
  { name: "Aero Odolena Voda", short: "Odolena Voda", seed: 3 },
  { name: "VK Jihostroj Č. Budějovice", short: "Č. Budějovice", seed: 4 },
  { name: "Black Volley Beskydy", short: "Beskydy", seed: 5 },
  { name: "VK Lvi Praha", short: "Lvi Praha", seed: 6 },
  { name: "Volejbal Brno", short: "Brno", seed: 7 },
  { name: "VK Ostrava", short: "Ostrava", seed: 8 },
];

/**
 * Results keyed by the two teams involved, so it does not matter which way
 * round the generator drew them.
 *
 * Group B is deliberately a three-way tie on six points with a cyclic
 * head-to-head (Karlovarsko > Odolena Voda > Lvi > Karlovarsko). Nothing but
 * set difference, and then sets won, can separate them — which is exactly the
 * case worth being able to see on screen.
 */
const RESULTS: Record<string, { winner: string; sets: [number, number] }> = {
  // group A — clean, seeded order holds
  "VK Dukla Liberec|VK Jihostroj Č. Budějovice": { winner: "VK Dukla Liberec", sets: [3, 1] },
  "Black Volley Beskydy|VK Dukla Liberec": { winner: "VK Dukla Liberec", sets: [3, 0] },
  "VK Dukla Liberec|VK Ostrava": { winner: "VK Dukla Liberec", sets: [3, 0] },
  "Black Volley Beskydy|VK Jihostroj Č. Budějovice": {
    winner: "VK Jihostroj Č. Budějovice", sets: [3, 2],
  },
  "VK Jihostroj Č. Budějovice|VK Ostrava": {
    winner: "VK Jihostroj Č. Budějovice", sets: [3, 1],
  },
  "Black Volley Beskydy|VK Ostrava": { winner: "Black Volley Beskydy", sets: [3, 2] },

  // group B — the three-way tie
  "Aero Odolena Voda|ČEZ Karlovarsko": { winner: "ČEZ Karlovarsko", sets: [3, 1] },
  "ČEZ Karlovarsko|VK Lvi Praha": { winner: "VK Lvi Praha", sets: [3, 1] },
  "Aero Odolena Voda|VK Lvi Praha": { winner: "Aero Odolena Voda", sets: [3, 2] },
  "ČEZ Karlovarsko|Volejbal Brno": { winner: "ČEZ Karlovarsko", sets: [3, 0] },
  "Aero Odolena Voda|Volejbal Brno": { winner: "Aero Odolena Voda", sets: [3, 0] },
  "VK Lvi Praha|Volejbal Brno": { winner: "VK Lvi Praha", sets: [3, 1] },
};

console.log(`seeding ${BASE}`);

const auth = await api("POST", "/api/collections/_superusers/auth-with-password", ADMIN);
token = auth.token;

const organiser =
  (await list("users", `filter=(email='organiser@seedly.local')`)).items[0] ??
  (await create("users", {
    email: "organiser@seedly.local",
    password: "organiser123",
    passwordConfirm: "organiser123",
    name: "Turnajový výbor",
  }));

/**
 * Re-seeding replaces the demo rather than piling another one on top. A
 * half-finished run leaves records that look real and are impossible to tell
 * apart afterwards.
 *
 * Children are removed explicitly, deepest first: cascade deletes cannot
 * untangle the slots/fixtures cycle on their own.
 */
async function removeTournament(id: string) {
  const stages = await list("stages", `filter=(tournament='${id}')&perPage=200`);
  for (const stage of stages.items) {
    for (const collection of ["games", "fixtures", "slots", "standings", "pools"]) {
      const filter =
        collection === "games"
          ? `filter=(fixture.stage='${stage.id}')`
          : `filter=(stage='${stage.id}')`;
      const records = await list(collection, `${filter}&perPage=500`);
      for (const record of records.items) {
        await api("DELETE", `/api/collections/${collection}/records/${record.id}`);
      }
    }
    await api("DELETE", `/api/collections/stages/records/${stage.id}`);
  }

  for (const collection of ["displays", "courts", "entries", "staff"]) {
    const records = await list(collection, `filter=(tournament='${id}')&perPage=500`);
    for (const record of records.items) {
      await api("DELETE", `/api/collections/${collection}/records/${record.id}`);
    }
  }

  await api("DELETE", `/api/collections/tournaments/records/${id}`);
}

const previous = await list(
  "tournaments", `filter=(owner='${organiser.id}')&perPage=200`);
for (const stale of previous.items) {
  await removeTournament(stale.id);
}
if (previous.items.length > 0) {
  console.log(`  removed ${previous.items.length} earlier demo tournament(s)`);
}

const tournament = await create("tournaments", {
  name: "Podzimní pohár 2026",
  slug: `podzimni-pohar-${Date.now()}`,
  sport: "volleyball",
  location: "Sportovní hala Vinohrady",
  status: "live",
  owner: organiser.id,
  starts_on: todayAt(9, 0),
  // The volleyball preset from apps/web/src/lib/scoring.ts. `drawsAllowed`
  // is the part worth having in the demo: the server refuses a level score
  // here, which is the whole reason the wizard asks what is being played.
  scoring: {
    bestOf: 5,
    pointsWin: 2,
    pointsDraw: 0,
    pointsLoss: 0,
    drawsAllowed: false,
    walkoverScore: 2,
    tiebreakers: ["points", "head_to_head", "score_diff", "sub_diff", "score_for", "seed"],
  },
});
console.log(`  tournament ${tournament.name}`);

const courts = [];
for (const [i, name] of ["Kurt 1", "Kurt 2"].entries()) {
  courts.push(await create("courts", {
    tournament: tournament.id, name, position: i, active: true,
  }));
}

const entries: Record<string, any> = {};
for (const team of TEAMS) {
  entries[team.name] = await create("entries", {
    tournament: tournament.id,
    name: team.name,
    short_name: team.short,
    seed: team.seed,
    status: "active",
  });
}
console.log(`  ${TEAMS.length} teams`);

const nameOf = (id: string) =>
  Object.entries(entries).find(([, e]) => e.id === id)?.[0] ?? "";

// --- group stage -----------------------------------------------------------

const groups = await create("stages", {
  tournament: tournament.id,
  position: 0,
  name: "Základní skupiny",
  format: "round_robin",
  status: "draft",
  config: { poolCount: 2, advancePerPool: 2 },
});
await api("POST", `/api/stages/${groups.id}/generate`);
console.log("  group stage generated");

// --- playoff, seeded from the groups ---------------------------------------

const playoff = await create("stages", {
  tournament: tournament.id,
  position: 1,
  name: "Playoff",
  format: "single_elim",
  status: "draft",
  config: { seedFrom: { stage: groups.id, advancePerPool: 2 }, thirdPlace: true },
});
await api("POST", `/api/stages/${playoff.id}/generate`);
console.log("  playoff generated from the group tables");

// --- play the group stage --------------------------------------------------

const groupFixtures = await list(
  "fixtures", `filter=(stage='${groups.id}')&sort=round,position&perPage=200`);

let slot = 0;
for (const fixture of groupFixtures.items) {
  const home = nameOf(fixture.home_entry);
  const away = nameOf(fixture.away_entry);
  // Look up both directions rather than relying on a sort order: JS sorts by
  // UTF-16 code unit, so "ČEZ Karlovarsko" lands after "Volejbal Brno" and any
  // hand-written key ordering is a coin flip.
  const result = RESULTS[`${home}|${away}`] ?? RESULTS[`${away}|${home}`];
  if (!result) throw new Error(`no scripted result for ${home} v ${away}`);

  const homeWon = result.winner === home;
  const [winnerSets, loserSets] = result.sets;

  await patch("fixtures", fixture.id, {
    status: "finished",
    home_score: homeWon ? winnerSets : loserSets,
    away_score: homeWon ? loserSets : winnerSets,
    court: courts[slot % courts.length].id,
    scheduled_at: todayAt(9 + Math.floor(slot / 2), (slot % 2) * 30),
    finished_at: todayAt(9 + Math.floor(slot / 2), (slot % 2) * 30 + 25),
  });
  slot++;
}
console.log(`  ${groupFixtures.items.length} group matches played`);

// --- the playoff is now seeded; put one semi on court ------------------------

const semis = (await list(
  "fixtures", `filter=(stage='${playoff.id}'%26%26round=0)&sort=position`)).items;

await patch("fixtures", semis[0].id, {
  status: "live",
  home_score: 1,
  away_score: 1,
  court: courts[0].id,
  scheduled_at: todayAt(15, 0),
  started_at: todayAt(15, 2),
});
// A live match should show its sets, not just the set count.
for (const [index, score] of ([[25, 21], [22, 25], [18, 14]] as [number, number][]).entries()) {
  await create("games", {
    fixture: semis[0].id,
    number: index + 1,
    home_score: score[0],
    away_score: score[1],
    finished: index < 2,
  });
}

await patch("fixtures", semis[1].id, {
  status: "ready",
  court: courts[1].id,
  scheduled_at: todayAt(15, 45),
});

const later = await list(
  "fixtures", `filter=(stage='${playoff.id}'%26%26round=1)&sort=position`);
for (const fixture of later.items) {
  await patch("fixtures", fixture.id, {
    court: courts[0].id,
    scheduled_at: todayAt(17, 0),
  });
}

console.log("  semi-final 1 is live, semi-final 2 is up next");

// --- the screen -------------------------------------------------------------

for (const stale of (await list("displays", `filter=(token='${SCREEN_TOKEN}')`)).items) {
  await api("DELETE", `/api/collections/displays/records/${stale.id}`);
}
await create("displays", {
  tournament: tournament.id,
  name: "Hala — hlavní projektor",
  token: SCREEN_TOKEN,
  mode: "auto",
  rotate_seconds: 12,
  active: true,
  theme: {
    accent: "#22c55e",
    // The closing panel's sponsor slots. They only reach a screen while the
    // tournament's owner is subscribed — hence the line below, since a panel
    // that silently shows nothing demonstrates nothing.
    sponsors: [
      { name: "Pivovar Podzim", logo: "", tier: "Hlavní partner" },
      { name: "Sportovní haly s.r.o.", logo: "", tier: "Partner haly" },
      { name: "Míče Novák", logo: "" },
    ],
  },
});

await patch("users", organiser.id, {
  subscription_until: new Date(Date.now() + 365 * 24 * 3600 * 1000)
    .toISOString().replace("T", " ").replace(/\..*/, "Z"),
});

await patch("stages", groups.id, { status: "finished" });
await patch("stages", playoff.id, { status: "live" });

// --- show what came out ------------------------------------------------------

const pools = (await list("pools", `filter=(stage='${groups.id}')&sort=position`)).items;
for (const pool of pools) {
  const table = await list("standings", `filter=(pool='${pool.id}')&sort=position`);
  console.log(`\n  Skupina ${pool.name}`);
  for (const row of table.items) {
    const flag = row.qualified ? "✓" : " ";
    const applied = (row.tiebreak?.applied ?? []).join(" > ");
    console.log(
      `   ${flag} ${row.position}. ${nameOf(row.entry).padEnd(28)}` +
      `${row.points}b  ${row.score_for}:${row.score_against}` +
      (applied.includes(">") ? `   [${applied}]` : ""),
    );
  }
}

console.log(`\ndone. screen token: ${SCREEN_TOKEN}`);
