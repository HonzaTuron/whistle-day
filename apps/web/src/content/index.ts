/**
 * Every page that exists to be found, in one list.
 *
 * This module is the single source of truth for three things that must agree:
 * which URLs the router will serve, which URLs the build prerenders, and which
 * URLs are in the sitemap. They are derived from the same array rather than
 * maintained alongside each other, because a sitemap listing a page the router
 * does not serve is a crawl error, and a page the router serves that the
 * sitemap omits is a page nobody finds.
 *
 * `vite.config.ts` imports `MARKETING_PATHS` from here for exactly that
 * reason. It is the one import that crosses from application code into build
 * configuration, and it is worth it.
 */

import { COMPARISON_PAGES } from "./comparisons";
import { CZECH_ALIASES, CZECH_PAGES } from "./czech";
import { FORMAT_PAGES, HUB } from "./formats";
import { GUIDE_PAGES } from "./guides";
import { LEGAL_PAGES } from "./legal";
import { OPERATIONAL_PAGES } from "./operational";
import { PADEL_ES_ALIASES, PADEL_ES_PAGES } from "./padel-es";
import { PARAMETRIC_PAGES, SLUG_ALIASES as PARAMETRIC_ALIASES } from "./parametric";
import { PRINTABLE_PAGES } from "./printables";
import { SPORT_PAGES } from "./sports";
import type { Page } from "./types";

/**
 * Stamp a collection with the dates its file was first published and last
 * edited. A page that carries its own date keeps it.
 *
 * Bump `updated` in the same commit that changes the copy — not on a reformat,
 * and not on a deploy. The visible "Updated" line, the JSON-LD and the sitemap
 * all read these, so a date moved without a reason is a claim made three times.
 */
const dated = (pages: Page[], published: string, updated: string): Page[] =>
  pages.map((page) => ({ published, updated, ...page }));

const ALL: Page[] = [
  ...dated([HUB, ...FORMAT_PAGES], "2026-09-04", "2026-10-22"),
  ...dated(PARAMETRIC_PAGES, "2026-09-04", "2026-10-22"),
  ...dated(SPORT_PAGES, "2026-09-04", "2026-09-21"),
  ...dated(PADEL_ES_PAGES, "2026-09-21", "2026-09-21"),
  ...dated(CZECH_PAGES, "2026-10-22", "2026-10-22"),
  ...dated(OPERATIONAL_PAGES, "2026-09-04", "2026-10-05"),
  ...dated(GUIDE_PAGES, "2026-09-04", "2026-09-17"),
  ...dated(COMPARISON_PAGES, "2026-09-04", "2026-09-17"),
  ...dated(PRINTABLE_PAGES, "2026-09-04", "2026-10-22"),
  ...dated(LEGAL_PAGES, "2026-09-08", "2026-10-01"),
];

/**
 * Slugs have to be unique — they are the routing key — and a duplicate is
 * silent otherwise: the second page simply never renders. Cheap to check, and
 * the generated pages make collisions easy to introduce.
 */
function assertUniqueSlugs(pages: Page[]): void {
  const seen = new Set<string>();
  const clashes = pages
    .map((page) => page.slug)
    .filter((slug) => (seen.has(slug) ? true : (seen.add(slug), false)));
  if (clashes.length > 0) {
    throw new Error(`Duplicate page slugs: ${[...new Set(clashes)].join(", ")}`);
  }
}

assertUniqueSlugs(ALL);

const BY_SLUG = new Map(ALL.map((page) => [page.slug, page]));

/**
 * Drop `related` entries that do not resolve.
 *
 * The generated pages link to neighbours by arithmetic — the 3-team page wants
 * a 2-team page that is not in the range — and hand-written pages link to
 * slugs that get renamed. Rather than let either produce a link to a 404, the
 * unresolvable ones are removed here, once, at module load.
 *
 * They are dropped rather than thrown on because a broken cross-link should
 * not take down the site; a missing "see also" is a smaller failure than every
 * page failing to render.
 */
