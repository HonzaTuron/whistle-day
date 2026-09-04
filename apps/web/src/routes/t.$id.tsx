import { createFileRoute } from "@tanstack/react-router";
import { Results } from "../screens/Results";

/**
 * Running the day. Never indexed: it is one organiser's board, it needs their
 * session to be worth anything, and a tournament that leaked into a search
 * result is a tournament somebody can read who was not given the link.
 */
export const Route = createFileRoute("/t/$id")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: ResultsRoute,
});

function ResultsRoute() {
  const { id } = Route.useParams();
  return <Results id={id} />;
}
