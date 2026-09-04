import { createFileRoute } from "@tanstack/react-router";
import { Account } from "../screens/Account";

/** Signing in is nobody's search result. */
export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: Account,
});
