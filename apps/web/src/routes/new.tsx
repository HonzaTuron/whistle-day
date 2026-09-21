import { useEffect, useLayoutEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Create } from "../screens/Create";
import { isLocale, useI18n, type Locale } from "../lib/i18n";
import { PRESETS, type PresetId } from "../lib/presets";
import { SPORTS, type SportId } from "../lib/scoring";

/**
 * The wizard, optionally started where a marketing page left off.
 *
 * A page about a twelve-team group stage knows two things about whoever
 * followed its call to action, and dropping them onto a blank first screen
 * throws both away. So the format and the field size travel in the query
 * string and the wizard opens on them.
 *
 * They are a suggestion rather than a setting: the organiser can change either
 * on the way through, and an absent or unrecognised value simply leaves the
 * wizard behaving as it always did.
 */
export interface NewSearch {
  preset?: PresetId;
  /** The sport chip a marketing page already knows. A suggestion, like preset. */
  sport?: SportId;
  /** Aims the wizard. Wins over a laptop that is in another language. */
  lang?: Locale;
}

const isPresetId = (value: unknown): value is PresetId =>
  PRESETS.some((preset) => preset.id === value);

const isSportId = (value: unknown): value is SportId =>
  SPORTS.some((sport) => sport.id === value);

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const Route = createFileRoute("/new")({
  validateSearch: (search: Record<string, unknown>): NewSearch => ({
    preset: isPresetId(search.preset) ? search.preset : undefined,
    sport: isSportId(search.sport) ? search.sport : undefined,
    lang: isLocale(typeof search.lang === "string" ? search.lang : undefined)
      ? (search.lang as Locale)
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Set up a tournament — Whistle.day" },
      {
        name: "description",
        content:
          "Name it, add the teams, pick how the day should run. A link and a QR code at the end. Free, no account.",
      },
    ],
  }),
  component: CreateRoute,
});

function CreateRoute() {
  const { preset, sport, lang } = Route.useSearch();
  const { locale, setLocale } = useI18n();
  // Client navigation does not remount the provider, so a `?lang=` that
  // arrived with the call to action has to be applied here — before paint,
  // or the wizard flashes in the laptop's language.
  useIsoLayoutEffect(() => {
    if (lang && lang !== locale) setLocale(lang);
  }, [lang, locale, setLocale]);
  return <Create initialPreset={preset} initialSport={sport} />;
}
