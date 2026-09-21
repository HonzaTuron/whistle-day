import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { pageBySlug } from "../../content";
import type { CodeBlock, Page } from "../../content/types";
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
 * A Spanish article prerenders before any bundle runs, so these strings cannot
 * wait for `t()` — the server has no browser to ask, and an English button
 * under a Spanish lede is the page failing the search that found it.
 */
const CHROME = {
  en: {
    cta: "Set this up now",
    ctaNote: "Free, and there is no account to make first. About a minute to the QR code.",
    faq: "Common questions",
    related: "See also",
    footer: "Free tournament organiser. No account, no ads, no cap.",
    privacy: "Privacy",
    terms: "Terms",
    deletion: "Data deletion",
  },
  es: {
    cta: "Crear este torneo",
    ctaNote: "Gratis, y no hay que crear una cuenta antes. Un minuto hasta el código QR.",
    faq: "Preguntas frecuentes",
    related: "Ver también",
    footer: "Organizador de torneos gratis. Sin cuenta, sin anuncios, sin tope.",
    privacy: "Privacidad",
    terms: "Términos",
    deletion: "Borrar datos",
  },
} as const;

function chromeOf(page: Page) {
  return page.locale === "es" ? CHROME.es : CHROME.en;
}

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
              request={{
                format: FORMAT_OF[page.generator.preset],
                teams: page.generator.teams,
                config: { thirdPlace: true },
              }}
              teams={page.generator.teams}
            />
          ) : null}

          {page.generator && <Cta page={page} />}

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
    .map(pageBySlug)
    .filter((p): p is Page => p !== undefined);

  if (related.length === 0) return null;

  const heading = chromeOf(page).related;
  return (
    <nav className="doc__related" aria-label={heading}>
      <h2 className="doc__heading">{heading}</h2>
      <ul className="doc__related-list">
        {related.map((item) => (
          <li key={item.slug}>
            <Link to="/$" params={{ _splat: item.slug }} className="doc__related-link">
              {item.h1}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
