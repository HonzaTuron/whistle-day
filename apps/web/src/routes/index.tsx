import { createFileRoute } from "@tanstack/react-router";
import { HOME_UPDATED } from "../content";
import { organization } from "../content/schema";
import { Landing } from "../screens/Landing";
import { isLocale, type Locale } from "../lib/i18n";

export interface HomeSearch {
  /** Aims the homepage the way `?lang=` aims a projector. */
  lang?: Locale;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const lang = typeof search.lang === "string" ? search.lang : undefined;
    return { lang: isLocale(lang) ? lang : undefined };
  },
  head: () => ({
    meta: [
      { title: "Whistle.day — Free Tournament Organiser" },
      {
        name: "description",
        content:
          "Free tournament organiser. Draw groups, brackets or a Swiss, run the day from your phone, and put the results on a projector. No account, no ads.",
      },
      { property: "og:site_name", content: "Whistle.day" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://whistle.day" },
      { property: "og:title", content: "Whistle.day — Free Tournament Organiser" },
      {
        property: "og:description",
        content:
          "Free tournament organiser. Draw groups, brackets or a Swiss, run the day from your phone, and put the results on a projector. No account, no ads.",
      },
      { property: "og:image", content: "https://whistle.day/og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Whistle.day — Free Tournament Organiser" },
      {
        name: "twitter:description",
        content:
          "Free tournament organiser. Draw groups, brackets or a Swiss, run the day from your phone, and put the results on a projector. No account, no ads.",
      },
      { name: "twitter:image", content: "https://whistle.day/og.png" },
    ],
    links: [{ rel: "canonical", href: "https://whistle.day" }],
    scripts: [
      organization("https://whistle.day"),
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Whistle.day",
          url: "https://whistle.day",
          publisher: { "@id": "https://whistle.day/#organization" },
          dateModified: HOME_UPDATED,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Whistle.day",
          url: "https://whistle.day",
          applicationCategory: "SportsApplication",
          operatingSystem: "All",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
        }),
      },
    ],
  }),
  component: Landing,
});
