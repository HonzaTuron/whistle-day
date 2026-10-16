import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  isNotFound,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { SiteNav } from "../components/marketing/SiteNav";
import { AppChrome } from "../components/AppChrome";
import { AccountLegal } from "../components/AccountLegal";
import { localeOfPath } from "../content";
import { I18nProvider, useI18n } from "../lib/i18n";
import { isAppRoute } from "../lib/routes";
import "../styles.css";

/**
 * The document.
 *
 * Under Start this replaces `index.html`: the shell is rendered on the server
 * for every request, which is the entire reason for the migration — a page
 * whose content only exists after a bundle has executed is a page a crawler
 * has to be generous to read, and the marketing pages cannot rely on that.
 *
 * Everything `main.tsx` used to do on the way in happens here instead, with
 * one difference: nothing may be created at module scope. A `QueryClient`
 * shared between requests would serve one organiser's board to the next
 * visitor, so it is made per render and only reused across re-renders.
 */
const ICON_LINKS = [
  { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/pwa-192.png", type: "image/png", sizes: "192x192" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/manifest.webmanifest" },
] as const;

/* `resizes-content` so an on-screen keyboard shrinks the page instead of
   being laid over it. Android browsers otherwise keep the layout at full
   height, and anything pinned to the bottom — the wizard's "add team" button —
   ends up underneath the keyboard while it is being typed into. */
const VIEWPORT = {
  name: "viewport",
  content:
    "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
} as const;

