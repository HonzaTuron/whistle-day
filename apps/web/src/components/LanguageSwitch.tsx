import { LOCALE_FLAG, LOCALE_NAMES, LOCALE_SHORT, LOCALES, useI18n } from "../lib/i18n";

/**
 * The language toggle, as a flag and a two-letter tag per language.
 *
 * It lives in the app's own chrome (see `AppChrome`), where it is a control
 * rather than a line of prose — so a flag reads faster than a word, and 🇬🇧/🇨🇿
 * is legible at arm's length in a hall. The written-out name is still there for
 * a screen reader and as the button's `title`, because a flag names a country
 * and the reader wants a language.
 *
 * Not a dropdown: a row of flags is still one glance, and a dropdown would be
 * a click spent finding out what the options are.
 */
export function LanguageSwitch({
  className = "",
  onPick,
}: {
  className?: string;
  /** Called after a language is picked, so a collapsible host can close. */
  onPick?: () => void;
}) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={["langswitch", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={t("common.language")}
    >
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          className={"langswitch__option" + (option === locale ? " is-on" : "")}
          aria-pressed={option === locale}
          // The language's own name, in that language: somebody looking for
          // Czech is looking for "Čeština", not for "Czech".
          lang={option}
          title={LOCALE_NAMES[option]}
          onClick={() => {
            setLocale(option);
            onPick?.();
          }}
        >
          <span className="langswitch__flag" aria-hidden="true">
            {LOCALE_FLAG[option]}
          </span>
          <span className="langswitch__code" aria-hidden="true">
            {LOCALE_SHORT[option]}
          </span>
          <span className="sr-only">{LOCALE_NAMES[option]}</span>
        </button>
      ))}
    </div>
  );
}
