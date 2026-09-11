import { createFileRoute } from "@tanstack/react-router";
import { MobileScreen } from "../components/mobile/MobileScreen";
import { displayHeadTags, fetchDisplayMetadata } from "../lib/display-meta";

/** The phone view. Same token, same reason not to index it. */
export const Route = createFileRoute("/m/$token")({
  loader: ({ params }) => fetchDisplayMetadata(params.token),
  head: ({ loaderData, params }) =>
    displayHeadTags({ payload: loaderData, token: params.token, mode: "phone" }),
  component: MobileRoute,
});

function MobileRoute() {
  const { token } = Route.useParams();
  return <MobileScreen token={token} />;
}
