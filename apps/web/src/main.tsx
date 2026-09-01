import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { router } from "./router";
import "./styles.css";

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

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
