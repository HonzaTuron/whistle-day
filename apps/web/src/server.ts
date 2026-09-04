import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

/**
 * The whole server. Prerendered pages are served as files and never reach it;
 * the app screens are rendered here and hydrate on arrival.
 */
export default createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});
