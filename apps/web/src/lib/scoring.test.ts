import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { Tiebreaker } from "@whistleday/engine";
import { SPORTS, sportById, DEFAULT_SPORT, type SportId } from "./scoring";

/**
 * The wizard's chips and the server's presets are the same table.
 *
 * They have to be. The wizard writes `tournaments.scoring` when an organiser
 * taps a sport; `create_tournament` writes it when an agent names one; and the
 * server reads it back to decide whether a level score is a result and whether
 * a best-of-three is over. Two tables that disagree means a volleyball day set
 * up by an agent is scored differently from the identical one set up on a
 * phone — which nobody would notice until a standings screen in a hall.
 *
 * So `backend/internal/tournament/sports.json` is the one both read: Go embeds
 * it, and this reads the same bytes off disk and checks the chips still match.
 * Not a copy of the file, the file.
 *
 * Labels and hints are not in it, and should not be: they are i18n message
 * keys, and a server that never renders a word has no use for them.
 */

/**
 * The narrow types are asserted, not proven — the file is JSON and knows
 * nothing about them. That is the point of the comparison below: if the file
 * grows a sport or a tiebreak the catalogue does not have, this is where it
 * stops being true.
 */
interface Preset {
  id: SportId;
  sport: string;
  scoring: {
    bestOf: number;
    pointsWin: number;
    pointsDraw: number;
    pointsLoss: number;
    drawsAllowed: boolean;
    walkoverScore: number;
    tiebreakers: Tiebreaker[];
  };
}

const SHARED = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  "backend",
  "internal",
  "tournament",
  "sports.json",
);

const presets = (await Bun.file(SHARED).json()) as Preset[];

describe("the sport presets the server enforces", () => {
  test("the file is where both sides think it is", () => {
    expect(presets.length).toBeGreaterThan(0);
  });

  test("the wizard offers exactly what the server knows", () => {
    expect(SPORTS.map((s) => s.id).sort()).toEqual(presets.map((p) => p.id).sort());
  });

  test("and agrees with it, number for number", () => {
    for (const preset of presets) {
      const chip = sportById(preset.id);

      expect(chip.id).toBe(preset.id);
      // `sport` is what the projector prints under the tournament name.
      expect(chip.sport).toBe(preset.sport);

      expect(chip.scoring.bestOf).toBe(preset.scoring.bestOf);
      expect(chip.scoring.pointsWin).toBe(preset.scoring.pointsWin);
      expect(chip.scoring.pointsDraw).toBe(preset.scoring.pointsDraw);
      expect(chip.scoring.pointsLoss).toBe(preset.scoring.pointsLoss);
      expect(chip.scoring.walkoverScore).toBe(preset.scoring.walkoverScore);
      // Absent and false are different answers everywhere else in this system,
      // so the preset must say which it means rather than leave it out.
      expect(chip.scoring.drawsAllowed).toBe(preset.scoring.drawsAllowed);
      expect(chip.scoring.tiebreakers).toEqual(preset.scoring.tiebreakers);
    }
  });

  test("the generic one exists, because it is the default", () => {
    expect(presets.some((p) => p.id === DEFAULT_SPORT)).toBe(true);
  });

  test("volleyball is the one that would be wrong if this drifted", () => {
    // The specific bug this guards: a hall sport scored as football — draws
    // allowed and worth a point, and a match treated as one game.
    const volleyball = presets.find((p) => p.id === "volleyball");
    expect(volleyball?.scoring.drawsAllowed).toBe(false);
    expect(volleyball?.scoring.bestOf).toBe(3);
  });
});
