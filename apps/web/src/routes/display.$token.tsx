import { createFileRoute } from "@tanstack/react-router";
import { ProjectorScreen } from "../components/projector/ProjectorScreen";

/** The projector. The token is the only credential, so it stays out of the index. */
export const Route = createFileRoute("/display/$token")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: DisplayRoute,
});

function DisplayRoute() {
  const { token } = Route.useParams();
  return <ProjectorScreen token={token} />;
}
