import { LOCALES, LOCALE_NAMES, useI18n } from "../lib/i18n";

/**
 * Two words and a choice between them.
 *
 * Not a dropdown, because with two languages a dropdown is a click to find out
 * what the options are. Not a flag either: a flag is a country, and the people
 * in a hall in Brno reading this in English are not English.
 *
 * It appears where somebody is already stopped and reading — the landing page,
 * the account screen, the bottom of the spectators' phone view. It is
 * deliberately absent from the organiser's board and from the projector, which
 * are screens somebody is working from; a projector is aimed with `?lang=` on
 * the link instead, once, by whoever set it up.
 */
export function LanguageSwitch({ className = "" }: { className?: string }) {
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
          onClick={() => setLocale(option)}
        >
          {LOCALE_NAMES[option]}
        </button>
      ))}
    </div>
  );
}
