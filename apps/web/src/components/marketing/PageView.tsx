import { Link } from "@tanstack/react-router";
import { pageBySlug } from "../../content";
import type { Page } from "../../content/types";
import { PrintableSheet } from "./PrintableSheet";
import { SiteNav } from "./SiteNav";
import { FORMAT_OF } from "../../content/formats-map";
import { renderInlineMarkdown } from "./InlineMarkdown";

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
export function PageView({ page }: { page: Page }) {
  return (
    <>
      <SiteNav />

      <article className="doc">
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
            {section.code?.map((block) => (
              <div className="doc__code" key={block.code}>
                {block.label && <div className="doc__code-label">{block.label}</div>}
                <pre>
                  <code>{block.code}</code>
                </pre>
              </div>
            ))}
          </section>
        ))}

        {page.faq && page.faq.length > 0 && (
          <section className="doc__section">
            <h2 className="doc__heading">Common questions</h2>
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
          <Link to="/" className="doc__foot-link">
            Whistle.day
          </Link>
          <span className="doc__foot-note">
            Free tournament organiser. No account, no ads, no cap.
          </span>
          <div className="doc__foot-legal">
            <a href="mailto:info@whistle.day" className="doc__foot-sublink">
              info@whistle.day
            </a>
            <Link to="/$" params={{ _splat: "privacy" }} className="doc__foot-sublink">
              Privacy
            </Link>
            <Link to="/$" params={{ _splat: "terms" }} className="doc__foot-sublink">
              Terms
            </Link>
            <Link to="/$" params={{ _splat: "user-deletion" }} className="doc__foot-sublink">
              Data deletion
            </Link>
          </div>
        </footer>
      </article>
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
  const { preset } = page.generator!;
  return (
    <div className="doc__cta">
      <Link
        to="/new"
        search={{ preset }}
        className="btn btn--primary btn--block"
      >
        Set this up now
      </Link>
      <p className="doc__cta-note">
        Free, and there is no account to make first. About a minute to the QR
        code.
      </p>
    </div>
  );
}

function Related({ page }: { page: Page }) {
  const related = (page.related ?? [])
    .map(pageBySlug)
    .filter((p): p is Page => p !== undefined);

  if (related.length === 0) return null;

  return (
    <nav className="doc__related" aria-label="Related pages">
      <h2 className="doc__heading">See also</h2>
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
