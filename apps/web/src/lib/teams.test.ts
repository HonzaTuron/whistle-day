import { describe, expect, it } from "bun:test";
import { parsePastedTeams, suggestShortName, isDuplicateName } from "./teams";

describe("parsePastedTeams", () => {
  it("splits newlines and trims whitespace", () => {
    const raw = "Arsenal\n  Chelsea  \n\nLiverpool\nManchester City\n";
    expect(parsePastedTeams(raw)).toEqual([
      "Arsenal",
      "Chelsea",
      "Liverpool",
      "Manchester City",
    ]);
  });

  it("handles CRLF newlines", () => {
    const raw = "Arsenal\r\nChelsea\r\nLiverpool";
    expect(parsePastedTeams(raw)).toEqual(["Arsenal", "Chelsea", "Liverpool"]);
  });

  it("splits tab-separated values from spreadsheets", () => {
    const raw = "Arsenal\tChelsea\tLiverpool";
    expect(parsePastedTeams(raw)).toEqual(["Arsenal", "Chelsea", "Liverpool"]);
  });

  it("splits comma-separated values and strips quotes", () => {
    const raw = '"Arsenal", "Chelsea", Liverpool, \'Man City\'';
    expect(parsePastedTeams(raw)).toEqual([
      "Arsenal",
      "Chelsea",
      "Liverpool",
      "Man City",
    ]);
  });

  it("splits semicolon-separated values", () => {
    const raw = "Arsenal; Chelsea; Liverpool";
    expect(parsePastedTeams(raw)).toEqual(["Arsenal", "Chelsea", "Liverpool"]);
  });

  it("handles single string", () => {
    expect(parsePastedTeams("Arsenal")).toEqual(["Arsenal"]);
  });

  it("handles empty or whitespace only", () => {
    expect(parsePastedTeams("   \n\n  ")).toEqual([]);
  });
});

describe("suggestShortName", () => {
  it("leaves short names alone", () => {
    expect(suggestShortName("Arsenal")).toBe("Arsenal");
  });

  it("truncates at word boundary", () => {
    expect(suggestShortName("Bears Athletic Club Prague")).toBe("Bears Athletic");
  });
});

describe("isDuplicateName", () => {
  it("matches case-insensitively", () => {
    expect(isDuplicateName("chelsea", [{ name: "Chelsea" }])).toBe(true);
    expect(isDuplicateName("Arsenal", [{ name: "Chelsea" }])).toBe(false);
  });
});
