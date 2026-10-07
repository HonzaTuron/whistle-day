/**
 * Which addresses are one organiser's live data, and which are pages.
 *
 * Everything under `/t`, `/display`, `/m`, `/join`, `/account`, `/new`,
 * `/claim`, `/verify` and `/reset` is a tournament somebody is running, or an
 * account being recovered — behind a token, different on every request, and
 * nothing a crawler or an analytics script has any business with. `/c` is a
 * club's page, which has no token but is read from the database on every
 * request and lists those same tournaments. Everything else is static per
 * URL: the content of a 12-team round robin page does not depend on who is
 * asking.
 *
 * This lives in one place because two things read it and they must not
 * disagree. The prerender filter uses it to decide what gets built to HTML,
 * and the document uses it to decide where the analytics script is allowed to
 * go. A route that drifted between those two would be either a live board in
 * a search index or a projector phoning a third party all afternoon.
 */
export const APP_ROUTES = /^\/(t|display|m|c|join|account|new|claim|verify|reset)(\/|$)/;

/**
 * The crawler hands paths in with their query string attached, and every
 * marketing page's call to action points at `/new?preset=…&teams=…`. Matching
 * the pattern against the raw string would let all of those through, so the
 * query is cut off before the test.
 */
export const isAppRoute = (path: string): boolean =>
  APP_ROUTES.test(path.split("?")[0]!);
