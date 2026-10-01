/**
 * Build the ChatGPT plugin ZIP from `plugins/chatgpt/`.
 *
 * The package is the manifest, the MCP server address, the skills and two
 * icons. The icons are rendered here from the same SVG master the app icons
 * come from (`bun run icons`), so the directory listing cannot drift from the
 * browser tab. The limits checked below are the ones OpenAI's submission
 * reference gives; the dashboard checks them again, but only after an upload.
 *
 *   bun run plugin:chatgpt
 */
import { Resvg } from "@resvg/resvg-js";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { deflateRawSync } from "node:zlib";

const root = join(import.meta.dir, "../plugins/chatgpt");
const iconSvg = join(import.meta.dir, "../apps/web/public/icon.svg");

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function render(size: number, outFile: string): void {
  const png = new Resvg(readFileSync(iconSvg, "utf8"), { fitTo: { mode: "width", value: size } })
    .render()
    .asPng();
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "assets", outFile), png);
}

render(512, "logo.png");
render(128, "icon.png");

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const manifest = JSON.parse(readFileSync(join(root, "plugin.json"), "utf8"));
const openai = manifest.extensions["com.openai"];
const ui = openai.interface;
const problems: string[] = [];

function limit(label: string, value: string | undefined, max: number): void {
  if (!value) problems.push(`${label} is missing`);
  else if (value.length > max) problems.push(`${label} is ${value.length} characters, the limit is ${max}`);
}

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(manifest.name) || manifest.name.length > 64) {
  problems.push("name must be lowercase letters, numbers and single hyphens, at most 64 characters");
}
limit("displayName", ui.displayName, 30);
limit("shortDescription", ui.shortDescription, 30);
limit("longDescription", ui.longDescription, 4000);
limit("developerName", ui.developerName, 80);
for (const key of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
  if (!String(ui[key] ?? "").startsWith("https://")) problems.push(`${key} must be an https URL`);
}
if (ui.capabilities.length > 20) problems.push("at most 20 capabilities");
for (const c of ui.capabilities) limit("a capability", c, 120);
if (ui.defaultPrompt.length > 3) problems.push("at most 3 default prompts");
for (const p of ui.defaultPrompt) limit("a default prompt", p, 128);
for (const [locale, t] of Object.entries<any>(openai.publication?.translations ?? {})) {
  limit(`${locale} subtitle`, t.subtitle, 30);
  limit(`${locale} description`, t.description, 4000);
}

for (const path of [ui.logo, ui.composerIcon, openai.onboardingSkill]) {
  if (!existsSync(join(root, path))) problems.push(`${path} is referenced but not in the package`);
}

const cases = openai.review.test_cases;
if (cases.positive.length !== 5) problems.push(`review needs 5 positive cases, there are ${cases.positive.length}`);
if (cases.negative.length !== 3) problems.push(`review needs 3 negative cases, there are ${cases.negative.length}`);

const servers = Object.keys(JSON.parse(readFileSync(join(root, "mcp.json"), "utf8")).mcpServers);
if (servers.length !== 1) problems.push("mcp.json must declare exactly one server");

for (const skill of readdirSync(join(root, "skills"))) {
  const text = readFileSync(join(root, "skills", skill, "SKILL.md"), "utf8");
  const head = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  if (!/^name: \S/m.test(head) || !/^description: \S/m.test(head)) {
    problems.push(`skills/${skill}/SKILL.md needs name and description in its header`);
  }
}

if (problems.length > 0) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// ZIP
//
// Written by hand rather than shelled out to `zip`, which is not installed
// everywhere this runs. Deflate, no directory entries, no extra fields: the
// plainest archive a reader will accept.
// ---------------------------------------------------------------------------

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = ["plugin.json", "mcp.json"]
  .map((f) => join(root, f))
  .concat(walk(join(root, "skills")), walk(join(root, "assets")))
  .sort();

const chunks: Buffer[] = [];
const central: Buffer[] = [];
let offset = 0;

for (const file of files) {
  const name = Buffer.from(relative(root, file).replaceAll("\\", "/"));
  const data = readFileSync(file);
  const packed = deflateRawSync(data, { level: 9 });
  const crc = Bun.hash.crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(0x00210000, 10); // 1980-01-01, so the archive is reproducible
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);

  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  local.copy(header, 6, 4, 30); // the fields the two records share
  header.writeUInt32LE(offset, 42);

  chunks.push(local, name, packed);
  central.push(header, name);
  offset += local.length + name.length + packed.length;
}

const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);

const out = join(root, "dist", `${manifest.name}-${manifest.version}.zip`);
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(out, Buffer.concat([...chunks, directory, end]));

for (const file of files) console.log(relative(root, file));
console.log(`\n${relative(join(import.meta.dir, ".."), out)}`);
