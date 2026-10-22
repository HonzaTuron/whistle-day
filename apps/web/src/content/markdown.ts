/**
 * A marketing page as markdown, for a reader that asked for it.
 *
 * `Accept: text/markdown` is an agent saying it would rather not dig the
 * prose out of a document. These pages are data already, and their paragraphs
 * are written in inline markdown that `PageView` turns into elements — so the
 * markdown is not a conversion of the HTML but the same `Page` printed the
 * other way, and the two cannot say different things.
 *
 * The order is `PageView`'s. What is left out is what is not content: the bar
 * across the top, the footer, and the printable sheet, which is drawn on
 * arrival from `POST /api/preview` and is not in the prerendered HTML either.
 */

import { relatedLink, relatedTitle, type RelatedLink } from "./index";
import type { Page } from "./types";

/** The same words `PageView` puts around the content, in the page's language. */
const CHROME = {
  en: { cta: "Set this up now", faq: "Common questions", updated: "Updated", related: "See also" },
  cs: {
    cta: "Vytvořit turnaj zdarma",
    faq: "Časté dotazy",
    updated: "Aktualizováno",
    related: "Související rozpisy a návody",
  },
  es: {
    cta: "Crear este torneo",
    faq: "Preguntas frecuentes",
    updated: "Actualizado el",
    related: "Ver también",
  },
} as const;

/**
 * Links in the prose are written site-relative, which is right in a document
 * that has an address and wrong in text that has been lifted out of one.
 */
const absolute = (text: string, site: string) => text.replaceAll("](/", `](${site}/`);

function cta(page: Page, site: string, label: string): string[] {
  if (!page.generator) return [];
  const { preset, sport, lang } = page.generator;
  const search = new URLSearchParams({ preset });
  if (sport) search.set("sport", sport);
  const asked = lang ?? page.locale;
  if (asked) search.set("lang", asked);
  return [`[${page.cta ?? label}](${site}/new?${search})`];
}

export function pageMarkdown(page: Page, site: string): string {
  const chrome = page.locale === "cs" ? CHROME.cs : page.locale === "es" ? CHROME.es : CHROME.en;
  const blocks: string[] = [`# ${page.h1}`, absolute(page.lede, site)];

  if (page.updated) blocks.push(`${chrome.updated} ${page.updated}`);

  if (page.facts && page.facts.length > 0) {
    blocks.push(
      page.facts
        .map(
          (fact) =>
            `- **${fact.label}:** ${fact.value}${fact.note ? ` — ${absolute(fact.note, site)}` : ""}`,
        )
        .join("\n"),
    );
  }

  blocks.push(...cta(page, site, chrome.cta));

  for (const grid of page.teamGrids ?? []) {
    const lines = [`## ${grid.heading}`];
    if (grid.description) lines.push(absolute(grid.description, site));
    lines.push(
      grid.items
        .map(
          (item) =>
            `- [${item.label ?? `${item.teams} teams`}](${site}/${item.slug})${item.badge ? ` (${item.badge})` : ""}`,
        )
        .join("\n"),
    );
    blocks.push(...lines);
  }

  for (const section of page.sections ?? []) {
    blocks.push(`## ${section.heading}`, ...section.body.map((text) => absolute(text, site)));
    for (const block of section.code ?? []) {
      if (block.label) blocks.push(`${block.label}:`);
      blocks.push(`\`\`\`\n${block.code}\n\`\`\``);
    }
  }

  if (page.faq && page.faq.length > 0) {
    blocks.push(`## ${chrome.faq}`);
    for (const item of page.faq) blocks.push(`### ${item.q}`, absolute(item.a, site));
  }

  const related = (page.related ?? [])
    .map(relatedLink)
    .filter((link): link is RelatedLink => link !== undefined);
  if (related.length > 0) {
    blocks.push(
      `## ${chrome.related}`,
      related
        .map((link) => {
          const query = link.teams ? `?teams=${link.teams}` : "";
          return `- [${relatedTitle(link)}](${site}/${link.page.slug}${query})`;
        })
        .join("\n"),
    );
  }

  return `${blocks.join("\n\n")}\n`;
}
