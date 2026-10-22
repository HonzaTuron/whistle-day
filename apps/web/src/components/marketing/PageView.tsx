import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { relatedLink, relatedTitle, type RelatedLink } from "../../content";
import type { CodeBlock, Page, TeamGrid } from "../../content/types";
import { PrintableSheet } from "./PrintableSheet";
import { SiteNav } from "./SiteNav";
import { FORMAT_OF } from "../../content/formats-map";
import { renderInlineMarkdown } from "./InlineMarkdown";
import { isLocale, useT, type Locale } from "../../lib/i18n";
import { SPORTS, type SportId } from "../../lib/scoring";

/**
 * The layout every marketing page uses.
 *
 * One component rather than one per kind, because the differences between a
 * format page and a guide turned out to be which optional blocks are present
 * rather than how anything is arranged. A page with no `facts` simply has no
 * facts panel.
 *
 * The order is the argument: the numbers first, because on a parametric page
 * they are the answer to the query and making somebody scroll past a call to
 * action to reach them is how a useful page becomes an advert. The call to
 * action comes after the prose, where somebody who is convinced will look for
 * it.
 */
/**
 * Chrome that is part of the page, not of the visitor's browser.
 *
 * A Spanish or Czech article prerenders before any bundle runs, so these strings cannot
 * wait for `t()` — the server has no browser to ask, and an English button
 * under a Czech lede is the page failing the search that found it.
 */
const CHROME = {
  en: {
    cta: "Set this up now",
    ctaNote: "Free, and there is no account to make first. About a minute to the QR code.",
    faq: "Common questions",
    updated: "Updated",
    related: "See also",
    footer: "Free tournament organiser. No account, no ads, no cap.",
    privacy: "Privacy",
    terms: "Terms",
    deletion: "Data deletion",
  },
  cs: {
    cta: "Vytvořit turnaj zdarma",
    ctaNote: "Zdarma a bez registrace. Za minutu máte rozpis i QR kód pro hráče.",
    faq: "Časté dotazy",
    updated: "Aktualizováno",
    related: "Související rozpisy a návody",
    footer: "Turnajový organizátor zdarma. Bez registrace, bez reklam, bez limitů.",
    privacy: "Soukromí",
    terms: "Podmínky",
    deletion: "Smazání údajů",
  },
  es: {
    cta: "Crear este torneo",
    ctaNote: "Gratis, y no hay que crear una cuenta antes. Un minuto hasta el código QR.",
    faq: "Preguntas frecuentes",
    updated: "Actualizado el",
    related: "Ver también",
    footer: "Organizador de torneos gratis. Sin cuenta, sin anuncios, sin tope.",
    privacy: "Privacidad",
    terms: "Términos",
    deletion: "Borrar datos",
  },
} as const;

function chromeOf(page: Page) {
  if (page.locale === "cs") return CHROME.cs;
  if (page.locale === "es") return CHROME.es;
  return CHROME.en;
}

/**
 * "2026-09-17" → "17 September 2026", in the page's language.
 *
 * Pinned to UTC so the prerendered date and the hydrated one are the same day
 * whichever side of midnight the visitor's clock is on.
 */
const longDate = (day: string, locale: Locale | undefined) =>
  new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : locale === "es" ? "es" : "en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));

const isSportId = (value: string | undefined): value is SportId =>
  SPORTS.some((sport) => sport.id === value);

