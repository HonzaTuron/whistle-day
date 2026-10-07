import { describe, expect, test } from "bun:test";
import { clubSlug, isClubSlug, splitByStatus } from "./club";

describe("clubSlug", () => {
  test("a name becomes lowercase words joined by dashes", () => {
    expect(clubSlug("TJ Sokol Brno")).toBe("tj-sokol-brno");
  });

  test("diacritics are dropped rather than turned into dashes", () => {
    expect(clubSlug("Brno-Židenice Žabovřesky")).toBe("brno-zidenice-zabovresky");
    expect(clubSlug("Club de Pádel Coruña")).toBe("club-de-padel-coruna");
  });

  test("punctuation at either end leaves no dash behind", () => {
    expect(clubSlug("  (BC Smeč!)  ")).toBe("bc-smec");
  });

  test("a long name is cut without ending on a dash", () => {
    const slug = clubSlug("a".repeat(39) + " b c d");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });

  test("whatever it makes from an ordinary name, the server accepts", () => {
    for (const name of ["TJ Sokol Brno", "Brno-Židenice", "Club de Pádel", "1. BC 2000"]) {
      expect(isClubSlug(clubSlug(name))).toBe(true);
    }
  });
});

describe("isClubSlug", () => {
  test("refuses what the collection would", () => {
    for (const slug of ["", "ab", "Sokol", "tj--sokol", "-sokol", "sokol-", "tj sokol", "a".repeat(41)]) {
      expect(isClubSlug(slug)).toBe(false);
    }
  });
});

describe("splitByStatus", () => {
  test("finished and archived are past, everything else is on", () => {
    const { current, past } = splitByStatus([
      { id: "a", status: "live" },
      { id: "b", status: "finished" },
      { id: "c", status: "published" },
      { id: "d", status: "archived" },
    ]);
    expect(current.map((t) => t.id)).toEqual(["a", "c"]);
    expect(past.map((t) => t.id)).toEqual(["b", "d"]);
  });
});
