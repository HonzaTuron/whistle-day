import { createFileRoute } from "@tanstack/react-router";
import { Create } from "../screens/Create";
import { PRESETS, type PresetId } from "../lib/presets";

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
}

const isPresetId = (value: unknown): value is PresetId =>
  PRESETS.some((preset) => preset.id === value);

export const Route = createFileRoute("/new")({
  validateSearch: (search: Record<string, unknown>): NewSearch => ({
    preset: isPresetId(search.preset) ? search.preset : undefined,
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
  const { preset } = Route.useSearch();
  return <Create initialPreset={preset} />;
}
