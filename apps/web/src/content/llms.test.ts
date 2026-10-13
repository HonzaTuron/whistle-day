import { describe, expect, test } from "bun:test";
import { HOME_UPDATED, MARKETING_LASTMOD, PAGES } from "./index";
import { llmsTxt } from "./llms";
import { pageMarkdown } from "./markdown";
import { organization, structuredData, webApplication, website } from "./schema";

/**
 * The things a crawler reads that a person never checks: the link list, the
 * dates, and the JSON-LD. Each is derived from `PAGES`, and each is only
 * worth having while it agrees with the page it describes.
 */

const SITE = "https://whistle.day";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

describe("llms.txt", () => {
  const text = llmsTxt(PAGES, SITE);

  test("lists every page exactly once", () => {
    for (const page of PAGES) {
      expect(text.split(`](${SITE}/${page.slug})`).length - 1).toBe(1);
    }
  });

  test("opens with the title and the summary the format asks for", () => {
    expect(text.startsWith("# Whistle.day\n\n> ")).toBe(true);
  });

  test("puts the sized variants where a reader can skip them", () => {
    const optional = text.slice(text.indexOf("## Optional"));
    const parametric = PAGES.filter((page) => page.kind === "parametric" && !page.locale);
    expect(parametric.length).toBeGreaterThan(0);
    for (const page of parametric) expect(optional).toContain(`${SITE}/${page.slug})`);
  });
});

describe("page dates", () => {
  test("every page says when it was published and last changed", () => {
    for (const page of PAGES) {
      expect(page.published).toMatch(DAY);
      expect(page.updated).toMatch(DAY);
      expect(page.updated! >= page.published!).toBe(true);
      expect(MARKETING_LASTMOD[`/${page.slug}`]).toBe(page.updated);
    }
    expect(HOME_UPDATED).toMatch(DAY);
  });

  test("the JSON-LD carries the same date the page prints", () => {
    for (const page of PAGES) {
      const nodes = structuredData(page, SITE).map((tag) => JSON.parse(tag.children));
      const type = page.kind === "guide" ? "Article" : "WebPage";
      const node = nodes.find((candidate) => candidate["@type"] === type);
      expect(node?.dateModified).toBe(page.updated);
      expect(node?.publisher).toEqual({ "@id": `${SITE}/#organization` });
    }
  });
});

describe("homepage entity graph", () => {
  const parse = (tag: { children: string }) => JSON.parse(tag.children);
  const org = parse(organization(SITE));
  const site = parse(website(SITE, HOME_UPDATED));
  const app = parse(webApplication(SITE));

  test("the app points at the site, and both at the organisation", () => {
    expect(site.publisher).toEqual({ "@id": org["@id"] });
    expect(app.publisher).toEqual({ "@id": org["@id"] });
    expect(app.author).toEqual({ "@id": org["@id"] });
    expect(app.isPartOf).toEqual({ "@id": site["@id"] });
    expect(new Set([org["@id"], site["@id"], app["@id"]]).size).toBe(3);
  });

  test("the brand is findable without its dot", () => {
    expect(site.alternateName).toContain("Whistle Day");
    expect(site.alternateName).toContain("whistleday");
  });
});

describe("markdown for agents", () => {
  test("every page prints its heading, its lede and its sections", () => {
    for (const page of PAGES) {
      const text = pageMarkdown(page, SITE);
      expect(text.startsWith(`# ${page.h1}\n\n`)).toBe(true);
      for (const section of page.sections ?? []) expect(text).toContain(`## ${section.heading}\n`);
      for (const item of page.faq ?? []) expect(text).toContain(`### ${item.q}\n`);
    }
  });

  test("no link is left pointing at a site the text is no longer on", () => {
    for (const page of PAGES) expect(pageMarkdown(page, SITE)).not.toContain("](/");
  });

  test("the call to action carries the page's defaults into the wizard", () => {
    const page = PAGES.find((candidate) => candidate.generator?.preset && candidate.locale === "es")!;
    expect(pageMarkdown(page, SITE)).toContain(
      `](${SITE}/new?preset=${page.generator!.preset}`,
    );
    expect(pageMarkdown(page, SITE)).toContain("lang=es)");
  });
});
