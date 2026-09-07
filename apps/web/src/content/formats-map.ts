import type { StageFormat } from "@whistleday/engine";
import type { PresetId } from "../lib/presets";

/**
 * A preset is a way to run a day; a format is what one stage of it is.
 *
 * They are not the same thing and mostly should not be conflated — "groups"
 * and "swiss" are both two stages, a round-robin or Swiss followed by a
 * playoff, and a preset is the pair. But a printable sheet draws one stage, so
 * it needs the first of them, and this is where that flattening is written
 * down rather than guessed at each call site.
 */
export const FORMAT_OF: Record<PresetId, StageFormat> = {
  knockout: "single_elim",
  double: "double_elim",
  everyone: "round_robin",
  everyoneTwice: "round_robin",
  // The stage worth printing is the one everybody plays. The playoff on top of
  // it is drawn from tables that do not exist until the day is half over, so
  // there is no sheet for it — which is also why there are no printable pages
  // for the group presets.
  groups: "round_robin",
  swiss: "swiss",
};
