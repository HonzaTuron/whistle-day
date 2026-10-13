import { mkdir, writeFile } from "node:fs/promises";
import type { Plugin } from "vite";
import { PAGES, pageBySlug } from "../src/content/index.ts";
import { llmsTxt } from "../src/content/llms.ts";
import { pageMarkdown } from "../src/content/markdown.ts";

const SITE = "https://whistle.day";

/**
 * Writes an `index.md` beside every prerendered `index.html`.
 *
 * A request that says `Accept: text/markdown` gets that file instead of the
 * document — the choosing is done by Caddy, in `deploy/Caddyfile`, because
 * prerendered pages are served from disk and never reach the renderer. So the
 * rule there is simply "is there an `index.md` at this path", and this is what
 * puts one there.
 *
 * The homepage is not a `Page`; its markdown is the text of `/llms.txt`, which
 * is already the site said in markdown: what it is, and where everything is.
 *
 * Written once the client build has finished, for the reason `llmsTxt()`
 * gives. In dev the middleware answers the same header, so the negotiation
 * can be tried without a build.
 */
export function markdownPages(): Plugin {
  return {
    name: "whistleday:markdown-pages",

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.headers.accept?.includes("text/markdown")) return next();

        const slug = (request.url ?? "/").split("?")[0].replace(/^\/|\/$/g, "");
        const page = pageBySlug(slug);
        if (slug !== "" && !page) return next();

        response.setHeader("Content-Type", "text/markdown; charset=utf-8");
        response.setHeader("Vary", "Accept");
        response.end(page ? pageMarkdown(page, SITE) : llmsTxt(PAGES, SITE));
      });
    },

    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        const environment = (this as { environment?: { name?: string } }).environment;
        if (environment?.name !== "client") return;

        await writeFile("dist/client/index.md", llmsTxt(PAGES, SITE));
        for (const page of PAGES) {
          // Not relying on the prerender having made the directory first.
          await mkdir(`dist/client/${page.slug}`, { recursive: true });
          await writeFile(`dist/client/${page.slug}/index.md`, pageMarkdown(page, SITE));
        }
        this.info(`markdown: ${PAGES.length + 1} pages written`);
      },
    },
  };
}
