import { createFileRoute } from "@tanstack/react-router";
import { Results } from "../screens/Results";

/**
 * Running the day. Never indexed: it is one organiser's board, it needs their
 * session to be worth anything, and a tournament that leaked into a search
 * result is a tournament somebody can read who was not given the link.
 */
export const Route = createFileRoute("/t/$id")({
  head: () => {
    const SITE = "https://whistle.day";
    return {
      meta: [
        { title: "Whistle.day — Tournament Results & Scoring" },
        {
          name: "description",
          content: "Organiser results board, live court scoring, and bracket management on Whistle.day.",
        },
        { property: "og:site_name", content: "Whistle.day" },
        { property: "og:type", content: "website" },
        { property: "og:title", content: "Whistle.day — Tournament Results & Scoring" },
        {
          property: "og:description",
          content: "Organiser results board, live court scoring, and bracket management on Whistle.day.",
        },
        { property: "og:image", content: `${SITE}/og.png` },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:type", content: "image/png" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Whistle.day — Tournament Results & Scoring" },
        {
          name: "twitter:description",
          content: "Organiser results board, live court scoring, and bracket management on Whistle.day.",
        },
        { name: "twitter:image", content: `${SITE}/og.png` },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: ResultsRoute,
});

function ResultsRoute() {
  const { id } = Route.useParams();
  return <Results id={id} />;
}
