import {
  createFileRoute,
  notFound,
  redirect,
} from "@tanstack/react-router";
import { PageView } from "../components/marketing/PageView";
import { canonicalSlug, pageBySlug } from "../content";
import { structuredData } from "../content/schema";

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
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: page.title },
        { name: "twitter:description", content: page.description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: structuredData(page, SITE),
    };
  },

  component: MarketingPage,
});

function MarketingPage() {
  return <PageView page={Route.useLoaderData()} />;
}