export const Route = createRootRoute({
  // A not-found bubbles up to this route (the nearest ancestor with a
  // `notFoundComponent`) and lands on *this* match rather than the leaf
  // route's — which is also why the leaf's own `head()` never runs for it.
  // Branching here is the only place that can give a 404 its own title
  // instead of silently keeping the homepage's.
  head: ({ match }) =>
    isNotFound(match.error)
      ? {
          meta: [
            { charSet: "utf-8" },
            VIEWPORT,
            { name: "apple-mobile-web-app-capable", content: "yes" },
            { title: "Page not found — Whistle.day" },
            {
              name: "description",
              content: "There is no page at this address on Whistle.day.",
            },
            { name: "robots", content: "noindex" },
          ],
          links: [...ICON_LINKS],
        }
      : {
          meta: [
            { charSet: "utf-8" },
            VIEWPORT,
            { name: "apple-mobile-web-app-capable", content: "yes" },
            { title: "Whistle.day — run a tournament off a phone" },
            {
              name: "description",
              content:
                "Free tournament organiser. Draw groups, brackets or a Swiss, run the day from your phone, and put the results on a projector.",
            },
            { property: "og:site_name", content: "Whistle.day" },
            { property: "og:type", content: "website" },
            { property: "og:title", content: "Whistle.day — Run a tournament off a phone" },
            {
              property: "og:description",
              content:
                "Free tournament organiser. Draw groups, brackets or a Swiss, run the day from your phone, and put the results on a projector.",
            },
            { property: "og:image", content: "https://whistle.day/og.png" },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { property: "og:image:type", content: "image/png" },
            { name: "twitter:card", content: "summary_large_image" },
            { name: "twitter:title", content: "Whistle.day — Run a tournament off a phone" },
            {
              name: "twitter:description",
              content:
                "Free tournament organiser. Draw groups, brackets or a Swiss, run the day from your phone, and put the results on a projector.",
            },
            { name: "twitter:image", content: "https://whistle.day/og.png" },
          ],
          links: [...ICON_LINKS],
        },
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  // Per render rather than per module: see the note above.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <I18nProvider initial={localeOfPath(pathname) ?? "en"}>
      <QueryClientProvider client={queryClient}>
        <RootDocument>
          <Outlet />
        </RootDocument>
      </QueryClientProvider>
    </I18nProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const { locale } = useI18n();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // A Spanish marketing page is Spanish in the HTML, not only after the
  // bundle guesses. The homepage has no page language and follows the visitor.
  const lang = localeOfPath(pathname) ?? locale;
  return (
    <html lang={lang}>
      <head>
        {/*
          The browser's own chrome around the page — the address bar on
          Android, the status bar on an installed PWA. One flat value would put
          a near-black strip above a light page, so each palette names its own
          ground and the browser picks with the same query the stylesheet uses.

          Written here rather than in the route's `head`, because that one
          keys meta tags by `name` and keeps the last: two theme-colours went
          in and only the light one came out.
        */}
        <meta
          name="theme-color"
          content="#0b0f14"
          media="(prefers-color-scheme: dark)"
        />
        <meta
          name="theme-color"
          content="#f3f6f9"
          media="(prefers-color-scheme: light)"
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <AppChrome />
        <Analytics />
        <ServiceWorker />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Which marketing pages are worth building more of.
 *
 * The one question the content strategy actually needs answered — of a hundred
 * and twenty-three search intents, which ones bring anybody — and Search
 * Console answers most of it for nothing. This adds the half Search Console
 * cannot see: what a visitor did after landing, and where they came from.
 *
 * On the marketing pages only, and the gate is the same `isAppRoute` the
 * prerender filter uses. A projector is unattended for eight hours on a hall's
 * wifi, and a phone on `/m/:token` is the highest-traffic screen there is —
 * neither has a question this could answer, and both would be paying for it in
 * the bandwidth the result queue needs to drain. `/new` is left out too: the
 * wizard's drop-off is a real question, but it is not this tool's, and putting
 * a script on the one screen an organiser is mid-task on to find out is the
 * wrong trade.
 *
 * Cloudflare Web Analytics rather than something with autocapture: no
 * cookies, so no consent banner in front of a landing page whose whole job is
 * to convert, and a couple of kilobytes on pages that have an LCP budget.
 * Nothing here identifies anybody, which is what keeps §4 of the launch
 * checklist short. Free with no event or pageview cap, unlike Plausible's
 * cloud past its trial — worth stating since that is the whole reason this
 * replaced it rather than only rotating the script tag.
 *
 * The token is not a secret — it ends up in this same page's HTML either way
 * — but it is specific to the whistle.day site in Cloudflare's dashboard:
 * Analytics & Logs → Web Analytics → Add a site (whistle.day is already on
 * Cloudflare's nameservers for DNS, so it should already be selectable
 * there) → the snippet it shows has the token to paste below. Grey-clouded
 * (DNS-only) is fine; this beacon reports straight from the browser and does
 * not need the zone proxied.
 */
const CLOUDFLARE_BEACON_TOKEN = "b92d774814c04702a4dfc8a00614e672";

function Analytics() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (!import.meta.env.PROD) return null;
  if (isAppRoute(pathname)) return null;

  return (
    <script
      type="module"
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={`{"token": "${CLOUDFLARE_BEACON_TOKEN}"}`}
    />
  );
}

/**
 * Registering the worker by hand, because there is no `index.html` to inject
 * it into any more.
 *
 * `vite-plugin-pwa`'s `injectRegister: "inline"` writes a registration into
 * the built HTML shell, and Start does not produce one — the document is this
 * component. The virtual module is the other option and it pulls
 * `workbox-window` in to do update prompting this app has deliberately
 * decided against, so this is the same six lines, written out.
 */
function ServiceWorker() {
  if (!import.meta.env.PROD) return null;
  return (
    <script
      dangerouslySetInnerHTML={{
        __html:
          `if('serviceWorker' in navigator){` +
          `addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')});}`,
      }}
    />
  );
}

function NotFound() {
  return (
    <>
      <SiteNav />
      <div className="doc doc--slim">
        <h1 className="doc__title">Not found</h1>
        <p className="doc__lede">
          There is no page at this address. If you were opening a screen, check
          the token from the QR code.
        </p>
        <a href="/" className="btn btn--primary">
          Whistle.day
        </a>
        <AccountLegal />
      </div>
    </>
  );
}
