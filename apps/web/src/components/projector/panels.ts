import type { DisplayPanel, DisplayPayload } from "@seedly/engine";
import { bracketStages, tablePools } from "../../lib/format";

export type PanelKind = "now_playing" | "standings" | "bracket" | "next_up" | "results" | "court_schedule" | "stage_progress" | "stage_table" | "branding";

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

  const addStageTable = () => {
    payload.stages.forEach((stage, index) => {
      if (stage.stage_table && stage.stage_table.length > 0) {
        panels.push({
          kind: "stage_table",
          title: `${stage.name} — cross-pool`,
          index,
        });
      }
    });
  };

  const addResults = () => {
    if (payload.recent.length > 0) {
      panels.push({ kind: "results", title: "Latest results", index: 0 });
    }
  };

  /**
   * The rotation this screen has been set up with: which panels, in which
   * order. Empty is all of them in the order below, which is what a screen
   * nobody has arranged sends.
   *
   * It shapes the rotation and nothing else: a screen pinned to one panel
   * through `mode` was answering a different question, and the fallback at the
   * bottom is there for a tournament with nothing in it rather than for an
   * organiser who has switched everything off — so both are decided before
   * this is applied.
   */
  const configured = payload.display.panels ?? [];
  const rank = new Map<DisplayPanel, number>(
    configured.map((panel, index) => [panel, index]),
  );
  const wanted = (kind: PanelKind) =>
    rank.size === 0 || rank.has(kind as DisplayPanel);

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
      addStageTable();
      addStandings();
      addBracket();
      addNextUp();
      addResults();
  }

  if (mode === "auto" && rank.size > 0) {
    const kept = panels.filter((panel) => wanted(panel.kind));
    if (kept.length > 0) {
      // Stable within a kind: four group tables stay in group order, wherever
      // the organiser put "Group tables" in the rotation.
      kept.sort(
        (a, b) =>
          (rank.get(a.kind as DisplayPanel) ?? 0) -
          (rank.get(b.kind as DisplayPanel) ?? 0),
      );
      panels.length = 0;
      panels.push(...kept);
    }
  }

  // A locked mode with nothing in it would leave a black screen; fall back to
  // whatever the tournament does have.
  if (panels.length === 0) {
    addStandings();
    addBracket();
    addNextUp();
  }

  // Who ran the day on, and — while the organiser is subscribed — the sponsors
  // whose money paid for the hall.
  //
  // It closes every mode, locked ones included: a screen pinned to "now
  // playing" is exactly where a sponsor slot is worth having, and a credit
  // that only appears in `auto` is a credit nobody sees. But only on a screen
  // that has something else to show — a tournament with nothing in it should
  // say so rather than rotate a logo at an empty hall.
  if (panels.length > 0) {
    panels.push({
      kind: "branding",
      title: payload.sponsors.length > 0 ? "Our partners" : "Powered by Seedly",
      index: 0,
    });
  }

  return panels;
}
