import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { MobileScreen } from "./components/mobile/MobileScreen";
import { ProjectorScreen } from "./components/projector/ProjectorScreen";
import { Landing } from "./routes/Landing";

const rootRoute = createRootRoute({ component: Outlet });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Landing,
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

const routeTree = rootRoute.addChildren([indexRoute, displayRoute, mobileRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
