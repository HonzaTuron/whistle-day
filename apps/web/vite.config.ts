import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
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
     */
    VitePWA({
      // A plain registration in the built index.html, rather than the virtual
      // module — which would pull `workbox-window` into the bundle to do the
      // update prompting this app has deliberately decided against.
      injectRegister: "inline",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Seedly",
        short_name: "Seedly",
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
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // A navigation offline is a route in this app, so it is served the
        // shell. Anything under /api is data and has to be allowed to fail —
        // handing it an HTML document instead would turn "no signal" into a
        // parse error nobody could read.
        navigateFallback: "index.html",
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
