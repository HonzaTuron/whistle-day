import { useMemo, useState } from "react";
import { useDisplayPayload } from "../../api/display";
import { bracketStages, tablePools } from "../../lib/format";
import { MobileBracket } from "./MobileBracket";
import { MobileFixtures } from "./MobileFixtures";
import { MobileTable } from "./MobileTable";

type Tab = "live" | "tables" | "bracket" | "results";

/**
 * The phone view is a separate route from the projector on purpose.
 *
 * A projector is unattended, rotates itself, and is read from across a hall. A
 * phone is held by someone looking for one specific thing — usually "when do we
 * play next". Sharing a layout between the two would compromise both, so they
 * share only the data hook and the formatting helpers.
 */
export function MobileScreen({ token }: { token: string }) {
  const { payload, error, stale, loading } = useDisplayPayload(token);
  const [tab, setTab] = useState<Tab>("live");

  const tables = useMemo(() => (payload ? tablePools(payload) : []), [payload]);
  const brackets = useMemo(() => (payload ? bracketStages(payload) : []), [payload]);

  if (loading) return <div className="phone phone--message">Loading…</div>;
  if (error) return <div className="phone phone--message">{error}</div>;
  if (!payload) return null;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "live", label: "Live", badge: payload.now_playing.length || undefined },
    ...(tables.length > 0 ? [{ id: "tables" as const, label: "Groups" }] : []),
    ...(brackets.length > 0 ? [{ id: "bracket" as const, label: "Bracket" }] : []),
    { id: "results", label: "Results" },
  ];

  const accent = payload.display.theme?.accent;

  return (
    <div
      className="phone"
      style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined}
    >
      <header className="phone__header">
        <h1>{payload.tournament.name}</h1>
        {stale && <span className="phone__stale">offline</span>}
      </header>

      <nav className="phone__tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? "phone__tab is-active" : "phone__tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge ? <span className="phone__badge">{t.badge}</span> : null}
          </button>
        ))}
      </nav>

      <main className="phone__body">
        {tab === "live" && (
          <>
            <Section title="Now playing" empty="Nothing is being played right now.">
              {payload.now_playing.length > 0 && (
                <MobileFixtures payload={payload} fixtures={payload.now_playing} live />
              )}
            </Section>

            <Section title="Next up" empty="No matches scheduled.">
              {payload.next_up.length > 0 && (
                <MobileFixtures payload={payload} fixtures={payload.next_up} showTime />
              )}
            </Section>
          </>
        )}

        {tab === "tables" &&
          tables.map(({ stage, pool }) => (
            <Section key={pool.id} title={`Group ${pool.name}`} subtitle={stage.name}>
              <MobileTable payload={payload} pool={pool} />
            </Section>
          ))}

        {tab === "bracket" &&
          brackets.map((stage) => (
            <Section key={stage.id} title={stage.name}>
              <MobileBracket payload={payload} stage={stage} />
            </Section>
          ))}

        {tab === "results" && (
          <Section title="Latest results" empty="No results yet.">
            {payload.recent.length > 0 && (
              <MobileFixtures payload={payload} fixtures={payload.recent} showScore />
            )}
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  subtitle,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  empty?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="phone__section">
      <h2>
        {title}
        {subtitle && <small>{subtitle}</small>}
      </h2>
      {children ?? <p className="phone__empty">{empty}</p>}
    </section>
  );
}
