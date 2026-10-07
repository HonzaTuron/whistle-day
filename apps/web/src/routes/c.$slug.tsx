import { createFileRoute } from "@tanstack/react-router";
import { Club } from "../screens/Club";

/**
 * A club's page. Public — it is the one address here meant to be handed
 * round — and still not indexed: what it lists is whatever its owner ticked
 * this morning, and each row is a way in to somebody's running tournament.
 */
export const Route = createFileRoute("/c/$slug")({
  head: () => ({
    meta: [{ title: "Whistle.day — Club" }, { name: "robots", content: "noindex" }],
  }),
  component: ClubRoute,
});

function ClubRoute() {
  const { slug } = Route.useParams();
  return <Club slug={slug} />;
}
