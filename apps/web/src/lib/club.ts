/**
 * The two things about a club page that are worth working out away from a
 * component: what its address would be, and which of its tournaments are
 * behind it.
 */

/** What `clubs.slug` accepts: lowercase words joined by single dashes. */
export const CLUB_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const CLUB_SLUG_MIN = 3;
export const CLUB_SLUG_MAX = 40;

/**
 * An address from a name: "TJ Sokol Brno-Židenice" -> "tj-sokol-brno-zidenice".
 *
 * No random tail, unlike a tournament's slug. That one only has to be unique;
 * this one is printed on a poster and typed off it, so a clash is settled by
 * the club picking a different address rather than by five letters nobody
 * chose.
 */
export function clubSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, CLUB_SLUG_MAX)
    .replace(/^-|-$/g, "");
}

export const isClubSlug = (slug: string): boolean =>
  slug.length >= CLUB_SLUG_MIN && slug.length <= CLUB_SLUG_MAX && CLUB_SLUG.test(slug);

/**
 * A page's tournaments, split into what is on and what is over.
 *
 * By status rather than by date: the wizard never asks when a tournament is
 * played, so most of them only know when they were made, and a cup created in
 * March and still running is not a past tournament.
 */
export function splitByStatus<T extends { status: string }>(
  tournaments: T[],
): { current: T[]; past: T[] } {
  const current: T[] = [];
  const past: T[] = [];
  for (const tournament of tournaments) {
    if (tournament.status === "finished" || tournament.status === "archived") {
      past.push(tournament);
    } else {
      current.push(tournament);
    }
  }
  return { current, past };
}
