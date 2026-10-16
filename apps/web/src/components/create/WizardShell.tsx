import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useT } from "../../lib/i18n";

/**
 * The frame every step of the wizard sits in.
 *
 * It is built for one thumb on a phone in a noisy hall: one question per
 * screen, the answer in the middle, and the button that moves you forward
 * pinned to the bottom where the thumb already is. The footer does not scroll
 * away when a team list grows to twenty rows — a "next" button you have to go
 * looking for is a step people get stuck on.
 */

export const WIZARD_STEPS = ["name", "teams", "courts", "format"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

interface Props {
  step: WizardStep;
  title: string;
  hint?: string;
  onBack?: () => void;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * How much of the bottom of the layout the on-screen keyboard is covering.
 *
 * Android is told to resize the page for the keyboard (see the viewport meta),
 * so there this stays 0. iOS Safari ignores that and lays the keyboard over
 * the page, which would leave a footer pinned to the layout's bottom edge
 * hidden under it — exactly when someone is typing teams one after another and
 * needs the "add" button. The gap between the layout and the visual viewport
 * is the keyboard, and the footer is lifted by that much.
 */
function useKeyboardInset(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const element = target.current;
    if (!viewport || !element) return;

    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      element.style.setProperty("--keyboard-inset", `${Math.max(0, Math.round(covered))}px`);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [target]);
}

export function WizardShell({ step, title, hint, onBack, children, footer }: Props) {
  const t = useT();
  const index = WIZARD_STEPS.indexOf(step);
  const frame = useRef<HTMLDivElement>(null);
  useKeyboardInset(frame);

  return (
    <div className="wiz" ref={frame}>
      <header className="wiz__bar">
        {onBack ? (
          <button
            type="button"
            className="wiz__back"
            onClick={onBack}
            aria-label={t("common.back")}
          >
            ←
          </button>
        ) : (
          <span className="wiz__back wiz__back--empty" aria-hidden="true" />
        )}

        <ol
          className="wiz__progress"
          aria-label={t("wizard.step", {
            current: index + 1,
            total: WIZARD_STEPS.length,
          })}
        >
          {WIZARD_STEPS.map((name, i) => (
            <li
              key={name}
              className={
                "wiz__pip" +
                (i === index ? " is-current" : "") +
                (i < index ? " is-done" : "")
              }
            />
          ))}
        </ol>

        <span className="wiz__back wiz__back--empty" aria-hidden="true" />
      </header>

      <main className="wiz__body">
        <h1 className="wiz__title">{title}</h1>
        {hint ? <p className="wiz__hint">{hint}</p> : null}
        {children}
      </main>

      <footer className="wiz__footer">{footer}</footer>
    </div>
  );
}
