import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, detectLocale } from "./lib/i18n";
import { router } from "./router";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/*
 * The service worker registers itself.
 *
 * `injectRegister: "inline"` in vite.config.ts puts a plain
 * `navigator.serviceWorker.register()` in the built index.html, so there is no
 * registration code here and no `workbox-window` in the bundle. Nothing is
 * prompted and nothing reloads: a new build is fetched in the background and
 * waits, and the browser hands over the next time the app is started with no
 * tab of it already open. An organiser halfway through a group stage should
 * never be asked about a version, and a projector that has been on the wall
 * since nine o'clock should certainly not reload itself to get one.
 */

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from index.html");

/*
 * The language is settled before the first render rather than during it.
 *
 * `index.html` ships with `lang="en"` because a static file cannot know, and a
 * document whose lang attribute disagrees with what is on it is read out in
 * the wrong accent by a screen reader and hyphenated by the wrong rules. So it
 * is corrected here, once, with the same answer the provider will start from.
 */
const locale = detectLocale();
document.documentElement.lang = locale;

createRoot(container).render(
  <StrictMode>
    <I18nProvider initial={locale}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>
  </StrictMode>,
);
