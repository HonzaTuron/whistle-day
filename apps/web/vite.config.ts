import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { MARKETING_PATHS } from "./src/content/index.ts";

/**
 * The marketing pages are prerendered; the app screens are not.
 *
 * Everything under `/t`, `/display`, `/m`, `/join`, `/account` and `/new` is
 * one organiser's live data behind a token, so there is nothing to prerender
 * and nothing that should be in an index. Everything else is static per URL —
 * the content of a 12-team round robin page does not depend on the request —
 * so it is built to HTML once and served as a file.
 *
 * The path list comes from `src/content`, which is also what the router serves
 * from. That import is the point: a page cannot exist without being
 * prerendered, and the sitemap cannot list a page that does not exist.
 */
const APP_ROUTES = /^\/(t|display|m|join|account|new)(\/|$)/;

/**
 * The crawler hands paths in with their query string attached, and every
 * marketing page's call to action points at `/new?preset=…&teams=…`. Matching
 * the pattern above against the raw string would let all of those through, so
 * the query is cut off before the test.
 */
const isAppRoute = (path: string) => APP_ROUTES.test(path.split("?")[0]);

export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        concurrency: 8,
        failOnError: true,

        // Both discovery mechanisms are off, and the page list below is the
        // whole truth instead.
        //
        // Automatic discovery adds every static route, which means `/new` and
        // `/account`. Link crawling then follows each marketing page's call to
        // action and finds `/new?preset=groups&teams=12` sixty more times. The
        // prerender filter rejects all of those, but the sitemap is built from
        // the discovered set rather than the prerendered one, so they come
        // back as URLs pointing at pages that were never built.
        //
        // Enumerating instead makes the built set exactly the content table,
        // which is the invariant worth having: a page cannot be served without
        // being prerendered and listed, or listed without existing.
        autoStaticPathsDiscovery: false,
        crawlLinks: false,

        filter: ({ path }: { path: string }) => !isAppRoute(path),
      },

      pages: ["/", ...MARKETING_PATHS].map((path) => ({
        path,
        prerender: { enabled: true },
      })),

      sitemap: {
        enabled: true,
        host: "https://whistle.day",
      },
    }),

    // Start's plugin has to come before react's.
    react(),

    /**
     * The app shell, kept on the device.
     *
     * Not for installability, though that comes with it — for the reload. A
     * phone in a pocket has its tab evicted, a projector gets nudged, somebody
     * pulls to refresh out of habit, and on a hall's wifi any of those is a
     * white screen until the network comes back. Precaching the built assets
     * means the app starts from the device and only the data needs a signal,
     * which is the half the outbox and the board cache already handle.
     *
     * What is deliberately *not* here is any caching of `/api`. Writes must
     * never be intercepted — a queued result that a service worker answered
     * from a cache would look sent and never arrive. And `/api/display/:token`
     * is left alone too, even though caching it would help a projector that
     * reloads: that endpoint is read with `If-None-Match` and answers 304, and
     * a cache sitting in the middle of a conditional request is a good way to
     * pin the wall to a payload from an hour ago. Workbox only handles what it
     * is given a route for, so everything else falls through to the network
     * exactly as it did before.
     *
     * Prerendering changes two things here, and both had to be corrected
     * rather than inherited — see `globPatterns` and `navigateFallback`.
     *
     * UNRESOLVED, AND THIS MUST NOT MERGE UNTIL IT IS. Under Start this plugin
     * emits `manifest.webmanifest` and copies the icons, but produces no
     * `sw.js` at all: Start builds the client into `dist/client` through its
     * own environment, and the worker-generating hook does not fire against
     * it. The settings below are therefore the intent rather than a
     * description of the build — nothing is precached, `navigateFallback` is
     * inert, and a phone that loses signal mid-tournament gets a white screen
     * instead of the queue that `api/outbox.ts` was written for.
     *
     * Losing offline scoring to gain marketing pages is not a trade worth
     * making. Either the worker is generated from `dist/client` in a
     * post-build step, or the marketing pages get their own build and the app
     * keeps this one.
     */
    VitePWA({
      // There is no built `index.html` to inject a registration into any more:
      // the document is `routes/__root.tsx`, and it registers the worker by
      // hand. The virtual module is the other option and it pulls
      // `workbox-window` in to do the update prompting this app has
      // deliberately decided against.
      injectRegister: false,
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Whistle.day",
        short_name: "Whistle.day",
        description: "Run a tournament from your phone.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0b0f14",
        theme_color: "#0b0f14",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // `html` is gone from the patterns on purpose. The glob now matches
        // 123 prerendered marketing pages, so an organiser opening the wizard
        // would download every "12 team round robin" page ever written onto
        // their phone before their tournament started. The shell below is the
        // only document the worker needs; the marketing pages are static files
        // a browser caches for itself, and they are worth nothing on a device
        // with no signal anyway.
        globPatterns: ["**/*.{js,css,svg,png,woff2}"],
        additionalManifestEntries: [{ url: "/new", revision: null }],

        // A navigation offline is a route in this app, so it is served the
        // shell — but only for the app's own routes. Without the allowlist,
        // somebody with a perfectly good connection asking for a marketing
        // page would be handed the wizard's HTML out of the cache. Anything
        // under /api is data and has to be allowed to fail, or "no signal"
        // becomes a parse error nobody can read.
        navigateFallback: "/new",
        navigateFallbackAllowlist: [APP_ROUTES],
        navigateFallbackDenylist: [/^\/api\//],

        // The projector can be open for eight hours across a deploy. Claiming
        // the page mid-tournament would reload the wall; this takes over on
        // the next load instead, which is after the day has finished.
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
  ],

  server: {
    port: 5173,
    // The projector and the API must look same-origin, so the token in the
    // URL is all a screen ever needs — no CORS, no credentials.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8090",
        changeOrigin: true,
      },
    },
  },
});
