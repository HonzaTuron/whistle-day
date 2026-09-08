import { createFileRoute } from "@tanstack/react-router";
import { VerifyEmail } from "../screens/VerifyEmail";

/** The token in the path is a credential — never in an index. */
export const Route = createFileRoute("/verify/$token")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: VerifyRoute,
});

function VerifyRoute() {
  const { token } = Route.useParams();
  return <VerifyEmail token={token} />;
}
