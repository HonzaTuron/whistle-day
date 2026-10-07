import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useT } from "../lib/i18n";
import {
  ApiError,
  clubLogoUrl,
  createClub,
  listOnClub,
  myClubs,
  updateClub,
  type ClubRecord,
  type Session,
  type TournamentRecord,
} from "../api/organiser";
import { CLUB_SLUG_MAX, clubSlug, isClubSlug } from "../lib/club";

interface Props {
  session: Session;
  /** Everything this account can run. Only the ones it owns can be listed. */
  tournaments: TournamentRecord[];
  /** A tournament was put on the page or taken off it. */
  onListed: (tournament: TournamentRecord) => void;
}

const LOGO_TYPES = "image/png,image/jpeg,image/svg+xml,image/webp";

/** What the swatch opens on before a club has picked a colour of its own. */
const APP_ACCENT = "#15803d";

/**
 * The club this account runs its tournaments as, on the account screen.
 *
 * Two states and nothing between them. With no club there is a name and an
 * address to choose; with one there is what the page looks like and which
 * tournaments are on it. The address is asked for once and not offered again:
 * it is the thing that ends up on a poster, and a field that invites editing
 * it is a field that breaks every link already handed out.
 *
 * Listing is per tournament and starts empty. The page is public and carries
 * a way in to each board on it, so a tournament gets there because somebody
 * ticked it, never because it happened to be made by an account with a club.
 */
export function ClubCard({ session, tournaments, onListed }: Props) {
  const t = useT();
  const [club, setClub] = useState<ClubRecord | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [accent, setAccent] = useState("");
  const [slug, setSlug] = useState("");
  // Until the address is typed into, it follows the name.
  const [slugTyped, setSlugTyped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void myClubs(session)
      .then((clubs) => {
        if (!current) return;
        const first = clubs[0] ?? null;
        setClub(first);
        if (first) {
          setName(first.name);
          setAccent(first.accent);
        }
      })
      .catch(() => {
        if (current) setClub(null);
      });
    return () => {
      current = false;
    };
  }, [session.userId]);

  /** Run one write, and say so if it was refused. */
  const attempt = async (write: () => Promise<void>, refused: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await write();
    } catch (thrown) {
      // A refusal has a reason worth a sentence of ours; anything else is the
      // network, and the server's own words are as good as any.
      setError(
        thrown instanceof ApiError && (thrown.status === 400 || thrown.status === 403)
          ? refused
          : thrown instanceof Error
            ? thrown.message
            : t("error.notSaved"),
      );
    } finally {
      setBusy(false);
    }
  };

  if (club === undefined) return null;

  if (club === null) {
    const address = slugTyped ? slug : clubSlug(name);
    const ready = name.trim().length > 0 && isClubSlug(address) && !busy;

    return (
      <section className="clubcard">
        <h2>{t("club.title")}</h2>
        <p className="account__hint">{t("club.intro")}</p>

        <form
          className="account__form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            void attempt(async () => {
              setClub(await createClub(session, { name: name.trim(), slug: address }));
            }, t("club.addressRefused"));
          }}
        >
          <label>
            <span>{t("club.name")}</span>
            <input
              name="club"
              value={name}
              maxLength={120}
              autoComplete="organization"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <span>{t("club.address")}</span>
            <input
              name="slug"
              value={address}
              maxLength={CLUB_SLUG_MAX}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => {
                setSlugTyped(true);
                setSlug(event.target.value.toLowerCase());
              }}
            />
          </label>
          <p className="account__hint">
            {t("club.addressHint", { address: `whistle.day/c/${address || "…"}` })}
          </p>
          {error ? (
            <p className="account__warning" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn--quiet btn--block" disabled={!ready}>
            {t(busy ? "common.moment" : "club.create")}
          </button>
        </form>
      </section>
    );
  }

  const logo = clubLogoUrl(club);
  const mine = tournaments.filter((tournament) => tournament.owner === session.userId);
  const renamed = name.trim().length > 0 && name.trim() !== club.name;
  const changed = renamed || accent !== club.accent;

  const save = (patch: Parameters<typeof updateClub>[2]) =>
    attempt(async () => {
      setClub(await updateClub(session, club.id, patch));
    }, t("error.notSaved"));

  return (
    <section className="clubcard">
      <h2>{t("club.title")}</h2>

      <div className="clubcard__head">
        <label className="sponsor__logo">
          {logo ? (
            <img src={logo} alt="" />
          ) : (
            <span className="sponsor__logo-empty" aria-hidden="true">
              {club.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <input
            type="file"
            accept={LOGO_TYPES}
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void save({ logo: file });
              event.target.value = "";
            }}
            aria-label={t("club.changeLogo")}
          />
        </label>
        <div className="clubcard__who">
          <strong>{club.name}</strong>
          <Link to="/c/$slug" params={{ slug: club.slug }} className="account__link">
            whistle.day/c/{club.slug}
          </Link>
        </div>
      </div>

      <form
        className="account__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) void save({ name: name.trim() || club.name, accent });
        }}
      >
        <label>
          <span>{t("club.name")}</span>
          <input
            name="club"
            value={name}
            maxLength={120}
            autoComplete="organization"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {/*
          Saved with the button rather than as it changes: a colour picker
          reports every pixel of a drag, and each one would be a write.
        */}
        <div className="clubcard__colour">
          <span>{t("club.colour")}</span>
          <input
            type="color"
            value={accent || APP_ACCENT}
            aria-label={t("club.colour")}
            onChange={(event) => setAccent(event.target.value)}
          />
          {accent ? (
            <button type="button" className="account__link" onClick={() => setAccent("")}>
              {t("club.colourReset")}
            </button>
          ) : null}
        </div>
        {changed ? (
          <button type="submit" className="btn btn--quiet btn--block" disabled={busy}>
            {t(busy ? "common.moment" : "club.save")}
          </button>
        ) : null}
      </form>

      <h3>{t("club.listTitle")}</h3>
      <p className="account__hint">{t("club.listHint")}</p>
      {mine.length === 0 ? (
        <p className="account__hint">{t("club.listEmpty")}</p>
      ) : (
        <ul className="clubcard__list">
          {mine.map((tournament) => (
            <li key={tournament.id}>
              <label>
                <input
                  type="checkbox"
                  checked={tournament.club === club.id}
                  disabled={busy}
                  onChange={(event) => {
                    const listed = event.target.checked;
                    void attempt(async () => {
                      onListed(
                        await listOnClub(session, tournament.id, listed ? club.id : null),
                      );
                    }, t("club.listRefused"));
                  }}
                />
                <span>{tournament.name}</span>
                {tournament.status === "draft" ? (
                  <small>{t("club.listDraft")}</small>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="account__warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
