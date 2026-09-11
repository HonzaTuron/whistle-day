import type { DisplayPayload } from "@whistleday/engine";

const SPORT_ICONS: Record<string, string> = {
  volleyball: "🏐",
  "beach-volleyball": "🏐",
  football: "⚽",
  basketball: "🏀",
  tennis: "🎾",
  padel: "🎾",
  "table-tennis": "🏓",
  badminton: "🏸",
  chess: "♟️",
  cornhole: "🎯",
  "beer-pong": "🍺",
  roundnet: "🟡",
  spikeball: "🟡",
};

export async function fetchDisplayMetadata(token: string): Promise<DisplayPayload | null> {
  try {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.WHISTLEDAY_API_URL || "http://127.0.0.1:8090";
    const res = await fetch(`${origin}/api/display/${token}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as DisplayPayload;
  } catch {
    return null;
  }
}

export function displayHeadTags({
  payload,
  token,
  mode,
}: {
  payload?: DisplayPayload | null;
  token: string;
  mode: "phone" | "display";
}) {
  const SITE = "https://whistle.day";
  const tournamentName = payload?.tournament?.name?.trim() || "Tournament";
  const sport = payload?.tournament?.sport || "";
  const teamCount = payload?.entries ? Object.keys(payload.entries).length : 0;
  const courtCount = payload?.courts ? payload.courts.length : 0;
  const icon = (sport && SPORT_ICONS[sport]) || "🏆";
  const sportLabel =
    sport && sport !== "other"
      ? sport.charAt(0).toUpperCase() + sport.slice(1).replace(/-/g, " ")
      : "";

  const isProjector = mode === "display";
  const pageLabel = isProjector ? "Projector View" : "Live Schedule & Bracket";
  const title = `${tournamentName} — ${pageLabel} | Whistle.day`;

  const details = [
    sportLabel ? `${icon} ${sportLabel}` : icon,
    teamCount > 0 ? `${teamCount} teams` : null,
    courtCount > 0 ? `${courtCount} courts` : null,
    isProjector
      ? "Live projector view on Whistle.day"
      : "Live matches, schedule & bracket on Whistle.day",
  ]
    .filter(Boolean)
    .join(" • ");

  const canonicalUrl = `${SITE}/${isProjector ? "display" : "m"}/${token}`;

  return {
    meta: [
      { title },
      { name: "description", content: details },
      { property: "og:site_name", content: "Whistle.day" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl },
      { property: "og:title", content: `${tournamentName} — ${pageLabel}` },
      { property: "og:description", content: details },
      { property: "og:image", content: `${SITE}/og.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${tournamentName} — ${pageLabel}` },
      { name: "twitter:description", content: details },
      { name: "twitter:image", content: `${SITE}/og.png` },
      { name: "robots", content: "noindex" },
    ],
  };
}
