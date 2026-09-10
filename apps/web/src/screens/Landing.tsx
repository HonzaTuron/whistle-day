import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { rememberedTournament } from "../api/organiser";
import { SiteNav } from "../components/marketing/SiteNav";
import { pageBySlug } from "../content";
import { useT, type MessageKey } from "../lib/i18n";

/**
 * The page somebody lands on before they trust this with a Saturday.
 *
 * It is written for the person who runs the tournament, but it is read by
 * somebody who watches them: the two are the same person on different days,
 * and what convinces them is not a feature list. It is seeing a score. So the
 * hero carries a scoreboard rather than a screenshot of a settings screen, the
 * numbers under it are the four a hall actually asks — how long, how much,
 * what can it run, how fast does the wall catch up — and the formats and the
 * sports are links rather than prose, because whoever is reading has one of
 * each in mind already and wants the page about theirs.
 */

/** The four formats, each pointing at the page that explains it. */
const FORMATS: { slug: string; title: MessageKey; body: MessageKey }[] = [
  {
    slug: "round-robin-generator",
    title: "landing.formatRoundRobin",
    body: "landing.formatRoundRobinBody",
  },
  {
    slug: "single-elimination-bracket-generator",
    title: "landing.formatSingleElim",
    body: "landing.formatSingleElimBody",
  },
  {
    slug: "double-elimination-bracket-generator",
    title: "landing.formatDoubleElim",
    body: "landing.formatDoubleElimBody",
  },
  {
    slug: "swiss-tournament-generator",
    title: "landing.formatSwiss",
    body: "landing.formatSwissBody",
  },
];

/**
 * The sports somebody searches for by name.
 *
 * The generators do not care what the ball is, but nobody searches for "round
 * robin generator" when what they are running is a padel afternoon. Each chip
 * is that person's own page.
 */
const SPORTS: { slug: string; key: MessageKey }[] = [
  { slug: "volleyball-tournament-bracket", key: "landing.sportVolleyball" },
  { slug: "beach-volleyball-tournament-generator", key: "landing.sportBeach" },
  { slug: "padel-tournament-generator", key: "landing.sportPadel" },
  { slug: "pickleball-round-robin-generator", key: "landing.sportPickleball" },
  { slug: "badminton-tournament-draw", key: "landing.sportBadminton" },
  { slug: "table-tennis-tournament-generator", key: "landing.sportTableTennis" },
  { slug: "futsal-tournament-generator", key: "landing.sportFutsal" },
  { slug: "chess-swiss-tournament-generator", key: "landing.sportChess" },
  { slug: "esports-tournament-bracket", key: "landing.sportEsports" },
];

/** The four numbers, in the order a hall asks them. */
const STATS: { value: MessageKey; label: MessageKey }[] = [
  { value: "landing.statSetupValue", label: "landing.statSetupLabel" },
  { value: "landing.statFreeValue", label: "landing.statFreeLabel" },
  { value: "landing.statFormatsValue", label: "landing.statFormatsLabel" },
  { value: "landing.statLiveValue", label: "landing.statLiveLabel" },
];

// A link to a page that no longer exists is worse than no link; the content
// module is the truth about which slugs resolve, as it is for "see also".
const LINKED_FORMATS = FORMATS.filter((item) => pageBySlug(item.slug));
const LINKED_SPORTS = SPORTS.filter((item) => pageBySlug(item.slug));

