import { createFileRoute } from "@tanstack/react-router";
import { MobileScreen } from "../components/mobile/MobileScreen";

/** The phone view. Same token, same reason not to index it. */
export const Route = createFileRoute("/m/$token")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: MobileRoute,
});

function MobileRoute() {
  const { token } = Route.useParams();
  return <MobileScreen token={token} />;
}
