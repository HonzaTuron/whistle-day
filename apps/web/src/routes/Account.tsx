import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { useT, type MessageKey } from "../lib/i18n";
import {
  ApiError,
  claimAccount,
  ensureOrganiser,
  isDeviceAccount,
  myTournaments,
  rememberTournament,
  signIn,
  storedSession,
  type Session,
  type TournamentRecord,
} from "../api/organiser";

type Mode = "claim" | "signin";

/** What a tournament's own state is called on the list of them. */
const STATUS: Record<string, MessageKey> = {
  draft: "status.draft",
  live: "status.live",
  finished: "status.finished",
  archived: "status.archived",
};

export function Account() {
  const t = useT();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(storedSession);
  const [mode, setMode] = useState<Mode>(() =>
    storedSession() ? "claim" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [owned, setOwned] = useState<TournamentRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = useRef<Promise<Session> | null>(null);

  useEffect(() => {
    if (!storedSession()) return;
    active.current ??= ensureOrganiser();
    void active.current
      .then(setSession)
      .catch(() => setError(t("error.unreachable")));
  }, []);

  const claimed = session !== null && !isDeviceAccount(session);
  const canClaim = session !== null && !claimed;

  useEffect(() => {
    if (!session || !claimed) return;
    void myTournaments(session)
      .then(setOwned)
      .catch(() => setOwned([]));
  }, [session, claimed]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next =
        mode === "claim" && session
          ? await claimAccount(session, email.trim(), password)
          : await signIn(email.trim(), password);
      active.current = Promise.resolve(next);
      setSession(next);
      setPassword("");
    } catch (thrown) {
      if (mode === "claim" && thrown instanceof ApiError && thrown.status === 400) {
        setMode("signin");
        setError(t("account.claimRefused"));
      } else {
        setError(thrown instanceof Error ? thrown.message : t("error.notWork"));
      }
    } finally {
      setBusy(false);
    }
  };

  const open = (tournament: TournamentRecord) => {
    rememberTournament({ id: tournament.id, name: tournament.name, token: "" });
    void navigate({ to: "/t/$id", params: { id: tournament.id } });
  };

  return (
    <div className="account">
      {error ? (
        <div className="wiz__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label={t("common.dismiss")}>
            ✕
          </button>
        </div>
      ) : null}

      <header>
        <h1>
          {t(
            claimed
              ? "account.signedIn"
              : canClaim
                ? "account.keepTitle"
                : "account.signInTitle",
          )}
        </h1>
        <p>
          {claimed
            ? t("account.signedInAs", { email: session?.email ?? "" })
            : t(canClaim ? "account.keepBody" : "account.signInBody")}
        </p>
      </header>

      {claimed ? (
        <section className="account__owned">
          {owned === null ? (
            <p className="account__hint">{t("account.looking")}</p>
          ) : owned.length === 0 ? (
            <p className="account__hint">{t("account.noTournaments")}</p>
          ) : (
            <ul>
              {owned.map((tournament) => (
                <li key={tournament.id}>
                  <button type="button" onClick={() => open(tournament)}>
                    <span>{tournament.name}</span>
                    <small>
                      {STATUS[tournament.status]
                        ? t(STATUS[tournament.status]!)
                        : tournament.status}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/" className="btn btn--quiet btn--block">
            {t("common.done")}
          </Link>
        </section>
      ) : (
        <form
          className="account__form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label>
            <span>{t("account.email")}</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            <span>{t("account.password")}</span>
            <input
              type="password"
              name="password"
              autoComplete={mode === "claim" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={busy}
          >
            {t(
              busy
                ? "common.moment"
                : mode === "claim"
                  ? "account.save"
                  : "account.signInTitle",
            )}
          </button>

          {canClaim ? (
            <button
              type="button"
              className="btn btn--quiet btn--block"
              onClick={() => {
                setMode(mode === "claim" ? "signin" : "claim");
                setError(null);
              }}
            >
              {t(
                mode === "claim" ? "account.haveAccount" : "account.keepInstead",
              )}
            </button>
          ) : null}

          {mode === "signin" && canClaim ? (
            <p className="account__warning">{t("account.switchWarning")}</p>
          ) : null}
        </form>
      )}

      <LanguageSwitch className="langswitch--footer" />
    </div>
  );
}
