/**
 * JSON-LD for the marketing pages.
 *
 * Picked by what the page actually is rather than by sprinkling every schema
 * onto every page: a `FAQPage` when there are questions, a `HowTo` for the
 * guides that describe a procedure, an `Article` for a guide and a `WebPage`
 * otherwise so the page states when it last changed, and `BreadcrumbList`
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

/**
 * Who publishes the site, stated once on the homepage and pointed at by `@id`
 * from everywhere else, so every page names the same entity rather than a new
 * anonymous one each time.
 *
 * `sameAs` lists only profiles that are ours and that a stranger can open: a
 * link that 404s, or one to an account that is not ours, is worse than no
 * link. Add the others as they are created.
 */
const organizationId = (site: string) => `${site}/#organization`;
const websiteId = (site: string) => `${site}/#website`;
const applicationId = (site: string) => `${site}/#application`;

export function organization(site: string): ScriptTag {
  return json({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId(site),
    name: "Whistle.day",
    alternateName: ["Whistle Day", "whistleday"],
    url: site,
    logo: `${site}/pwa-512.png`,
    email: "info@whistle.day",
    sameAs: [
      "https://github.com/HonzaTuron/whistle-day",
      "https://smithery.ai/servers/turon-honza/whistle-day",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "info@whistle.day",
      contactType: "customer support",
      availableLanguage: ["en", "cs", "es"],
    },
  });
}

/**
 * The site itself, homepage only. The alternate names are the ways the brand
 * is typed without its dot, so a search for "whistle day" lands on the same
 * entity.
 */
export function website(site: string, dateModified: string): ScriptTag {
  return json({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId(site),
    name: "Whistle.day",
    alternateName: ["Whistle Day", "whistleday"],
    url: site,
    inLanguage: ["en", "cs", "es"],
    publisher: { "@id": organizationId(site) },
    dateModified,
  });
}

/**
 * The app, homepage only, tied to the site it lives on and the organisation
 * behind it so the three read as one graph rather than three strangers.
 *
 * `image` rather than `screenshot`: og.png is a brand card, not a capture of
 * the interface. Swap in real screenshots when there are some to point at.
 */
export function webApplication(site: string): ScriptTag {
  return json({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": applicationId(site),
    name: "Whistle.day",
    alternateName: ["Whistle Day", "whistleday"],
    url: site,
    image: `${site}/og.png`,
    applicationCategory: "SportsApplication",
    applicationSubCategory: "Sports & Event Tournament Management",
    operatingSystem: "All",
    browserRequirements: "Requires JavaScript",
    inLanguage: ["en", "cs", "es"],
    isAccessibleForFree: true,
    isPartOf: { "@id": websiteId(site) },
    author: { "@id": organizationId(site) },
    publisher: { "@id": organizationId(site) },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Round Robin, Swiss, Single & Double Elimination brackets",
      "Live match scoring from any phone",
      "Court scheduling",
      "Self-driving projector and TV hall display",
      "No account required to start, no ads, free",
      "Model Context Protocol (MCP) server",
    ],
  });
}

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

  // A guide is an article; everything else is a page that says when it last
  // changed. Either way the date is the one printed under the heading.
  tags.push(
    json({
      "@context": "https://schema.org",
      "@type": page.kind === "guide" ? "Article" : "WebPage",
      ...(page.kind === "guide" ? { headline: page.h1 } : { name: page.h1 }),
      description: page.description,
      url,
      mainEntityOfPage: url,
      inLanguage: page.locale ?? "en",
      ...(page.published ? { datePublished: page.published } : {}),
      ...(page.updated ? { dateModified: page.updated } : {}),
      ...(page.kind === "guide"
        ? { image: `${site}/og.png`, author: { "@id": organizationId(site) } }
        : {}),
      publisher: { "@id": organizationId(site) },
    }),
  );

  if (page.howTo && page.howTo.length > 0) {
    tags.push(
      json({
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: page.h1,
        inLanguage: page.locale ?? "en",
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
        inLanguage: page.locale ?? "en",
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
        publisher: { "@id": organizationId(site) },
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