export function Landing() {
  const t = useT();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [running] = useState(rememberedTournament);

  const open = (to: "/display/$token" | "/m/$token") => {
    const trimmed = token.trim();
    if (trimmed) navigate({ to, params: { token: trimmed } });
  };

  return (
    <div className="home">
      <SiteNav />

      <header className="home__hero">
        <div className="home__hero-bg" />
        <div className="home__hero-content">
          <p className="home__eyebrow">
            <span className="home__eyebrow-dot" aria-hidden="true" />
            {t("landing.eyebrow")}
          </p>
          <h1 className="home__logo">Whistle.day</h1>
          <p className="home__tagline">{t("landing.tagline")}</p>

          <div className="home__ctas">
            {running ? (
              <Link
                to="/t/$id"
                params={{ id: running.id }}
                className="btn btn--primary btn--block"
              >
                {t("landing.resume", { name: running.name })}
              </Link>
            ) : (
              <Link to="/new" className="btn btn--primary btn--block">
                {t("landing.setUp")}
              </Link>
            )}
            <Link to="/account" className="btn btn--quiet btn--block">
              {t("landing.signIn")}
            </Link>
          </div>

          <Scoreboard />
        </div>
      </header>

      <ul className="home__stats">
        {STATS.map((stat) => (
          <li className="home__stat" key={stat.label}>
            <span className="home__stat-value">{t(stat.value)}</span>
            <span className="home__stat-label">{t(stat.label)}</span>
          </li>
        ))}
      </ul>

      <section className="home__section">
        <h2 className="home__section-title">{t("landing.howTitle")}</h2>
        <div className="home__steps">
          <div className="home__step">
            <span className="home__step-icon">1</span>
            <h3>{t("landing.step1Title")}</h3>
            <p>{t("landing.step1Body")}</p>
          </div>
          <div className="home__step">
            <span className="home__step-icon">2</span>
            <h3>{t("landing.step2Title")}</h3>
            <p>{t("landing.step2Body")}</p>
          </div>
          <div className="home__step">
            <span className="home__step-icon">3</span>
            <h3>{t("landing.step3Title")}</h3>
            <p>{t("landing.step3Body")}</p>
          </div>
        </div>
      </section>

      <section className="home__section">
        <h2 className="home__section-title">{t("landing.formatsTitle")}</h2>
        <div className="home__formats">
          {LINKED_FORMATS.map((format) => (
            <Link
              key={format.slug}
              to="/$"
              params={{ _splat: format.slug }}
              className="home__format"
            >
              <h3>{t(format.title)}</h3>
              <p>{t(format.body)}</p>
              <span className="home__format-more" aria-hidden="true">
                {t("landing.formatMore")}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home__section home__section--sports">
        <h2 className="home__section-title">{t("landing.sportsTitle")}</h2>
        <p className="home__section-note">{t("landing.sportsNote")}</p>
        <ul className="home__sports">
          {LINKED_SPORTS.map((sport) => (
            <li key={sport.slug}>
              <Link
                to="/$"
                params={{ _splat: sport.slug }}
                className="home__sport"
              >
                {t(sport.key)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="home__section home__section--screen">
        <h2 className="home__section-title">{t("landing.screenTitle")}</h2>
        <p className="home__section-note">{t("landing.screenNote")}</p>
        <input
          className="home__token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder={t("landing.tokenPlaceholder")}
          onKeyDown={(event) => event.key === "Enter" && open("/display/$token")}
        />
        <div className="home__token-actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!token.trim()}
            onClick={() => open("/display/$token")}
          >
            {t("landing.projector")}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!token.trim()}
            onClick={() => open("/m/$token")}
          >
            {t("landing.phone")}
          </button>
        </div>
      </section>

      <footer className="home__footer">
        <p>{t("landing.footer")}</p>
        <nav className="home__footer-links" aria-label="Legal">
          <Link to="/$" params={{ _splat: "privacy" }}>
            {t("nav.privacy")}
          </Link>
          <Link to="/$" params={{ _splat: "terms" }}>
            {t("nav.terms")}
          </Link>
          <Link to="/$" params={{ _splat: "user-deletion" }}>
            {t("nav.deletion")}
          </Link>
        </nav>
        <a
          className="home__badge"
          href="https://smithery.ai/server/turon-honza/whistle-day"
          target="_blank"
          rel="noopener"
        >
          <img
            src="https://smithery.ai/badge/turon-honza/whistle-day"
            alt={t("landing.smithery")}
            height={20}
            loading="lazy"
          />
        </a>
      </footer>
    </div>
  );
}

/**
 * A match, mid-third-set, the way the wall shows it.
 *
 * Every other way of illustrating this product is a picture of admin — a team
 * list, a format picker, a wizard step. None of them is why anybody is in the
 * hall. This is: two names, the sets so far, and a number that is about to
 * change. It is the one thing on the page that needs no explaining.
 *
 * Marked up as a figure with a caption rather than hidden from assistive
 * technology, because it is not decoration: it is the answer to "what do I
 * actually get". The caption says in a sentence what the panel says in
 * numbers, so nothing is only available to somebody who can see it.
 */
function Scoreboard() {
  const t = useT();

  return (
    <figure className="board">
      <div className="board__head">
        <span className="board__court">{t("landing.demoCourt")}</span>
        <span className="board__live">
          <span className="board__live-dot" aria-hidden="true" />
          {t("landing.demoLive")}
        </span>
      </div>

      <div className="board__row is-ahead">
        <span className="board__team">{t("landing.demoHome")}</span>
        <span className="board__sets">
          <span className="board__set">25</span>
          <span className="board__set">19</span>
          <span className="board__set board__set--now">11</span>
        </span>
        <span className="board__score">1</span>
      </div>

      <div className="board__row">
        <span className="board__team">{t("landing.demoAway")}</span>
        <span className="board__sets">
          <span className="board__set">22</span>
          <span className="board__set">25</span>
          <span className="board__set board__set--now">8</span>
        </span>
        <span className="board__score">1</span>
      </div>

      <figcaption className="sr-only">{t("landing.demoCaption")}</figcaption>
    </figure>
  );
}