export const PAGES: Page[] = ALL.map((page) => ({
  ...page,
  related: page.related?.filter((entry) => {
    const slug = slugOf(entry);
    return BY_SLUG.has(slug) && slug !== page.slug;
  }),
  // The English padel page is the other half of the Spanish generator. Set
  // here so the two hreflang links cannot point at a slug the other does not
  // have — both slugs are in ALL, or this throws below when the alternate
  // is unresolved. Checked with the aliases, not by a second map.
  alternate:
    page.slug === "padel-tournament-generator"
      ? { hreflang: "es", slug: "generador-torneo-padel" }
      : page.alternate,
}));

const RESOLVED = new Map(PAGES.map((page) => [page.slug, page]));

export const SLUG_ALIASES: Record<string, string> = {
  ...PARAMETRIC_ALIASES,
  ...PADEL_ES_ALIASES,
  ...CZECH_ALIASES,
  "privacy-policy": "privacy",
  "terms-of-service": "terms",
  "terms-of-use": "terms",
  "data-deletion": "user-deletion",
  "delete-account": "user-deletion",
  "account-deletion": "user-deletion",
  support: "contact",
  "contact-us": "contact",
};

/** The page at this slug, following an alias if there is one. */
export function pageBySlug(slug: string): Page | undefined {
  return RESOLVED.get(SLUG_ALIASES[slug] ?? slug);
}

/**
 * A `related` entry is a slug, or a slug asking for a field size:
 * "printable/bracket?teams=12". That is how a page about twelve teams points
 * at a sheet drawn for twelve without a printable page for every size.
 */
export interface RelatedLink {
  page: Page;
  teams?: number;
}

function slugOf(entry: string): string {
  return entry.split("?")[0]!;
}

/** A `related` entry, resolved to its page and the size it asks for. */
export function relatedLink(entry: string): RelatedLink | undefined {
  const page = pageBySlug(slugOf(entry));
  if (!page) return undefined;
  const teams = Number(new URLSearchParams(entry.split("?")[1]).get("teams"));
  return Number.isInteger(teams) && teams > 0 ? { page, teams } : { page };
}

/** The words a related link is shown with. */
export const relatedTitle = ({ page, teams }: RelatedLink): string =>
  teams ? `${page.h1} for ${teams} teams` : page.h1;

/** Where an alias should redirect to, or undefined if the slug is canonical. */
export function canonicalSlug(slug: string): string | undefined {
  const target = SLUG_ALIASES[slug];
  return target && RESOLVED.has(target) ? target : undefined;
}

export const pagesOfKind = (kind: Page["kind"]) =>
  PAGES.filter((page) => page.kind === kind);

/**
 * Every marketing URL, for the prerenderer and the sitemap.
 *
 * Aliases are deliberately absent: they redirect, and a sitemap should list
 * the destination rather than the redirect.
 */
export const MARKETING_PATHS: string[] = PAGES.map((page) => `/${page.slug}`);

/**
 * The same URLs with the date each one last changed, for the sitemap's
 * `<lastmod>`. Left to itself the sitemap stamps every URL with the build day.
 */
export const MARKETING_LASTMOD: Record<string, string | undefined> = Object.fromEntries(
  PAGES.map((page) => [`/${page.slug}`, page.updated]),
);

/** The homepage is a screen rather than a `Page`, so its date lives here. */
export const HOME_UPDATED = "2026-10-05";

/**
 * The language a prerendered marketing page is written in, if it is not
 * English. The homepage has no slug and follows the visitor instead.
 */
export function localeOfPath(pathname: string): Page["locale"] {
  const slug = pathname.replace(/^\/+|\/+$/g, "");
  if (!slug) return undefined;
  return pageBySlug(slug)?.locale;
}

export type { Page } from "./types";
