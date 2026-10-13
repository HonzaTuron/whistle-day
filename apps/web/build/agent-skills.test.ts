import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { readSkills, skillsIndex } from "./agent-skills";

describe("agent skills index", () => {
  test("lists every skill the plugin ships, with the digest of what is served", async () => {
    const skills = await readSkills();
    const index = JSON.parse(skillsIndex(skills));

    expect(index.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json");
    expect(index.skills.map((skill: { name: string }) => skill.name)).toEqual([
      "enter-results",
      "plan-a-tournament",
    ]);

    for (const [i, entry] of index.skills.entries()) {
      expect(entry.type).toBe("skill-md");
      expect(entry.url).toBe(
        `https://whistle.day/.well-known/agent-skills/${entry.name}/SKILL.md`,
      );
      expect(entry.description).toContain("https://whistle.day/api/mcp");
      expect(entry.digest).toBe(
        `sha256:${createHash("sha256").update(skills[i].body).digest("hex")}`,
      );
      expect(entry.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });
});
