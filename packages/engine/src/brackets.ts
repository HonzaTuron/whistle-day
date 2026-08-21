/**
 * Stage generators.
 *
 * Every generator is pure: entries in, a StagePlan out. Nothing here touches
 * PocketBase, so the same code runs in the organiser's browser (to preview a
 * draw) and inside pb_hooks (to commit it).
 */

import type {
  DraftKey,
  FixtureDraft,
  Id,
  PoolDraft,
  SlotDraft,
  StagePlan,
} from "./types";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * Standard bracket seeding order: the sequence of seeds reading down round 1,
 * so that the top two seeds can only meet in the final.
 *
 *   size 4 -> [1, 4, 2, 3]
 *   size 8 -> [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const mirror = order.length * 2 + 1;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, mirror - seed);
    }
    order = next;
  }
  return order;
}

/** "QF2", "SF1", "F" — the handle shouted across the hall and printed on sheets. */
function fixtureCode(fixturesInRound: number, index: number): string {
  const prefix =
    fixturesInRound === 1
      ? "F"
      : fixturesInRound === 2
        ? "SF"
        : fixturesInRound === 4
          ? "QF"
          : `R${fixturesInRound * 2}`;
  return fixturesInRound === 1 ? prefix : `${prefix}${index + 1}`;
}

/** Pool A, B, ... Z, then AA, AB, ... */
export function poolName(index: number): string {
  let name = "";
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

/**
 * Snake ("boustrophedon") distribution, so seeds spread evenly across pools:
 * with 3 pools, seeds 1..6 land as A[1,6] B[2,5] C[3,4].
 */
export function snakeDistribute(entryIds: Id[], poolCount: number): Id[][] {
  const pools: Id[][] = [];
  for (let i = 0; i < poolCount; i++) pools.push([]);
  entryIds.forEach((id, i) => {
    const row = Math.floor(i / poolCount);
    const offset = i % poolCount;
    const col = row % 2 === 0 ? offset : poolCount - 1 - offset;
    pools[col].push(id);
  });
  return pools;
}

/**
 * Circle method: every entry meets every other exactly once, spread across
 * n-1 rounds with no entry playing twice in a round. A null is a bye.
 */
export function circleRounds(items: (Id | null)[]): [Id | null, Id | null][][] {
  const list = items.slice();
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  if (n < 2) return [];

  let current = list.slice();
  const rounds: [Id | null, Id | null][][] = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs: [Id | null, Id | null][] = [];
    for (let i = 0; i < n / 2; i++) {
      pairs.push([current[i], current[n - 1 - i]]);
    }
    rounds.push(pairs);

    // Pin the first entry, rotate the rest clockwise.
    const [fixed, ...rest] = current;
    rest.unshift(rest.pop() as Id | null);
    current = [fixed, ...rest];
  }
  return rounds;
}

// ---------------------------------------------------------------------------
// single elimination
// ---------------------------------------------------------------------------

export interface SingleElimOptions {
  /** Adds a 3rd-place fixture fed by the two semi-final losers. */
  thirdPlace?: boolean;
  poolName?: string;
}

/**
 * Build a full single-elimination bracket.
 *
 * `entryIds` must already be in seed order (best first). Entries missing from
 * a power-of-two bracket become byes, which the top seeds receive first.
 *
 * Passing an empty array is legal and useful: it produces the SAME bracket
 * shape with every round-1 slot unresolved, which is exactly what you need to
 * project a playoff tree that is still being fed by an earlier stage.
 */
