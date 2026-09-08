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
import { FORMAT_PAGES, HUB } from "./formats";
import { GUIDE_PAGES } from "./guides";
import { LEGAL_PAGES } from "./legal";
import { OPERATIONAL_PAGES } from "./operational";
import { PARAMETRIC_PAGES, SLUG_ALIASES as PARAMETRIC_ALIASES } from "./parametric";
import { PRINTABLE_PAGES } from "./printables";
import { SPORT_PAGES } from "./sports";
import type { Page } from "./types";

const ALL: Page[] = [
  HUB,
  ...FORMAT_PAGES,
  ...PARAMETRIC_PAGES,
  ...SPORT_PAGES,
  ...OPERATIONAL_PAGES,
  ...GUIDE_PAGES,
  ...COMPARISON_PAGES,
  ...PRINTABLE_PAGES,
  ...LEGAL_PAGES,
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
  related: page.related?.filter((slug) => BY_SLUG.has(slug) && slug !== page.slug),
}));

const RESOLVED = new Map(PAGES.map((page) => [page.slug, page]));

export const SLUG_ALIASES: Record<string, string> = {
  ...PARAMETRIC_ALIASES,
  "privacy-policy": "privacy",
  "terms-of-service": "terms",
  "terms-of-use": "terms",
  "data-deletion": "user-deletion",
  "delete-account": "user-deletion",
  "account-deletion": "user-deletion",
};

/** The page at this slug, following an alias if there is one. */
export function pageBySlug(slug: string): Page | undefined {
  return RESOLVED.get(SLUG_ALIASES[slug] ?? slug);
}

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

export type { Page } from "./types";
