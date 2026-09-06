import { describe, expect, test } from "bun:test";
import { isAppRoute } from "./routes";
import { MARKETING_PATHS } from "../content";

/**
 * Two things read this and neither can be watched at runtime: the prerender
 * filter decides what is built to HTML, and the document decides where the
 * analytics script is allowed to go. Getting it wrong in one direction puts a
 * live board in a search index; in the other it leaves a projector calling a
 * third party every time it re-reads, on a hall's wifi, all afternoon.
 *
 * So the invariant is pinned here rather than trusted: every screen is an app
 * route, and every page that ships is not.
 */

describe("isAppRoute", () => {
  test("every screen is one", () => {
    for (const path of [
      "/t/abc123",
      "/display/hala-1",
      "/m/hala-1",
      "/join/wxyz",
      "/account",
      "/new",
    ]) {
      expect(isAppRoute(path)).toBe(true);
    }
  });

  test("a screen with a query string is still one", () => {
    // Every marketing page's call to action points here, and the crawler hands
    // the path in with the query attached.
    expect(isAppRoute("/new?preset=groups&teams=12")).toBe(true);
    expect(isAppRoute("/display/hala-1?lang=cs")).toBe(true);
  });

  test("no page that ships is one", () => {
    for (const path of MARKETING_PATHS) {
      expect(isAppRoute(path)).toBe(false);
    }
  });

  test("the home page is not one", () => {
    expect(isAppRoute("/")).toBe(false);
  });

  test("a page whose name merely starts like a screen is not one", () => {
    // The boundary is a path segment, not a prefix: `/new` is the wizard and
    // `/newcomers-guide` would be a page, however unlikely.
    expect(isAppRoute("/team-tournament-generator")).toBe(false);
    expect(isAppRoute("/multi-stage-tournament-builder")).toBe(false);
  });
});
