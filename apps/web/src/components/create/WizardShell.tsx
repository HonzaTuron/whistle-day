import type { ReactNode } from "react";

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

export function WizardShell({ step, title, hint, onBack, children, footer }: Props) {
  const index = WIZARD_STEPS.indexOf(step);

  return (
    <div className="wiz">
      <header className="wiz__bar">
        {onBack ? (
          <button type="button" className="wiz__back" onClick={onBack} aria-label="Back">
            ←
          </button>
        ) : (
          <span className="wiz__back wiz__back--empty" aria-hidden="true" />
        )}

        <ol className="wiz__progress" aria-label={`Step ${index + 1} of ${WIZARD_STEPS.length}`}>
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
