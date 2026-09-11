import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "../screens/Landing";

export const Route = createFileRoute("/")({
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
  }),
  component: Landing,
});
