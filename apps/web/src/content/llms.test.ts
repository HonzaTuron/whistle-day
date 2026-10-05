import { describe, expect, test } from "bun:test";
import { HOME_UPDATED, MARKETING_LASTMOD, PAGES } from "./index";
import { llmsTxt } from "./llms";
import { structuredData } from "./schema";

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
