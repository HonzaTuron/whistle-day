import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitch } from "./LanguageSwitch";
import { LOCALE_FLAG, LOCALE_NAMES, LOCALE_SHORT, useI18n } from "../lib/i18n";
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
 *
 * Small means one chip: the language you are in, folded. The full row of
 * flags plus the build was wide enough to sit on top of the wizard's progress
 * and the board's title on a phone, for a control most people never touch.
 * One tap opens the row, picking a language folds it again.
 */
export function AppChrome() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Open is a passing state: a tap anywhere else, or Escape, folds it back.
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (!isAppRoute(pathname)) return null;
  if (pathname.startsWith("/display")) return null;
  if (pathname.startsWith("/account")) return null;

  return (
    <div className="appchrome" ref={root}>
      {open ? (
        <>
          <span className="appchrome__build" title={`build ${__BUILD_SHA__}`}>
            {__BUILD_SHA__}
          </span>
          <LanguageSwitch className="langswitch--app" onPick={() => setOpen(false)} />
        </>
      ) : (
        <button
          type="button"
          className="appchrome__chip"
          aria-expanded={false}
          aria-label={`${t("common.language")}: ${LOCALE_NAMES[locale]}`}
          onClick={() => setOpen(true)}
        >
          <span className="langswitch__flag" aria-hidden="true">
            {LOCALE_FLAG[locale]}
          </span>
          <span className="langswitch__code" aria-hidden="true">
            {LOCALE_SHORT[locale]}
          </span>
        </button>
      )}
    </div>
  );
}
