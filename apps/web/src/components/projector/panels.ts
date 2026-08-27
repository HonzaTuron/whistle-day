import type { DisplayPayload } from "@seedly/engine";
import { bracketStages, tablePools } from "../../lib/format";

export type PanelKind = "now_playing" | "standings" | "bracket" | "next_up" | "results" | "court_schedule" | "stage_progress";

export interface Panel {
  kind: PanelKind;
  title: string;
  /** Which table or bracket this panel shows, when there is more than one. */
  index: number;
  subtitle?: string;
}

/**
 * Which panels this screen should cycle through.
 *
 * Empty panels are dropped rather than shown blank: a hall with no live match
 * should not stare at an empty "Now playing" for fifteen seconds. Pools get one
 * panel each, because two tables at projector size do not fit side by side.
 */
export function buildPanels(payload: DisplayPayload): Panel[] {
  const mode = payload.display.mode;
  const panels: Panel[] = [];

  const pools = tablePools(payload);
  const brackets = bracketStages(payload);

  const addNowPlaying = () => {
    if (payload.now_playing.length > 0) {
      panels.push({ kind: "now_playing", title: "Now playing", index: 0 });
    }
  };
  const addStandings = () => {
    pools.forEach(({ stage, pool }, index) => {
      panels.push({
        kind: "standings",
        title: `Group ${pool.name}`,
        subtitle: stage.name,
        index,
      });
    });
  };
  const addBracket = () => {
    brackets.forEach((stage, index) => {
      panels.push({ kind: "bracket", title: stage.name, index });
    });
  };
  const addNextUp = () => {
    if (payload.next_up.length > 0) {
      panels.push({ kind: "next_up", title: "Next up", index: 0 });
    }
  };
  const addCourtSchedule = () => {
    if (payload.courts.length > 0) {
      panels.push({ kind: "court_schedule", title: "Court schedule", index: 0 });
    }
  };

  const addStageProgress = () => {
    if (payload.stages.length > 0) {
      panels.push({ kind: "stage_progress", title: "Stage progress", index: 0 });
    }
  };

  const addResults = () => {
    if (payload.recent.length > 0) {
      panels.push({ kind: "results", title: "Latest results", index: 0 });
    }
  };

  switch (mode) {
    case "now_playing":
      addNowPlaying();
      break;
    case "standings":
      addStandings();
      break;
    case "bracket":
      addBracket();
      break;
    case "schedule":
      addNextUp();
      break;
    case "results":
      addResults();
      break;
    case "court_schedule":
      addCourtSchedule();
      break;
    case "stage_progress":
      addStageProgress();
      break;
    default:
      addNowPlaying();
      addStageProgress();
      addCourtSchedule();
      addStandings();
      addBracket();
      addNextUp();
      addResults();
  }

  // A locked mode with nothing in it would leave a black screen; fall back to
  // whatever the tournament does have.
  if (panels.length === 0) {
    addStandings();
    addBracket();
    addNextUp();
  }
  return panels;
}
