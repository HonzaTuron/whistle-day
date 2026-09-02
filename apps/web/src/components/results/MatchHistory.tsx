import type { FixtureEvent } from "@seedly/engine";
import { useEffect, useState } from "react";
import { ensureOrganiser, loadHistory } from "../../api/organiser";
import { timeOfDay } from "../../lib/format";
import { useI18n, type Translate } from "../../lib/i18n";

/**
 * What has already been done to this match.
 *
 * It only appears once there is something to say — a match entered once and
 * left alone shows nothing, because the row above it already says what the
 * score is. The point of the list is the second line: a corrected result, and
 * what it used to be.
 *
 * `crew` turns an actor id into a name. It matters exactly as much as the
 * tournament has people in it: on a one-phone day every row has the same
 * author and saying so is noise, so a name is only drawn when more than one
 * person can write. Names come from the staff row rather than the account,
 * because an account is only visible to itself.
 */
export function MatchHistory({
  fixture,
  crew,
}: {
  fixture: string;
  crew: Map<string, string>;
}) {
  const { t, locale } = useI18n();
  const [events, setEvents] = useState<FixtureEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadHistory(await ensureOrganiser(), fixture);
        if (!cancelled) setEvents(loaded);
      } catch {
        // A missing history is not worth an error on a screen whose job is to
        // enter the next score.
        if (!cancelled) setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fixture]);

  if (!events || events.length === 0) return null;

  return (
    <ol className="history">
      {events.map((event) => (
        <li key={event.id}>
          <span className="history__when">{timeOfDay(locale, event.created)}</span>
          <span className="history__what">
            {describe(t, event)}
            {crew.size > 1 && event.actor && crew.has(event.actor) ? (
              <span className="history__who"> · {crew.get(event.actor)}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

const score = (home: number | null | undefined, away: number | null | undefined) =>
  `${home ?? 0}–${away ?? 0}`;

function describe(t: Translate, event: FixtureEvent): string {
  const now =
    event.status === "walkover"
      ? t("match.walkover")
      : score(event.home_score, event.away_score);

  switch (event.kind) {
    case "recorded":
      return t("history.entered", { score: now });
    case "corrected": {
      const was =
        event.previous?.status === "walkover"
          ? t("match.walkover")
          : score(event.previous?.home_score, event.previous?.away_score);
      return t("history.changed", { was, now });
    }
    case "cleared": {
      const was =
        event.previous?.status === "walkover"
          ? t("history.aWalkover")
          : score(event.previous?.home_score, event.previous?.away_score);
      return t("history.cleared", { was });
    }
  }
}
