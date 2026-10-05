/**
 * `/llms.txt`, written from the page list rather than beside it.
 *
 * It used to be a file in `public/`, typed by hand, and it listed about forty
 * of the pages that existed by the time anybody looked. That is the same drift
 * the sitemap avoids by being derived, so this is derived too: a page that is
 * in `PAGES` is in here, under the heading its kind belongs to, described by
 * the sentence already written for its `<meta name="description">`.
 *
 * The format is the one at llmstxt.org — an h1, a blockquote summary, then h2
 * sections of links. "Optional" is part of that format and means what it says:
 * a reader short on context can stop before it. The sized variants and the
 * printables go there, because the generator page above them already answers
 * the question and they are the same answer with a number filled in.
 */

import type { Page, PageKind } from "./types";

const INTRO = `# Whistle.day

> Free tournament organiser: draw a bracket, group stage or Swiss tournament,
> run the day from a phone, and put live scores on a projector or TV. No
> account required to start, no ads, no caps. Also reachable by an AI agent
> over MCP — the same tools the web app's own screens are built on.

Whistle.day supports round robin, single elimination, double elimination and
Swiss formats, in any order (a group stage feeding a playoff, for example).
Results entered from a phone at the court propagate to tables, brackets and
projector screens in under a second. Every tournament gets a shareable link
and a QR code; no signup is required until an organiser wants to keep it.`;

/** In the order they are printed. A kind that is absent here is not listed. */
const SECTIONS: { heading: string; kinds: PageKind[] }[] = [
  { heading: "Formats", kinds: ["hub", "format"] },
  { heading: "Running the day", kinds: ["operational"] },
  { heading: "Sports", kinds: ["sport"] },
  { heading: "Guides", kinds: ["guide"] },
  { heading: "Comparisons", kinds: ["comparison", "roundup"] },
];

const OPTIONAL: PageKind[] = ["parametric", "printable", "legal"];

const line = (page: Page, site: string) =>
  `- [${page.h1}](${site}/${page.slug}): ${page.description}`;

const section = (heading: string, pages: Page[], site: string) =>
  pages.length === 0 ? [] : [`## ${heading}\n\n${pages.map((page) => line(page, site)).join("\n")}`];

export function llmsTxt(pages: Page[], site: string): string {
  // The agent page is the one an agent reading this file is most likely here
  // for, so it leads rather than sitting halfway down "Running the day".
  const agents = pages.filter((page) => page.slug === "mcp");
  const english = pages.filter((page) => !page.locale && page.slug !== "mcp");
  const spanish = pages.filter((page) => page.locale === "es");

  const blocks = [
    INTRO,
    ...section("Agents", agents, site),
    ...SECTIONS.flatMap(({ heading, kinds }) =>
      section(
        heading,
        english.filter((page) => kinds.includes(page.kind)),
        site,
      ),
    ),
    ...section("En español", spanish, site),
    ...section(
      "Optional",
      english.filter((page) => OPTIONAL.includes(page.kind)),
      site,
    ),
  ];

  return `${blocks.join("\n\n")}\n`;
}
