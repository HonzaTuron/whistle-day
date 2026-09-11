import { createFileRoute } from "@tanstack/react-router";
import { Account } from "../screens/Account";

/**
 * Signing in is nobody's search result.
 *
 * `next` exists for one caller: the OAuth consent screen, which sends
 * somebody here to sign in before it can ask them to approve anything. An
 * absent `next` is the ordinary case — /account on its own — and behaves
 * exactly as it always did.
 */
export interface AccountSearch {
  next?: string;
}

export const Route = createFileRoute("/account")({
  validateSearch: (search: Record<string, unknown>): AccountSearch => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: AccountRoute,
});

function AccountRoute() {
  const { next } = Route.useSearch();
  return <Account next={next} />;
}
