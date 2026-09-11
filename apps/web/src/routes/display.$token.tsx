import { createFileRoute } from "@tanstack/react-router";
import { ProjectorScreen } from "../components/projector/ProjectorScreen";
import { displayHeadTags, fetchDisplayMetadata } from "../lib/display-meta";

/** The projector. The token is the only credential, so it stays out of the index. */
export const Route = createFileRoute("/display/$token")({
  loader: ({ params }) => fetchDisplayMetadata(params.token),
  head: ({ loaderData, params }) =>
    displayHeadTags({ payload: loaderData, token: params.token, mode: "display" }),
  component: DisplayRoute,
});

function DisplayRoute() {
  const { token } = Route.useParams();
  return <ProjectorScreen token={token} />;
}
