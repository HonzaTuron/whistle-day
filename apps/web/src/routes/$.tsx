import {
  createFileRoute,
  notFound,
  redirect,
} from "@tanstack/react-router";
import { PageView } from "../components/marketing/PageView";
import { canonicalSlug, pageBySlug } from "../content";
import { structuredData } from "../content/schema";
import type { Page } from "../content/types";

const SITE = "https://whistle.day";

/**
 * Every marketing page, at the root, off one route.
 *
 * The slugs already carry their own shape — "vs/challonge",
 * "guide/how-many-swiss-rounds", "16-team-single-elimination-bracket" — so a
 * splat matches all of them without four near-identical route files that
 * differ only in a prefix.
 *
 * It ranks below every static and parameterised route, so `/new`, `/account`
 * and `/t/$id` are matched by their own routes first and only what nothing
 * else claimed arrives here.
 */
export const Route = createFileRoute("/$")({
  loader: ({ params }) => {
    const slug = params._splat ?? "";

    // "4-groups-of-4" is how somebody searches for what this calls a 16-team
    // group stage. One canonical page, and the other wording redirects to it.
    const canonical = canonicalSlug(slug);
    if (canonical) throw redirect({ to: "/$", params: { _splat: canonical } });

    const page = pageBySlug(slug);
    if (!page) throw notFound();
    return page;
  },

  head: ({ loaderData: page }) => {
    if (!page) return {};
    const url = `${SITE}/${page.slug}`;
    return {
      meta: [
        { title: page.title },
        { name: "description", content: page.description },
        { property: "og:title", content: page.title },
        { property: "og:description", content: page.description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Whistle.day" },
        { property: "og:image", content: `${SITE}/og.png` },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:type", content: "image/png" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: page.title },
        { name: "twitter:description", content: page.description },
        { name: "twitter:image", content: `${SITE}/og.png` },
      ],
      links: [
        { rel: "canonical", href: url },
        ...languageLinks(page, SITE),
      ],
      scripts: structuredData(page, SITE),
    };
  },

  component: MarketingPage,
});

function MarketingPage() {
  return <PageView page={Route.useLoaderData()} />;
}

/**
 * Both versions of a page, including itself, so a Spanish result and the
 * English one are alternates rather than duplicates. Omitted when the page
 * has no twin — a hreflang that points only at itself is noise.
 */
function languageLinks(page: Page, site: string): { rel: "alternate"; hrefLang: string; href: string }[] {
  if (!page.alternate && !page.locale) return [];
  const self = page.locale ?? "en";
  const links: { rel: "alternate"; hrefLang: string; href: string }[] = [
    { rel: "alternate", hrefLang: self, href: `${site}/${page.slug}` },
  ];
  if (page.alternate) {
    links.push({
      rel: "alternate",
      hrefLang: page.alternate.hreflang,
      href: `${site}/${page.alternate.slug}`,
    });
  }
  const english =
    self === "en" ? `${site}/${page.slug}` : page.alternate ? `${site}/${page.alternate.slug}` : undefined;
  if (english) links.push({ rel: "alternate", hrefLang: "x-default", href: english });
  return links;
}
