import { createFileRoute } from "@tanstack/react-router";
import { Join } from "../screens/Join";

/** The other end of a crew QR code. The token is the credential; never indexed. */
export const Route = createFileRoute("/join/$token")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: JoinRoute,
});

function JoinRoute() {
  const { token } = Route.useParams();
  return <Join token={token} />;
}
