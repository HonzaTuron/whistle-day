import { createFileRoute } from "@tanstack/react-router";
import { OAuthConsent } from "../screens/OAuthConsent";

/**
 * The far end of `GET /oauth/authorize` (backend/internal/oauth) — an agent
 * asking to connect to whoever signs in here. Not a page anybody finds.
 */
export interface OAuthConsentSearch {
  request?: string;
}

export const Route = createFileRoute("/oauth/consent")({
  validateSearch: (search: Record<string, unknown>): OAuthConsentSearch => ({
    request: typeof search.request === "string" ? search.request : undefined,
  }),
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: OAuthConsentRoute,
});

function OAuthConsentRoute() {
  const { request } = Route.useSearch();
  return <OAuthConsent requestId={request ?? ""} />;
}
