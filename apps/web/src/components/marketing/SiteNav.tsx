import { Link } from "@tanstack/react-router";
import { pageBySlug } from "../../content";
import { useT } from "../../lib/i18n";
import type { MessageKey } from "../../lib/i18n";

/**
 * The bar across the top of every page somebody can arrive on cold.
 *
 * The homepage and the 123 marketing pages had no way between them: a search
 * dropped somebody on "12 team round robin", and the only links out of it were
 * the call to action and whatever that page happened to list under "see also".
 * A bar of five destinations turns a hundred dead ends into a site.
 *
 * It is deliberately absent from the app screens. `/t/:id`, `/display/:token`
 * and `/m/:token` are screens somebody is working from with a match in front
 * of them, and a marketing nav on the projector is an advert in a hall.
 *
 * No disclosure button, no state, no JavaScript: on a phone the links become a
 * row that scrolls sideways — the same thing `.phone__tabs` does — because the
 * marketing pages are prerendered so they can be read before a bundle runs,
 * and a menu that needs the bundle to open would undo that.
 */

/** Where the bar points. Slugs, so a rename is caught by the filter below. */
const DESTINATIONS: { slug: string; key: MessageKey }[] = [
  { slug: "tournament-generator", key: "nav.formats" },
  { slug: "guide/how-to-run-a-one-day-tournament", key: "nav.guides" },
  { slug: "tournament-projector-display", key: "nav.screens" },
  { slug: "printable/round-robin-schedule", key: "nav.print" },
  { slug: "alternatives/free-tournament-bracket-software", key: "nav.compare" },
  { slug: "mcp", key: "nav.mcp" },
];

// Same reasoning as `related` in the content module: a nav link to a page that
// no longer exists is a 404 on every page of the site, so a slug that stops
// resolving drops out of the bar rather than shipping.
const LINKS = DESTINATIONS.filter((link) => pageBySlug(link.slug));

export function SiteNav() {
  const t = useT();

  return (
    <header className="sitenav">
      <div className="sitenav__inner">
        <Link to="/" className="sitenav__brand">
          Whistle.day
        </Link>

        <nav className="sitenav__links" aria-label={t("nav.label")}>
          {LINKS.map((link) => (
            <Link
              key={link.slug}
              to="/$"
              params={{ _splat: link.slug }}
              className="sitenav__link"
              activeProps={{ className: "sitenav__link is-on" }}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <Link to="/new" className="sitenav__cta">
          {t("nav.setUp")}
        </Link>
      </div>
    </header>
  );
}
