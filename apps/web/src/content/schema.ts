/**
 * JSON-LD for the marketing pages.
 *
 * Three types, picked by what the page actually is rather than by sprinkling
 * every schema onto every page: a `FAQPage` when there are questions, a
 * `HowTo` for the guides that describe a procedure, and `BreadcrumbList`
 * everywhere so a result shows where the page sits rather than a bare URL.
 *
 * Marking up a FAQ that is not on the page, or a HowTo with no steps, is the
 * sort of thing that earns a manual action. So each block is emitted only when
 * the page has the content it claims.
 */

import type { Page } from "./types";

interface ScriptTag {
  type: "application/ld+json";
  children: string;
}

const json = (value: unknown): ScriptTag => ({
  type: "application/ld+json",
  children: JSON.stringify(value),
});

/** "guide/how-many-swiss-rounds" → Guides. Drives the breadcrumb trail. */
function trail(page: Page): { name: string; slug: string }[] {
  const [prefix] = page.slug.split("/");
  if (prefix === "guide") return [{ name: "Guides", slug: "tournament-generator" }];
  if (prefix === "vs" || prefix === "alternatives")
    return [{ name: "Comparisons", slug: "alternatives/free-tournament-bracket-software" }];
  return [];
}

export function structuredData(page: Page, site: string): ScriptTag[] {
  const url = `${site}/${page.slug}`;
  const tags: ScriptTag[] = [];

  tags.push(
    json({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Whistle.day", item: site },
        ...trail(page).map((step, i) => ({
          "@type": "ListItem",
          position: i + 2,
          name: step.name,
          item: `${site}/${step.slug}`,
        })),
        {
          "@type": "ListItem",
          position: trail(page).length + 2,
          name: page.h1,
          item: url,
        },
      ],
    }),
  );

  if (page.howTo && page.howTo.length > 0) {
    tags.push(
      json({
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: page.h1,
        step: page.howTo.map((step) => ({
          "@type": "HowToStep",
          name: step.name,
          text: step.text,
        })),
      }),
    );
  }

  if (page.faq && page.faq.length > 0) {
    tags.push(
      json({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: page.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }),
    );
  }

  // Emit SoftwareApplication for the hub, format pages, parametric format pages, MCP, and comparisons
  const isFormat = page.kind === "format" || page.kind === "parametric" || page.generator !== undefined;
  const isMcp = page.slug === "mcp";
  const isComparison = page.kind === "comparison" || page.slug.startsWith("vs/");
  const isHub = page.kind === "hub";

  if (isHub || isFormat || isMcp || isComparison) {
    tags.push(
      json({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: isMcp ? "Whistle.day MCP Server" : "Whistle.day",
        applicationCategory: isMcp
          ? "DeveloperApplication, SportsApplication"
          : "SportsApplication",
        applicationSubCategory: isMcp
          ? "Tournament Management MCP Server"
          : "Sports & Event Tournament Management",
        operatingSystem: "Web, Mobile",
        url: isMcp ? `${site}/mcp` : site,
        description: page.description,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        featureList: isMcp
          ? [
              "21 MCP tools over Streamable HTTP",
              "OAuth 2.1 authentication with PKCE",
              "Round Robin, Swiss, Single & Double Elimination brackets",
              "Live match scoring, court scheduling & projector displays",
              "Disposable anonymous sessions or account sign-in",
            ]
          : [
              "Instant bracket and schedule generation",
              "No account required to start",
              "Live court scheduling & referee phone scoring",
              "Self-driving hall projector display",
              "No ads, 100% free",
            ],
      }),
    );
  }

  return tags;
}
