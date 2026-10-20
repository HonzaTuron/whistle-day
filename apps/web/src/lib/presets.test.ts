import { describe, expect, it } from "bun:test";
import { defaultPreset, presetById, suits } from "./presets";

describe("three teams", () => {
  it("is never handed a knockout: the bye is a free pass to the final", () => {
    expect(defaultPreset(3)).toBe("everyone");
    expect(suits(presetById("knockout"), 3)).toBe(false);
    expect(presetById("knockout").caveat?.(3)).toBe("preset.knockout.three");
  });

  it("leaves the knockout alone either side of it", () => {
    expect(suits(presetById("knockout"), 2)).toBe(true);
    expect(suits(presetById("knockout"), 4)).toBe(true);
  });
});
