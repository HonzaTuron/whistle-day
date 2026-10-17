import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useT } from "../lib/i18n";
import {
  ApiError,
  createClub,
  ensureOrganiser,
  isDeviceAccount,
  listOnClub,
  loadClubPage,
  myClubs,
  myTournaments,
  storedSession,
  type ClubRecord,
  type Session,
  type TournamentRecord,
} from "../api/organiser";
import { CLUB_SLUG_MAX, clubSlug, isClubSlug } from "../lib/club";
import { WizardShell } from "../components/create/WizardShell";

type Step = "name" | "list" | "done";

/** Whether an address can still be had, as far as the public page can tell. */
type Availability = "short" | "checking" | "free" | "taken" | "unknown";

/** Long enough that a name typed at speed is checked once, not per letter. */
const CHECK_DELAY = 350;

/**
 * Setting up a club page, as its own short flow rather than a form on the
 * account screen.
 *
 * One question that matters — the name — with the address worked out from it
 * and shown as it will be printed, so most people never touch it. The address
 * is checked while it is typed, because finding out it is taken after pressing
 * the button is the one way this goes wrong, and it is the one thing that can
 * never be changed afterwards.
 *
 * The page is made as soon as the name is in, so the address is held while
 * the rest is decided. Then the tournaments to put on it, nothing ticked: being
 * listed is being public, and that stays somebody's deliberate choice. Logo
 * and colour wait for the account screen; a page without them is still a page.
 */
export function ClubSetup() {
  const t = useT();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [owned, setOwned] = useState<TournamentRecord[] | null>(null);
  const [step, setStep] = useState<Step>("name");
  const [club, setClub] = useState<ClubRecord | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Until the address is typed into, it follows the name.
  const [slugTyped, setSlugTyped] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [availability, setAvailability] = useState<Availability>("short");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only an account somebody can sign back into gets a club, and only one:
  // everybody else goes back to the account screen, which explains both.
  useEffect(() => {
    const stored = storedSession();
    if (!stored || isDeviceAccount(stored)) {
      void navigate({ to: "/account", replace: true });
      return;
    }
    let current = true;
    void ensureOrganiser()
      .then(async (next) => {
        if (isDeviceAccount(next)) {
          await navigate({ to: "/account", replace: true });
          return;
        }
        const [clubs, tournaments] = await Promise.all([
          myClubs(next),
          myTournaments(next).catch(() => [] as TournamentRecord[]),
        ]);
        if (!current) return;
        if (clubs.length > 0) {
          await navigate({ to: "/account", replace: true });
          return;
        }
        setSession(next);
        setOwned(tournaments.filter((one) => one.owner === next.userId));
      })
      .catch(() => {
        if (current) setError(t("error.unreachable"));
      });
    return () => {
      current = false;
    };
  }, []);

  const address = slugTyped ? slug : clubSlug(name);

  useEffect(() => {
    if (!isClubSlug(address)) {
      setAvailability("short");
      return;
    }
    setAvailability("checking");
    let current = true;
    const timer = setTimeout(() => {
      void loadClubPage(address)
        .then(() => current && setAvailability("taken"))
        .catch((thrown) => {
          if (!current) return;
          // Not being able to ask is not a reason to stop anybody: the server
          // still refuses a taken address when the page is made.
          setAvailability(
            thrown instanceof ApiError && thrown.status === 404 ? "free" : "unknown",
          );
        });
    }, CHECK_DELAY);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [address]);

  // Taken is only fixable by changing the address, so the field opens itself.
  useEffect(() => {
    if (availability === "taken") setEditingSlug(true);
  }, [availability]);

  const ready =
    session !== null &&
    name.trim().length > 0 &&
    (availability === "free" || availability === "unknown") &&
    !busy;

  const create = async () => {
    if (!ready || !session) return;
    setBusy(true);
    setError(null);
    try {
      const made = await createClub(session, { name: name.trim(), slug: address });
      setClub(made);
      setStep(owned && owned.length > 0 ? "list" : "done");
    } catch (thrown) {
      if (thrown instanceof ApiError && thrown.status === 400) {
        setAvailability("taken");
        setError(t("club.addressRefused"));
      } else {
        setError(thrown instanceof Error ? thrown.message : t("error.notSaved"));
      }
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!session || !club || busy) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all([...picked].map((id) => listOnClub(session, id, club.id)));
      setStep("done");
    } catch {
      setError(t("club.listRefused"));
    } finally {
      setBusy(false);
    }
  };

  const errorBanner = error ? (
    <div className="wiz__error" role="alert">
      <span>{error}</span>
      <button type="button" onClick={() => setError(null)} aria-label={t("common.dismiss")}>
        ✕
      </button>
    </div>
  ) : null;

  if (step === "done" && club) {
    return <ClubReady club={club} />;
  }

  // The list step is a pip only for somebody who has something to list.
  const steps = owned && owned.length > 0 ? ["name", "list"] : ["name"];

  if (step === "list" && club && owned) {
    return (
      <WizardShell
        step="list"
        steps={steps}
        title={t("clubSetup.listTitle")}
        hint={t("club.listHint")}
        footer={
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy}
            onClick={() => void publish()}
          >
            {t(
              busy
                ? "common.moment"
                : picked.size > 0
                  ? "clubSetup.listPublish"
                  : "clubSetup.listSkip",
              { count: picked.size },
            )}
          </button>
        }
      >
        {errorBanner}
        <ul className="clubcard__list clubsetup__list">
          {owned.map((tournament) => (
            <li key={tournament.id}>
              <label>
                <input
                  type="checkbox"
                  checked={picked.has(tournament.id)}
                  disabled={busy}
                  onChange={(event) => {
                    const on = event.target.checked;
                    setPicked((all) => {
                      const next = new Set(all);
                      if (on) next.add(tournament.id);
                      else next.delete(tournament.id);
                      return next;
                    });
                  }}
                />
                <span>{tournament.name}</span>
                {tournament.status === "draft" ? <small>{t("club.listDraft")}</small> : null}
              </label>
            </li>
          ))}
        </ul>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      step="name"
      steps={steps}
      title={t("clubSetup.nameTitle")}
      hint={t("clubSetup.nameHint")}
      onBack={() => void navigate({ to: "/account" })}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={!ready}
          onClick={() => void create()}
        >
          {t(busy ? "common.moment" : "club.create")}
        </button>
      }
    >
      {errorBanner}
      <form
        className="wiz__field"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <input
          name="club"
          className="wiz__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("clubSetup.namePlaceholder")}
          aria-label={t("club.name")}
          maxLength={120}
          autoFocus
          autoComplete="organization"
          enterKeyHint="done"
        />

        <div className="clubsetup__address" aria-live="polite">
          <span className="clubsetup__url">
            whistle.day/c/<strong>{address || "…"}</strong>
          </span>
          <AvailabilityNote state={name.trim() || slugTyped ? availability : null} />
          {!editingSlug ? (
            <button
              type="button"
              className="account__link"
              onClick={() => setEditingSlug(true)}
            >
              {t("clubSetup.changeAddress")}
            </button>
          ) : null}
        </div>

        {editingSlug ? (
          <label className="wiz__sub">
            {t("club.address")}
            <input
              name="slug"
              className="wiz__input wiz__input--sub"
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
        ) : null}
        <p className="wiz__note">{t("club.addressHint")}</p>
        {/* So the keyboard's own "done" submits, as it does in the wizard. */}
        <button type="submit" hidden />
      </form>
    </WizardShell>
  );
}

