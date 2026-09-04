import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { I18nProvider, detectLocale, useI18n } from "../lib/i18n";
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
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "#0b0f14" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { title: "Whistle.day — run a tournament off a phone" },
      {
        name: "description",
        content:
          "Free tournament organiser. Draw groups, brackets or a Swiss, run the day from your phone, and put the results on a projector.",
      },
    ],
    links: [{ rel: "manifest", href: "/manifest.webmanifest" }],
  }),
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

  return (
    <I18nProvider initial="en">
      <QueryClientProvider client={queryClient}>
        <RootDocument>
          <Outlet />
        </RootDocument>
      </QueryClientProvider>
    </I18nProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <LocaleCorrection />
        {children}
        <ServiceWorker />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * The server renders English because a request cannot be asked what a phone
 * has in its localStorage, so the real answer is applied once on arrival.
 *
 * Deliberately an effect rather than a `useState` initialiser: detecting
 * during the first client render would produce a tree that disagrees with the
 * HTML it is hydrating into, which React resolves by throwing the server's
 * markup away. Correcting on the second render costs a frame and keeps the
 * hydration clean.
 */
function LocaleCorrection() {
  const { locale, setLocale } = useI18n();

  useEffect(() => {
    const detected = detectLocale();
    if (detected !== locale) setLocale(detected);
  }, [locale, setLocale]);

  return null;
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
    <div className="doc doc--slim">
      <h1 className="doc__title">Not found</h1>
      <p className="doc__lede">
        There is no page at this address. If you were opening a screen, check
        the token from the QR code.
      </p>
      <a href="/" className="btn btn--primary">
        Whistle.day
      </a>
    </div>
  );
}
