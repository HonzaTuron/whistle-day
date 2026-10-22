import { Link } from "@tanstack/react-router";
import { pageBySlug } from "../../content";
import { useI18n } from "../../lib/i18n";
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
const DESTINATIONS: Record<string, { slug: string; key: MessageKey }[]> = {
  cs: [
    { slug: "generator-turnaju", key: "nav.formats" },
    { slug: "guide/how-to-run-a-one-day-tournament", key: "nav.guides" },
    { slug: "tournament-projector-display", key: "nav.screens" },
    { slug: "printable/rozpis-kazdy-s-kazdym", key: "nav.print" },
    { slug: "alternatives/free-tournament-bracket-software", key: "nav.compare" },
    { slug: "mcp", key: "nav.mcp" },
  ],
  default: [
    { slug: "tournament-generator", key: "nav.formats" },
    { slug: "guide/how-to-run-a-one-day-tournament", key: "nav.guides" },
    { slug: "tournament-projector-display", key: "nav.screens" },
    { slug: "printable/round-robin-schedule", key: "nav.print" },
    { slug: "alternatives/free-tournament-bracket-software", key: "nav.compare" },
    { slug: "mcp", key: "nav.mcp" },
  ],
};

export function SiteNav() {
  const { locale, t } = useI18n();
  const destinations = (locale === "cs" ? DESTINATIONS.cs : DESTINATIONS.default).filter(
    (link) => pageBySlug(link.slug),
  );

  return (
    <header className="sitenav">
      <div className="sitenav__inner">
        <Link to="/" className="sitenav__brand">
          Whistle.day
        </Link>

        <nav className="sitenav__links" aria-label={t("nav.label")}>
          {destinations.map((link) => (
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

        <Link
          to="/new"
          search={locale === "en" ? {} : { lang: locale }}
          className="sitenav__cta"
        >
          {t("nav.setUp")}
        </Link>
      </div>
    </header>
  );
}
