import { writeFile } from "node:fs/promises";
import type { Plugin } from "vite";
import { PAGES } from "../src/content/index.ts";
import { llmsTxt as render } from "../src/content/llms.ts";

const SITE = "https://whistle.day";

/**
 * Writes `/llms.txt` from the page list.
 *
 * The text is `src/content/llms.ts`; this only decides when it reaches disk.
 * Like the service worker it is written once the client build has finished,
 * next to `robots.txt`, and for the same reason: Start builds two
 * environments and only one of them is the directory anybody fetches from.
 *
 * In dev there is no built directory, and without the middleware the request
 * would fall through to the marketing splat route and come back as a 404 page.
 */
export function llmsTxt(): Plugin {
  return {
    name: "whistleday:llms-txt",

    configureServer(server) {
      server.middlewares.use("/llms.txt", (_request, response) => {
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(render(PAGES, SITE));
      });
    },

    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        const environment = (this as { environment?: { name?: string } }).environment;
        if (environment?.name !== "client") return;

        await writeFile("dist/client/llms.txt", render(PAGES, SITE));
        this.info(`llms.txt: ${PAGES.length} pages listed`);
      },
    },
  };
}
