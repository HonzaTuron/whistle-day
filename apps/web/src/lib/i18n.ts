import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "../locales/en";
import { cs } from "../locales/cs";

/**
 * Two languages, no library.
 *
 * What an i18n dependency buys is a message format, a plural rule table and a
 * loader. The platform already ships the second one — `Intl.PluralRules` knows
 * Czech better than any table we would paste in — and the third is a static
 * import when there are two locales and the whole app is one bundle. What is
 * left is interpolation, which is the twenty lines below.
 *
 * The part worth having is the part a library cannot give us: `en` is the
 * shape, `cs` is typed against it, and a key that is missing from one or
 * misspelled in a component fails the typecheck rather than showing an
 * organiser a dotted path in a hall.
 */

export const LOCALES = ["en", "cs"] as const;
export type Locale = (typeof LOCALES)[number];

/** What a language calls itself, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  cs: "Čeština",
};

/**
 * A message with more than one form.
 *
 * The keys are CLDR's plural categories, and which ones a language uses is not
 * a choice: English has `one` and `other`, Czech has `one` (1), `few` (2–4),
 * `other` (5 and up) and `many` (decimals — "1,5 zápasu"). A catalog gives the
 * forms its language actually selects; `other` is the one every language needs
 * and so the only one that is required.
 */
export interface PluralMessage {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | PluralMessage;
export type Vars = Record<string, string | number>;

/** The English catalog is the shape of every other one. */
export type Catalog = typeof en;
export type MessageKey = keyof Catalog;

const CATALOGS: Record<Locale, Record<string, Message>> = { en, cs };

/**
 * `{name}` is replaced, `{{` is a literal brace, and a placeholder with no
 * value is left standing.
 *
 * Left standing rather than blanked on purpose: "Back to {name}" on a screen
 * is a bug report, and an empty gap is a bug nobody notices for a month.
 */
function interpolate(template: string, vars: Vars | undefined): string {
  if (!vars) return template;
  return template.replace(/\{\{|\}\}|\{(\w+)\}/g, (match, name: string | undefined) => {
    if (match === "{{") return "{";
    if (match === "}}") return "}";
    const value = name === undefined ? undefined : vars[name];
    return value === undefined ? match : String(value);
  });
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

function selectForm(locale: Locale, message: PluralMessage, count: number): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  const category = rules.select(count);
  // `other` is the floor every language has, so a catalog that leaves a form
  // out reads as "this language does not distinguish that one" rather than as
  // a hole.
  return message[category] ?? message.other;
}

/**
 * Look a message up, in one locale, with no React involved.
 *
 * Exported because a few things that are not components need it — a document
 * title, a message thrown from the API layer — and because it is what makes
 * the hook below a one-liner.
 */
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const catalog = CATALOGS[locale];
  // A key missing from a translation is not an error worth blanking a screen
  // for. English is the fallback, and the key itself is the last resort.
  const message = catalog[key] ?? CATALOGS.en[key];
  if (message === undefined) return key;

  if (typeof message === "string") return interpolate(message, vars);

  const count = vars?.count;
  const form = selectForm(locale, message, typeof count === "number" ? count : 0);
  return interpolate(form, vars);
}

export type Translate = (key: MessageKey, vars?: Vars) => string;

// ---------------------------------------------------------------------------
// which language this browser is in
// ---------------------------------------------------------------------------

const STORAGE_KEY = "seedly.locale";

const isLocale = (value: string | null | undefined): value is Locale =>
  LOCALES.includes(value as Locale);

/**
 * The language, in the order the answers are trustworthy.
 *
 * A `?lang=` in the URL wins because it is the only way to aim a screen: the
 * laptop driving a projector in a hall in Brno is as likely as not to be in
 * English, and the wall should not be. It is remembered once used, so the
 * organiser pastes the link with it on once rather than every reload.
 *
 * Then what this browser was last told, then what it says it prefers. English
 * last, because it is the fallback rather than anybody's answer.
 */
export function detectLocale(): Locale {
  try {
    const asked = new URLSearchParams(window.location.search).get("lang");
    if (isLocale(asked)) {
      window.localStorage.setItem(STORAGE_KEY, asked);
      return asked;
    }
  } catch {
    /* no URL, or a browser refusing storage — the next answer is as good */
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* private mode; fall through to the browser's own preference */
  }

  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.split("-")[0]?.toLowerCase();
    if (isLocale(base)) return base;
  }
  return "en";
}

/**
 * The language, for the handful of callers that are not components.
 *
 * The provider writes every change to `document.documentElement.lang` because
 * a screen reader needs it there anyway, which makes the attribute a live
 * mirror of the locale rather than a second copy to keep in step. `main.tsx`
 * sets it before the first render, so this answers correctly from the first
 * line of code that runs.
 *
 * A sentence produced through this is worded at the moment it is made and does
 * not follow a later switch. Everything reached this way is a message thrown
 * once and shown until it is dismissed, which is short enough not to matter;
 * anything that stays on a screen belongs in a component and gets `t`.
 */
export function currentLocale(): Locale {
  const declared = document?.documentElement?.lang;
  return isLocale(declared) ? declared : "en";
}

/** `t` for those callers. */
export function tr(key: MessageKey, vars?: Vars): string {
  return translate(currentLocale(), key, vars);
}

function remember(locale: Locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // A browser that will not remember still renders the rest of this session
    // in the language that was picked.
  }
}

// ---------------------------------------------------------------------------
// the React end
// ---------------------------------------------------------------------------

interface I18n {
  locale: Locale;
  t: Translate;
  setLocale: (locale: Locale) => void;
}

/**
 * English until a provider says otherwise, so a component rendered in a test
 * without one still produces sentences rather than keys.
 */
const I18nContext = createContext<I18n>({
  locale: "en",
  t: (key, vars) => translate("en", key, vars),
  setLocale: () => undefined,
});

export function I18nProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initial ?? detectLocale());

  const setLocale = useCallback((next: Locale) => {
    remember(next);
    // The lang attribute is not decoration: it is what a screen reader picks a
    // voice from, and what hyphenation and quotation marks follow.
    document.documentElement.lang = next;
    setLocaleState(next);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      locale,
      t: (key, vars) => translate(locale, key, vars),
      setLocale,
    }),
    [locale, setLocale],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

/** Everything a component needs: the translator, and the language it is in. */
export function useI18n(): I18n {
  return useContext(I18nContext);
}

/** The common case, where only the translator is wanted. */
export function useT(): Translate {
  return useContext(I18nContext).t;
}
