import { describe, expect, test } from "bun:test";
import { pageBySlug, PAGES } from "./index";
import { PADEL_ES_PAGES } from "./padel-es";
import { presetById } from "../lib/presets";

/**
 * The Spanish padel pages exist to be found, and each one has to hand the
 * wizard the format it just described. A page whose button opens a blank
 * setup, or a format the product cannot draw, is the page that costs more
 * than it earns.
 */

const VARIANTS = [
  {
    slug: "organizar-torneo-de-padel",
    preset: "groups",
    cta: "Crear el torneo",
  },
  {
    slug: "generador-torneo-padel",
    preset: "groups",
    cta: "Crear el sorteo",
  },
  {
    slug: "torneo-padel-grupos-y-cuadro",
    preset: "groups",
    cta: "Crear grupos y cuadro",
  },
  {
    slug: "cuadro-eliminatorio-padel",
    preset: "knockout",
    cta: "Crear el cuadro",
  },
  {
    slug: "torneo-padel-todos-contra-todos",
    preset: "everyone",
    cta: "Crear todos contra todos",
  },
] as const;

describe("Spanish padel pages", () => {
  test("each variant is a page, in Spanish, aimed at the wizard", () => {
    for (const variant of VARIANTS) {
      const page = pageBySlug(variant.slug);
      expect(page, variant.slug).toBeDefined();
      expect(page?.locale).toBe("es");
      expect(page?.cta).toBe(variant.cta);
      expect(page?.generator).toMatchObject({
        preset: variant.preset,
        sport: "padel",
        lang: "es",
      });
      const teams = page?.generator?.teams ?? 0;
      expect(teams).toBeGreaterThanOrEqual(presetById(variant.preset).minTeams);
    }
  });

  test("the organising page names the three formats and refuses americano", () => {
    const page = pageBySlug("organizar-torneo-de-padel");
    const prose = [
      page?.lede,
      ...(page?.sections?.flatMap((section) => section.body) ?? []),
      ...(page?.faq?.flatMap((item) => [item.q, item.a]) ?? []),
    ].join("\n");
    expect(prose).toContain("/torneo-padel-grupos-y-cuadro");
    expect(prose).toContain("/cuadro-eliminatorio-padel");
    expect(prose).toContain("/torneo-padel-todos-contra-todos");
    expect(prose.toLowerCase()).toContain("americano");
    expect(prose).toMatch(/no los genera|No\./);
  });

  test("search aliases land on a page, and americano is not one of them", () => {
    expect(pageBySlug("llave-de-padel")?.slug).toBe("cuadro-eliminatorio-padel");
    expect(pageBySlug("generador-de-torneos-de-padel")?.slug).toBe("generador-torneo-padel");
    expect(pageBySlug("como-organizar-un-torneo-de-padel")?.slug).toBe(
      "organizar-torneo-de-padel",
    );
    expect(PAGES.some((page) => page.slug.includes("americano"))).toBe(false);
  });

  test("the English and Spanish generators point at each other", () => {
    expect(pageBySlug("padel-tournament-generator")?.alternate).toEqual({
      hreflang: "es",
      slug: "generador-torneo-padel",
    });
    expect(pageBySlug("generador-torneo-padel")?.alternate).toEqual({
      hreflang: "en",
      slug: "padel-tournament-generator",
    });
  });

  test("every Spanish page is in the prerender list", () => {
    for (const page of PADEL_ES_PAGES) {
      expect(PAGES.some((listed) => listed.slug === page.slug)).toBe(true);
    }
  });
});
