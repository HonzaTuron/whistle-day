import { useMemo, useState } from "react";
import { useDisplayPayload } from "../../api/display";
import { bracketStages, tablePools } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { renderLabel } from "../../lib/labels";
import { LanguageSwitch } from "../LanguageSwitch";
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
  const t = useT();
  const { payload, error, stale, loading } = useDisplayPayload(token);
  const [tab, setTab] = useState<Tab>("live");

  const tables = useMemo(() => (payload ? tablePools(payload) : []), [payload]);
  const brackets = useMemo(() => (payload ? bracketStages(payload) : []), [payload]);

  if (loading) return <div className="phone phone--message">{t("common.loading")}</div>;
  if (error) return <div className="phone phone--message">{error}</div>;
  if (!payload) return null;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    {
      id: "live",
      label: t("phone.tabLive"),
      badge: payload.now_playing.length || undefined,
    },
    ...(tables.length > 0
      ? [{ id: "tables" as const, label: t("phone.tabGroups") }]
      : []),
    ...(brackets.length > 0
      ? [{ id: "bracket" as const, label: t("phone.tabBracket") }]
      : []),
    { id: "results", label: t("phone.tabResults") },
  ];

  const accent = payload.display.theme?.accent;

  return (
    <div
      className="phone"
      style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined}
    >
      <header className="phone__header">
        <h1>{payload.tournament.name}</h1>
        {stale && <span className="phone__stale">{t("phone.offline")}</span>}
      </header>

      <nav className="phone__tabs">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={entry.id === tab ? "phone__tab is-active" : "phone__tab"}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
            {entry.badge ? (
              <span className="phone__badge">{entry.badge}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <main className="phone__body">
        {tab === "live" && (
          <>
            <Section title={t("panel.now_playing")} empty={t("phone.nothingLive")}>
              {payload.now_playing.length > 0 && (
                <MobileFixtures payload={payload} fixtures={payload.now_playing} live />
              )}
            </Section>

            <Section title={t("panel.next_up")} empty={t("phone.nothingScheduled")}>
              {payload.next_up.length > 0 && (
                <MobileFixtures payload={payload} fixtures={payload.next_up} showTime />
              )}
            </Section>
          </>
        )}

        {tab === "tables" &&
          tables.map(({ stage, pool }) => (
            <Section
              key={pool.id}
              title={t("board.groupNamed", {
                name: renderLabel(t, pool.name, pool.name_kind),
              })}
              subtitle={renderLabel(t, stage.name, stage.name_kind)}
            >
              <MobileTable payload={payload} pool={pool} />
            </Section>
          ))}

        {tab === "bracket" &&
          brackets.map((stage) => (
            <Section
              key={stage.id}
              title={renderLabel(t, stage.name, stage.name_kind)}
            >
              <MobileBracket payload={payload} stage={stage} />
            </Section>
          ))}

        {tab === "results" && (
          <Section title={t("panel.results")} empty={t("phone.noResults")}>
            {payload.recent.length > 0 && (
              <MobileFixtures payload={payload} fixtures={payload.recent} showScore />
            )}
          </Section>
        )}
      </main>

      <footer className="phone__footer">
        <LanguageSwitch />
      </footer>
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
      {/* `||`, not `??`: every caller guards its content with `length > 0 &&`,
          which yields `false` rather than undefined for an empty section — and
          `??` passes `false` straight through, so the message never appeared. */}
      {children || <p className="phone__empty">{empty}</p>}
    </section>
  );
}
