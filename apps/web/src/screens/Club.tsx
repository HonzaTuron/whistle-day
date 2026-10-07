import { Link } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { useI18n } from "../lib/i18n";
import { ApiError, loadClubPage, type ClubPage, type ClubPageTournament } from "../api/organiser";
import { splitByStatus } from "../lib/club";
import { SiteNav } from "../components/marketing/SiteNav";

/**
 * A club's public page: who they are, and the days they have run.
 *
 * Read-only and the same for whoever asks, so it holds no session and makes
 * no account. Each tournament links to the phone view of one of its screens,
 * which is the public way in a tournament already has; one with no screen
 * switched on is named and not linked, because there is nowhere to send
 * anybody.
 *
 * The club's colour is drawn as a rule and a ring, never as text. A club picks
 * it for a poster, not for contrast against this page, and pale yellow type
 * on white is a name nobody can read.
 */
export function Club({ slug }: { slug: string }) {
  const { t, locale } = useI18n();
  const [page, setPage] = useState<ClubPage | null>(null);
  const [failure, setFailure] = useState<"missing" | "unreachable" | null>(null);

  useEffect(() => {
    let current = true;
    setPage(null);
    setFailure(null);
    void loadClubPage(slug)
      .then((loaded) => {
        if (current) setPage(loaded);
      })
      .catch((thrown) => {
        if (!current) return;
        setFailure(
          thrown instanceof ApiError && thrown.status === 404 ? "missing" : "unreachable",
        );
      });
    return () => {
      current = false;
    };
  }, [slug]);

  if (failure) {
    return (
      <>
        <SiteNav />
        <div className="club">
          <header className="club__head">
            <h1>{t(failure === "missing" ? "club.missing" : "error.unreachable")}</h1>
            {failure === "missing" ? <p>{t("club.missingBody")}</p> : null}
          </header>
        </div>
      </>
    );
  }

  if (!page) {
    return (
      <>
        <SiteNav />
        <div className="club">
          <p className="account__hint">{t("account.looking")}</p>
        </div>
      </>
    );
  }

  const { club, tournaments } = page;
  const { current, past } = splitByStatus(tournaments);
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const row = (tournament: ClubPageTournament) => {
    const date = new Date(tournament.date);
    const body = (
      <>
        <span className="club__name">{tournament.name}</span>
        <small>
          {[tournament.location, Number.isNaN(date.getTime()) ? "" : day.format(date)]
            .filter(Boolean)
            .join(" · ")}
        </small>
        {tournament.status === "live" ? (
          <em className="club__live">{t("status.live")}</em>
        ) : null}
      </>
    );
    return (
      <li key={tournament.id}>
        {tournament.screen ? (
          <Link to="/m/$token" params={{ token: tournament.screen }} className="club__row">
            {body}
          </Link>
        ) : (
          <div className="club__row">{body}</div>
        )}
      </li>
    );
  };

  return (
    <>
      <SiteNav />
      <div
        className="club"
        style={club.accent ? ({ "--club-accent": club.accent } as CSSProperties) : undefined}
      >
        <header className="club__head">
          {club.logo ? <img src={club.logo} alt="" className="club__logo" /> : null}
          <h1>{club.name}</h1>
        </header>

        {tournaments.length === 0 ? (
          <p className="account__hint">{t("club.empty")}</p>
        ) : null}

        {current.length > 0 ? (
          <section>
            <h2>{t("club.current")}</h2>
            <ul>{current.map(row)}</ul>
          </section>
        ) : null}

        {past.length > 0 ? (
          <section>
            <h2>{t("club.past")}</h2>
            <ul>{past.map(row)}</ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