export function planSingleElimination(
  entryIds: Id[],
  options: SingleElimOptions = {},
): StagePlan {
  const size = nextPowerOfTwo(Math.max(entryIds.length, 2));
  const poolKey: DraftKey = "pool:main";

  const pools: PoolDraft[] = [
    {
      key: poolKey,
      name: options.poolName ?? "Main",
      position: 0,
      kind: "winners",
      advance_count: 1,
    },
  ];

  const slots: SlotDraft[] = [];
  const fixtures: FixtureDraft[] = [];

  // --- round 0: seeded entry slots -----------------------------------------
  const order = seedOrder(size);
  order.forEach((seed, position) => {
    const entry = entryIds[seed - 1] ?? null;
    const isBye = entryIds.length > 0 && entry === null;
    slots.push({
      key: `slot:0:${position}`,
      poolKey,
      round: 0,
      position,
      label: isBye ? "Bye" : `Seed ${seed}`,
      entry,
      source_type: isBye ? "bye" : "direct",
      sourceFixtureKey: null,
      sourcePoolKey: null,
      source_position: seed,
    });
  });

  // --- rounds 1..n: fixtures, and the winner slots they feed ---------------
  let round = 0;
  let slotsInRound = size;

  while (slotsInRound > 1) {
    const fixturesInRound = slotsInRound / 2;

    for (let i = 0; i < fixturesInRound; i++) {
      const homeSlotKey = `slot:${round}:${i * 2}`;
      const awaySlotKey = `slot:${round}:${i * 2 + 1}`;
      const code = fixtureCode(fixturesInRound, i);
      const fixtureKey = `fixture:${round}:${i}`;

      fixtures.push({
        key: fixtureKey,
        poolKey,
        round,
        position: i,
        code,
        homeSlotKey,
        awaySlotKey,
        status: "pending",
      });

      // The winner's onward slot exists immediately, unresolved.
      slots.push({
        key: `slot:${round + 1}:${i}`,
        poolKey,
        round: round + 1,
        position: i,
        label: `Winner ${code}`,
        entry: null,
        source_type: "fixture_winner",
        sourceFixtureKey: fixtureKey,
        sourcePoolKey: null,
        source_position: null,
      });
    }

    round += 1;
    slotsInRound = fixturesInRound;
  }

  // --- optional 3rd place fixture ------------------------------------------
  if (options.thirdPlace && size >= 4) {
    const semiRound = round - 2;
    const bronzeRound = round - 1;
    const loserSlots: DraftKey[] = [];

    for (let i = 0; i < 2; i++) {
      const sourceFixtureKey = `fixture:${semiRound}:${i}`;
      const key = `slot:bronze:${i}`;
      slots.push({
        key,
        poolKey,
        round: bronzeRound,
        // sit beside the final, which occupies position 0
        position: 1 + i,
        label: `Loser ${fixtureCode(2, i)}`,
        entry: null,
        source_type: "fixture_loser",
        sourceFixtureKey,
        sourcePoolKey: null,
        source_position: null,
      });
      loserSlots.push(key);
    }

    fixtures.push({
      key: "fixture:bronze",
      poolKey,
      round: bronzeRound,
      position: 1,
      code: "3P",
      homeSlotKey: loserSlots[0],
      awaySlotKey: loserSlots[1],
      status: "pending",
    });
  }

  return { pools, slots, fixtures };
}

// ---------------------------------------------------------------------------
// round robin
// ---------------------------------------------------------------------------

export interface RoundRobinOptions {
  poolCount?: number;
  /** How many times each pair meets. 2 = home and away. */
  legs?: number;
  advancePerPool?: number;
}

/**
 * Build round-robin pools. `entryIds` in seed order; entries are snaked across
 * pools so the strong ones do not collide.
 */
export function planRoundRobin(
  entryIds: Id[],
  options: RoundRobinOptions = {},
): StagePlan {
  const poolCount = Math.max(1, options.poolCount ?? 1);
  const legs = Math.max(1, options.legs ?? 1);
  const advance = options.advancePerPool ?? null;

  const pools: PoolDraft[] = [];
  const slots: SlotDraft[] = [];
  const fixtures: FixtureDraft[] = [];

  const distributed = snakeDistribute(entryIds, poolCount);

  distributed.forEach((poolEntries, poolIndex) => {
    const poolKey: DraftKey = `pool:${poolIndex}`;
    pools.push({
      key: poolKey,
      name: poolName(poolIndex),
      position: poolIndex,
      kind: "group",
      advance_count: advance,
    });

    // One slot per place in the pool. Placeholder slots keep the table
    // printable before the draw is final.
    const slotKeyByEntry = new Map<Id, DraftKey>();
    poolEntries.forEach((entryId, position) => {
      const key = `slot:${poolIndex}:${position}`;
      slotKeyByEntry.set(entryId, key);
      slots.push({
        key,
        poolKey,
        round: 0,
        position,
        label: `${poolName(poolIndex)}${position + 1}`,
        entry: entryId,
        source_type: "direct",
        sourceFixtureKey: null,
        sourcePoolKey: null,
        source_position: position + 1,
      });
    });

    const schedule = circleRounds(poolEntries);

    for (let leg = 0; leg < legs; leg++) {
      schedule.forEach((pairs, roundIndex) => {
        const round = leg * schedule.length + roundIndex;
        let position = 0;

        pairs.forEach(([a, b]) => {
          if (a === null || b === null) return; // bye — no fixture is played

          // Swap sides on the return leg.
          const [home, away] = leg % 2 === 0 ? [a, b] : [b, a];

          fixtures.push({
            key: `fixture:${poolIndex}:${round}:${position}`,
            poolKey,
            round,
            position,
            code: `${poolName(poolIndex)}${round + 1}.${position + 1}`,
            homeSlotKey: slotKeyByEntry.get(home) as DraftKey,
            awaySlotKey: slotKeyByEntry.get(away) as DraftKey,
            status: "ready",
          });
          position += 1;
        });
      });
    }
  });

  return { pools, slots, fixtures };
}
