import { createFileRoute } from "@tanstack/react-router";
import { ResetPassword } from "../screens/ResetPassword";

/** The token in the path is a credential — never in an index. */
export const Route = createFileRoute("/reset/$token")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: ResetRoute,
});

function ResetRoute() {
  const { token } = Route.useParams();
  return <ResetPassword token={token} />;
}
