import { createFileRoute } from "@tanstack/react-router";
import { Claim } from "../screens/Claim";

/**
 * The far end of a handoff link. The token hands over an account, so this is
 * the last address in the app that should ever be in an index.
 */
export const Route = createFileRoute("/claim/$token")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: ClaimRoute,
});

function ClaimRoute() {
  const { token } = Route.useParams();
  return <Claim token={token} />;
}
