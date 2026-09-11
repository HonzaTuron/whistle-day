/**
 * The shape of every page that exists to be found.
 *
 * Whistle.day does one thing — take a list of teams and a format, and run the day —
 * and people search for it a hundred different ways. "Round robin generator",
 * "8 team double elimination bracket", "how many Swiss rounds for 16 players",
 * "free Challonge alternative". Each of those is the same product answering a
 * narrower question, so each gets a page that answers it and then offers the
 * thing that does it.
 *
 * These pages are data rather than components because there are over a hundred
 * of them and the interesting differences between them are three numbers and a
 * paragraph. The route renders whichever one the slug names; the build reads
 * the same list to decide what to prerender and what goes in the sitemap, so
 * the three can never disagree about which pages exist.
 */

import type { PresetId } from "../lib/presets";

/**
 * What sort of page this is. It picks the layout and nothing else — the router
 * finds pages by slug, not by kind.
 */
export type PageKind =
  | "hub"
  | "format"
  | "parametric"
  | "sport"
  | "operational"
  | "guide"
  | "comparison"
  | "roundup"
  | "printable"
  | "legal";

/** One command or config snippet, shown verbatim in a monospace block. */
export interface CodeBlock {
  /** What it is — "Claude Code", "curl" — shown above the block. */
  label?: string;
  code: string;
}

/** A prose block. Headed sections become `<h2>`s and land in the page outline. */
export interface Section {
  heading: string;
  /** Each string is a paragraph. Inline markdown (bold, italic, code, links) is supported. */
  body: string[];
  /** Verbatim snippets under the prose — the one thing prose can't be. */
  code?: CodeBlock[];
}

/**
 * One number the page exists to state.
 *
 * These are the answer to the query on most parametric pages — somebody
 * searching "12 team round robin" wants to know it is 66 matches before they
 * want anything else — so they are rendered first, above the prose.
 *
 * Every one of them is computed by the same functions the wizard quotes from,
 * never typed in. A page that says 66 matches and a wizard that then runs 65
 * is worse than no page at all.
 */
export interface Fact {
  label: string;
  value: string;
  /** The line underneath, when the number needs one. */
  note?: string;
}

export interface Faq {
  q: string;
  a: string;
}

/**
 * What the page's call to action should hand the wizard.
 *
 * A page about an eight-team knockout should not drop somebody onto an empty
 * "name your tournament" screen — it should start them where its own numbers
 * came from. `/new` reads these off the search params.
 */
export interface GeneratorDefaults {
  preset: PresetId;
  teams?: number;
  sport?: string;
}

export interface Page {
  /** Path without a leading slash: "8-team-single-elimination-bracket". */
  slug: string;
  kind: PageKind;
  /** `<title>`. Under ~60 characters, and never the h1 verbatim. */
  title: string;
  h1: string;
  /** `<meta name="description">`. One sentence, under ~155 characters. */
  description: string;
  /** The paragraph under the h1. Answers the query before anything else does. */
  lede: string;
  facts?: Fact[];
  sections?: Section[];
  faq?: Faq[];
  generator?: GeneratorDefaults;
  /** Slugs of pages worth offering next. Rendered as links; must resolve. */
  related?: string[];
}

/** The URL a page lives at, with its leading slash. */
export const pathOf = (page: Page) => `/${page.slug}`;
