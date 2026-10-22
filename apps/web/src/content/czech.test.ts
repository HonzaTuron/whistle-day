import { describe, expect, test } from "bun:test";
import { CZECH_PAGES, CZECH_ALIASES } from "./czech";
import { pageBySlug, PAGES } from "./index";

describe("Czech marketing pages", () => {
  test("every Czech page has locale cs and valid metadata", () => {
    expect(CZECH_PAGES.length).toBeGreaterThanOrEqual(7);
    for (const page of CZECH_PAGES) {
      expect(page.locale).toBe("cs");
      expect(page.title.length).toBeGreaterThan(10);
      expect(page.h1.length).toBeGreaterThan(5);
      expect(page.description.length).toBeGreaterThan(20);
      expect(page.lede.length).toBeGreaterThan(20);
      expect(page.generator?.lang).toBe("cs");
    }
  });

  test("Czech hubs point to their English alternates and vice versa", () => {
    const pairs: [string, string][] = [
      ["generator-turnaju", "tournament-generator"],
      ["pavouk-turnaje-generator", "single-elimination-bracket-generator"],
      ["rozpis-kazdy-s-kazdym-tabulka", "round-robin-generator"],
      ["svycarsky-system-turnaj-rozpis", "swiss-tournament-generator"],
      ["skupiny-a-play-off-generator", "group-stage-knockout-generator"],
      ["printable/pavouk-turnaje", "printable/bracket"],
      ["printable/rozpis-kazdy-s-kazdym", "printable/round-robin-schedule"],
    ];

    for (const [csSlug, enSlug] of pairs) {
      const csPage = pageBySlug(csSlug);
      const enPage = pageBySlug(enSlug);
      expect(csPage).toBeDefined();
      expect(enPage).toBeDefined();
      expect(csPage?.alternate?.slug).toBe(enSlug);
      expect(csPage?.alternate?.hreflang).toBe("en");
      expect(enPage?.alternate?.slug).toBe(csSlug);
      expect(enPage?.alternate?.hreflang).toBe("cs");
    }
  });

  test("Czech search aliases resolve to canonical destinations", () => {
    expect(pageBySlug("pavouk-turnaje")?.slug).toBe("pavouk-turnaje-generator");
    expect(pageBySlug("pavouk")?.slug).toBe("pavouk-turnaje-generator");
    expect(pageBySlug("vyrazovaci-system-generator")?.slug).toBe("pavouk-turnaje-generator");
    expect(pageBySlug("kazdy-s-kazdym-generator")?.slug).toBe("rozpis-kazdy-s-kazdym-tabulka");
    expect(pageBySlug("svycarsky-system")?.slug).toBe("svycarsky-system-turnaj-rozpis");
    expect(pageBySlug("turnajovy-generator")?.slug).toBe("generator-turnaju");
    expect(pageBySlug("printable/pavouk")?.slug).toBe("printable/pavouk-turnaje");
  });

  test("Hubs have HTML team grids for 4 to 32 teams", () => {
    const hubs = [
      pageBySlug("tournament-generator"),
      pageBySlug("single-elimination-bracket-generator"),
      pageBySlug("round-robin-generator"),
      pageBySlug("generator-turnaju"),
      pageBySlug("pavouk-turnaje-generator"),
      pageBySlug("rozpis-kazdy-s-kazdym-tabulka"),
    ];

    for (const hub of hubs) {
      expect(hub?.teamGrids).toBeDefined();
      expect(hub!.teamGrids!.length).toBeGreaterThan(0);
      for (const grid of hub!.teamGrids!) {
        expect(grid.items.length).toBe(29); // 4 to 32 inclusive
        expect(grid.items[0].teams).toBe(4);
        expect(grid.items[grid.items.length - 1].teams).toBe(32);
        // All items link to valid pages
        for (const item of grid.items) {
          expect(pageBySlug(item.slug)).toBeDefined();
        }
      }
    }
  });

  test("Parametric bracket pages for non-power-of-two (10, 12, 14 teams) explicitly address byes", () => {
    for (const count of [10, 12, 14]) {
      const page = pageBySlug(`${count}-team-single-elimination-bracket`);
      expect(page).toBeDefined();
      expect(page!.title).toContain("Bracket with Byes");
      expect(page!.description).toContain("byes");
      expect(page!.lede).toContain("byes");

      // Check section heading
      const byeSection = page!.sections?.find((s) => s.heading.includes("How byes work"));
      expect(byeSection).toBeDefined();
      expect(byeSection!.body.some((p) => p.includes("team bracket with byes"))).toBe(true);

      // Check FAQ
      expect(page!.faq?.some((f) => f.q.includes("byes"))).toBe(true);
    }
  });
});
