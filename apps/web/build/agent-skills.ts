import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const SITE = "https://whistle.day";
const SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
const ROOT = "/.well-known/agent-skills";

/** The skills are the ChatGPT plugin's; this publishes them, it does not own them. */
const SOURCE = fileURLToPath(new URL("../../../plugins/chatgpt/skills", import.meta.url));

/**
 * The skills call tools and say nothing about where the tools are, because in
 * the plugin `mcp.json` says it for them. An agent that found one here has no
 * `mcp.json`, so the index entry carries the address.
 */
const NEEDS = `Needs the Whistle.day MCP server at ${SITE}/api/mcp.`;

export interface Skill {
  name: string;
  description: string;
  /** The file exactly as it is served, which is what the digest is of. */
  body: Buffer;
}

const field = (frontMatter: string, key: string) =>
  frontMatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1].trim();

export async function readSkills(directory = SOURCE): Promise<Skill[]> {
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    names.map(async (name) => {
      const body = await readFile(`${directory}/${name}/SKILL.md`);
      const frontMatter = body.toString().match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      const description = field(frontMatter, "description");

      // The index names a skill by its directory and the file names itself;
      // an agent that fetched one and read the other should not be told two
      // things.
      if (field(frontMatter, "name") !== name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
        throw new Error(`agent-skills: ${name}/SKILL.md does not name itself "${name}"`);
      }
      if (!description) throw new Error(`agent-skills: ${name}/SKILL.md has no description`);

      return { name, description, body };
    }),
  );
}

/**
 * `/.well-known/agent-skills/index.json`, per the Agent Skills Discovery RFC.
 *
 * Derived for the reason `/llms.txt` is: the digest is a promise about the
 * bytes at `url`, and a hash typed in beside a file is wrong from the first
 * edit to that file onwards.
 */
export function skillsIndex(skills: Skill[], site = SITE): string {
  const index = {
    $schema: SCHEMA,
    skills: skills.map((skill) => ({
      name: skill.name,
      type: "skill-md",
      description: `${skill.description} ${NEEDS}`,
      url: `${site}${ROOT}/${skill.name}/SKILL.md`,
      digest: `sha256:${createHash("sha256").update(skill.body).digest("hex")}`,
    })),
  };
  return `${JSON.stringify(index, null, 2)}\n`;
}

/**
 * Writes the index and a copy of each skill once the client build has
 * finished, for the reason `llmsTxt()` gives, and answers the same addresses
 * in dev.
 */
export function agentSkills(): Plugin {
  return {
    name: "whistleday:agent-skills",

    configureServer(server) {
      server.middlewares.use(ROOT, async (request, response, next) => {
        const path = (request.url ?? "").split("?")[0];
        const skills = await readSkills();

        if (path === "/index.json") {
          response.setHeader("Content-Type", "application/json");
          return response.end(skillsIndex(skills));
        }
        const skill = skills.find((candidate) => path === `/${candidate.name}/SKILL.md`);
        if (!skill) return next();
        response.setHeader("Content-Type", "text/markdown; charset=utf-8");
        response.end(skill.body);
      });
    },

    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        const environment = (this as { environment?: { name?: string } }).environment;
        if (environment?.name !== "client") return;

        const skills = await readSkills();
        const out = `dist/client${ROOT}`;
        for (const skill of skills) {
          await mkdir(`${out}/${skill.name}`, { recursive: true });
          await writeFile(`${out}/${skill.name}/SKILL.md`, skill.body);
        }
        await writeFile(`${out}/index.json`, skillsIndex(skills));
        this.info(`agent-skills: ${skills.length} skills published`);
      },
    },
  };
}