export function PageView({ page }: { page: Page }) {
  const chrome = chromeOf(page);
  return (
    <>
      <SiteNav />

      <main>
        <article className="doc" lang={page.locale}>
          <header className="doc__head">
            <h1 className="doc__title">{page.h1}</h1>
            <p className="doc__lede">{renderInlineMarkdown(page.lede)}</p>
            {page.updated && (
              <p className="doc__updated">
                {chrome.updated}{" "}
                <time dateTime={page.updated}>{longDate(page.updated, page.locale)}</time>
              </p>
            )}
          </header>

          {page.facts && page.facts.length > 0 && (
            <dl className="doc__facts">
              {page.facts.map((fact) => (
                <div className="doc__fact" key={fact.label}>
                  <dt className="doc__fact-label">{fact.label}</dt>
                  <dd className="doc__fact-value">{fact.value}</dd>
                  {fact.note && (
                    <dd className="doc__fact-note">{renderInlineMarkdown(fact.note)}</dd>
                  )}
                </div>
              ))}
            </dl>
          )}

          {page.kind === "printable" && page.generator?.teams ? (
            <PrintableSheet
              key={page.slug}
              request={{
                format: FORMAT_OF[page.generator.preset],
                teams: page.generator.teams,
                config: { thirdPlace: true },
              }}
              teams={page.generator.teams}
              locale={page.locale}
            />
          ) : null}

          {page.generator && <Cta page={page} />}

          {page.teamGrids?.map((grid) => (
            <TeamGridView grid={grid} key={grid.heading} />
          ))}

          {page.sections?.map((section) => (
            <section className="doc__section" key={section.heading}>
              <h2 className="doc__heading">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p className="doc__para" key={paragraph.slice(0, 48)}>
                  {renderInlineMarkdown(paragraph)}
                </p>
              ))}
              {section.code?.map((block) => <CodeBlockView block={block} key={block.code} />)}
            </section>
          ))}

          {page.faq && page.faq.length > 0 && (
            <section className="doc__section">
              <h2 className="doc__heading">{chrome.faq}</h2>
              {page.faq.map((item) => (
                <div className="doc__faq" key={item.q}>
                  <h3 className="doc__faq-q">{item.q}</h3>
                  <p className="doc__para">{renderInlineMarkdown(item.a)}</p>
                </div>
              ))}
            </section>
          )}

          <Related page={page} />

          <footer className="doc__foot">
            <Link
              to="/"
              search={page.locale ? { lang: page.locale } : {}}
              className="doc__foot-link"
            >
              Whistle.day
            </Link>
            <span className="doc__foot-note">{chrome.footer}</span>
            <div className="doc__foot-legal">
              <a href="mailto:info@whistle.day" className="doc__foot-sublink">
                info@whistle.day
              </a>
              <a
                href="https://github.com/HonzaTuron/whistle-day"
                rel="noopener"
                className="doc__foot-sublink"
              >
                GitHub
              </a>
              <Link to="/$" params={{ _splat: "privacy" }} className="doc__foot-sublink">
                {chrome.privacy}
              </Link>
              <Link to="/$" params={{ _splat: "terms" }} className="doc__foot-sublink">
                {chrome.terms}
              </Link>
              <Link to="/$" params={{ _splat: "user-deletion" }} className="doc__foot-sublink">
                {chrome.deletion}
              </Link>
            </div>
          </footer>
        </article>
      </main>
    </>
  );
}

/**
 * The call to action, carrying the page's own defaults into the wizard.
 *
 * A page about a twelve-team group stage that drops somebody onto an empty
 * "name your tournament" screen has wasted the one thing it knew about them.
 * `/new` reads these off the search params.
 */
function Cta({ page }: { page: Page }) {
  const chrome = chromeOf(page);
  const { preset, sport, lang } = page.generator!;
  const asked: Locale | undefined = isLocale(lang) ? lang : page.locale;
  return (
    <div className="doc__cta">
      <Link
        to="/new"
        search={{
          preset,
          sport: isSportId(sport) ? sport : undefined,
          lang: asked,
        }}
        className="btn btn--primary btn--block"
      >
        {page.cta ?? chrome.cta}
      </Link>
      <p className="doc__cta-note">{page.ctaNote ?? chrome.ctaNote}</p>
    </div>
  );
}

/**
 * A command or config snippet, with a button to take it rather than select it
 * by hand — the same clipboard pattern the wizard's own handoff links use.
 */
function CodeBlockView({ block }: { block: CodeBlock }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused on some browsers; the text is still
      // there to select by hand.
    }
  };

  return (
    <div className="doc__code">
      {block.label && <div className="doc__code-label">{block.label}</div>}
      <pre>
        <button
          type="button"
          className="doc__code-copy"
          onClick={() => void copy()}
        >
          {t(copied ? "common.copied" : "common.copy")}
        </button>
        <code>{block.code}</code>
      </pre>
    </div>
  );
}

function Related({ page }: { page: Page }) {
  const related = (page.related ?? [])
    .map(relatedLink)
    .filter((link): link is RelatedLink => link !== undefined);

  if (related.length === 0) return null;

  const heading = chromeOf(page).related;
  return (
    <nav className="doc__related" aria-label={heading}>
      <h2 className="doc__heading">{heading}</h2>
      <ul className="doc__related-list">
        {related.map((link) => (
          <li key={link.page.slug}>
            <Link
              to="/$"
              params={{ _splat: link.page.slug }}
              search={link.teams ? { teams: link.teams } : {}}
              className="doc__related-link"
            >
              {relatedTitle(link)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TeamGridView({ grid }: { grid: TeamGrid }) {
  return (
    <section className="doc__team-grid">
      <h2 className="doc__heading">{grid.heading}</h2>
      {grid.description && (
        <p className="doc__para">{renderInlineMarkdown(grid.description)}</p>
      )}
      <div className="doc__team-grid-cards">
        {grid.items.map((item) => (
          <Link
            key={item.slug}
            to="/$"
            params={{ _splat: item.slug }}
            className={`doc__team-grid-card ${item.isPowerOfTwo ? "is-power-of-two" : ""}`}
          >
            <span className="doc__team-grid-teams">{item.label ?? `${item.teams} teams`}</span>
            {item.badge && (
              <span
                className={`doc__team-grid-badge ${item.isPowerOfTwo ? "doc__team-grid-badge--accent" : ""}`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
