import { useRouterState } from "@tanstack/react-router";
import { LanguageSwitch } from "./LanguageSwitch";
import { isAppRoute } from "../lib/routes";

/**
 * The strip in the top corner of the app — the language switch, and the build
 * it is running.
 *
 * App screens only. The marketing pages have no switch: a visitor who searched
 * their way in gets the page in their system language and never has to find a
 * control. The projector is out too — it is a wall, aimed once with `?lang=` on
 * the link, and a floating chip would only burn into the projected image.
 * `/account` carries the marketing pages' own `SiteNav` rather than a header of
 * its own, so it follows their reasoning as well: this would only float on top
 * of it, doubling up on the corner `SiteNav`'s own layout already uses.
 *
 * Fixed rather than folded into each screen's header, because the wizard, the
 * board and the phone view keep three different headers and none of them has an
 * obvious seat for this. Fixed and small stays out of all three.
 */
export function AppChrome() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!isAppRoute(pathname)) return null;
  if (pathname.startsWith("/display")) return null;
  if (pathname.startsWith("/account")) return null;

  return (
    <div className="appchrome">
      <LanguageSwitch className="langswitch--app" />
      <span className="appchrome__build" title={`build ${__BUILD_SHA__}`}>
        {__BUILD_SHA__}
      </span>
    </div>
  );
}
