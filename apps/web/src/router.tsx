import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { MobileScreen } from "./components/mobile/MobileScreen";
import { ProjectorScreen } from "./components/projector/ProjectorScreen";
import { Account } from "./routes/Account";
import { Create } from "./routes/Create";
import { Landing } from "./routes/Landing";
import { Results } from "./routes/Results";

const rootRoute = createRootRoute({ component: Outlet });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Landing,
});

/** The organiser: name, teams, courts, format, and a link for the wall. */
const createRouteEntry = createRoute({
  getParentRoute: () => rootRoute,
  path: "/new",
  component: Create,
});

/** Keeping a tournament that only this browser can reach. */
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: Account,
});

/** Running the day: the match list, and a score for each. */
const resultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/t/$id",
  component: function ResultsRoute() {
    const { id } = resultsRoute.useParams();
    return <Results id={id} />;
  },
});

/** The projector: unattended, rotating, read from across a hall. */
const displayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/display/$token",
  component: function DisplayRoute() {
    const { token } = displayRoute.useParams();
    return <ProjectorScreen token={token} />;
  },
});

/** The phone: held by one person looking for one thing. */
const mobileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/m/$token",
  component: function MobileRoute() {
    const { token } = mobileRoute.useParams();
    return <MobileScreen token={token} />;
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  createRouteEntry,
  accountRoute,
  resultsRoute,
  displayRoute,
  mobileRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