function AvailabilityNote({ state }: { state: Availability | null }) {
  const t = useT();
  if (state === null || state === "unknown") return null;
  const key = {
    short: "clubSetup.addressShort",
    checking: "clubSetup.addressChecking",
    free: "clubSetup.addressFree",
    taken: "clubSetup.addressTaken",
  } as const;
  return (
    <small className={`clubsetup__status clubsetup__status--${state}`}>{t(key[state])}</small>
  );
}

/** The page exists: its address, and the two things worth doing next. */
function ClubReady({ club }: { club: ClubRecord }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const url = `${typeof window === "undefined" ? "" : window.location.origin}/c/${club.slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Refused on some phones; the address is on screen to read out instead.
    }
  };

  return (
    <div className="done">
      <p className="done__eyebrow">{t("clubSetup.doneEyebrow")}</p>
      <h1 className="done__title">{club.name}</h1>

      <button type="button" className="done__link" onClick={() => void copy()}>
        <span>{url.replace(/^https?:\/\//, "")}</span>
        <small>{t(copied ? "common.copied" : "common.copy")}</small>
      </button>
      <p className="done__note">{t("clubSetup.doneNote")}</p>

      <div className="done__actions">
        <Link to="/c/$slug" params={{ slug: club.slug }} className="btn btn--primary btn--block">
          {t("clubSetup.doneOpen")}
        </Link>
        <Link to="/account" className="btn btn--block">
          {t("clubSetup.doneStyle")}
        </Link>
      </div>
    </div>
  );
}
