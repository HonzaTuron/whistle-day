import { useEffect, useMemo, useState } from "react";
import { useDisplayPayload } from "../../api/display";
import { bracketStages, tablePools } from "../../lib/format";
import { BracketPanel } from "./BracketPanel";
import { FixtureListPanel } from "./FixtureListPanel";
import { NowPlayingPanel } from "./NowPlayingPanel";
import { StandingsPanel } from "./StandingsPanel";
import { buildPanels } from "./panels";

const DEFAULT_ROTATE_SECONDS = 15;

export function ProjectorScreen({ token }: { token: string }) {
  const { payload, error, stale, loading } = useDisplayPayload(token);
  const [index, setIndex] = useState(0);
  const [clock, setClock] = useState(() => new Date());

  const panels = useMemo(() => (payload ? buildPanels(payload) : []), [payload]);

  useEffect(() => {
    const tick = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const rotateSeconds = payload?.display.rotate_seconds || DEFAULT_ROTATE_SECONDS;

  useEffect(() => {
    if (panels.length < 2) return;
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % panels.length),
      rotateSeconds * 1000,
    );
    return () => clearTimeout(timer);
  }, [index, panels.length, rotateSeconds]);

  // The panel list shrinks when a match ends; do not point past the end.
  useEffect(() => {
    if (index >= panels.length && panels.length > 0) setIndex(0);
  }, [index, panels.length]);

  if (loading) {
    return <div className="screen screen--message">Connecting…</div>;
  }
  if (error) {
    return <div className="screen screen--message">{error}</div>;
  }
  if (!payload || panels.length === 0) {
    return (
      <div className="screen screen--message">
        {payload?.tournament.name ?? "Seedly"} — nothing to show yet
      </div>
    );
  }

  const panel = panels[Math.min(index, panels.length - 1)];
  const accent = payload.display.theme?.accent;

  return (
    <div
      className="screen"
      style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined}
    >
      <header className="screen__header">
        <div className="screen__brand">
          <span className="screen__tournament">{payload.tournament.name}</span>
          {payload.tournament.location && (
            <span className="screen__location">{payload.tournament.location}</span>
          )}
        </div>

        <div className="screen__title">
          <span>{panel.title}</span>
          {panel.subtitle && <small>{panel.subtitle}</small>}
        </div>

        <div className="screen__meta">
          {stale && <span className="screen__stale">reconnecting</span>}
          <span className="screen__clock">
            {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </header>

      <main className="screen__body" key={`${panel.kind}-${panel.index}`}>
        <PanelBody payload={payload} panel={panel} />
      </main>

      {panels.length > 1 && (
        <footer className="screen__dots" aria-hidden>
          {panels.map((p, i) => (
            <span
              key={`${p.kind}-${p.index}`}
              className={i === index ? "dot dot--on" : "dot"}
              style={
                i === index
                  ? ({ "--rotate": `${rotateSeconds}s` } as React.CSSProperties)
                  : undefined
              }
            />
          ))}
        </footer>
      )}
    </div>
  );
}

function PanelBody({
  payload,
  panel,
}: {
  payload: ReturnType<typeof useDisplayPayload>["payload"] & object;
  panel: ReturnType<typeof buildPanels>[number];
}) {
  switch (panel.kind) {
    case "now_playing":
      return <NowPlayingPanel payload={payload} />;
    case "standings": {
      const entry = tablePools(payload)[panel.index];
      return entry ? <StandingsPanel payload={payload} pool={entry.pool} /> : null;
    }
    case "bracket": {
      const stage = bracketStages(payload)[panel.index];
      return stage ? <BracketPanel payload={payload} stage={stage} /> : null;
    }
    case "next_up":
      return (
        <FixtureListPanel payload={payload} fixtures={payload.next_up} showTime />
      );
    case "results":
      return (
        <FixtureListPanel payload={payload} fixtures={payload.recent} showScore />
      );
  }
}
