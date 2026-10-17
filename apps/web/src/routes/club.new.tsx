import { createFileRoute } from "@tanstack/react-router";
import { ClubSetup } from "../screens/ClubSetup";

/** Setting up a club page. Behind an account, so nobody's search result. */
export const Route = createFileRoute("/club/new")({
  head: () => ({
    meta: [{ title: "Set up a club page — Whistle.day" }, { name: "robots", content: "noindex" }],
  }),
  component: ClubSetup,
});
