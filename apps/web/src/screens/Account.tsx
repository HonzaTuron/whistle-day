import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useT, type MessageKey } from "../lib/i18n";
import {
  ApiError,
  claimAccount,
  deleteAccount,
  ensureOrganiser,
  isDeviceAccount,
  myTournaments,
  rememberTournament,
  signIn,
  signOut,
  storedSession,
  type Session,
  type TournamentRecord,
} from "../api/organiser";
import {
  availableProviders,
  completeOAuth,
  isOAuthReturn,
  startOAuth,
  type OAuthProvider,
} from "../api/oauth";
import { requestPasswordReset, resendVerification } from "../api/recovery";
import { AccountLegal } from "../components/AccountLegal";

type Mode = "claim" | "signin" | "forgot";

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
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [returning] = useState(isOAuthReturn);
  const [sentReset, setSentReset] = useState(false);
  const [resent, setResent] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const active = useRef<Promise<Session> | null>(null);

  useEffect(() => {
    if (!storedSession()) return;
    active.current ??= ensureOrganiser();
    void active.current
      .then(setSession)
      .catch(() => setError(t("error.unreachable")));
  }, []);

  useEffect(() => {
    void availableProviders().then(setProviders);
  }, []);

  /**
   * Coming back from Google or Facebook.
   *
   * It waits for the stored session to have been read, because handing that
   * session to `completeOAuth` is the difference between claiming this
   * device's account and quietly starting a new one beside it — see the note
   * in `api/oauth.ts`. `storedSession()` rather than `session` so a device
   * that has one but has not finished revalidating it is not treated as a
   * device that has none.
   */
  useEffect(() => {
    if (!returning) return;
    if (storedSession() && !session) return;

    setBusy(true);
    void completeOAuth(session)
      .then((next) => {
        active.current = Promise.resolve(next);
        setSession(next);
      })
      .catch(() => setError(t("account.oauthFailed")))
      .finally(() => setBusy(false));
  }, [returning, session]);

  const claimed = session !== null && !isDeviceAccount(session);
  const canClaim = session !== null && !claimed;
  const needsVerify = claimed && session?.verified === false;

  const heading = deleted
    ? "account.deleteTitle"
    : claimed
      ? "account.signedIn"
      : mode === "forgot"
        ? "recover.forgotTitle"
        : canClaim
          ? "account.keepTitle"
          : "account.signInTitle";

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

  const sendReset = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      // Shown whether or not the address has an account: which it is is not
      // this form's to give away.
      setSentReset(true);
    } catch {
      setError(t("recover.sendFailed"));
    } finally {
      setBusy(false);
    }
  };

  const resendVerify = async () => {
    if (busy || !session) return;
    setBusy(true);
    try {
      await resendVerification(session.email);
      setResent(true);
    } catch {
      setError(t("recover.sendFailed"));
    } finally {
      setBusy(false);
    }
  };

  const open = (tournament: TournamentRecord) => {
    rememberTournament({ id: tournament.id, name: tournament.name, token: "" });
    void navigate({ to: "/t/$id", params: { id: tournament.id } });
  };

  const onSignOut = () => {
    signOut();
    setSession(null);
    setOwned(null);
    setMode("signin");
  };

  const onDelete = async () => {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(session);
      setSession(null);
      setOwned(null);
      setConfirmingDelete(false);
      setDeleted(true);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : t("error.notSaved"));
    } finally {
      setBusy(false);
    }
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
        <h1>{t(heading)}</h1>
        <p>
          {deleted
            ? t("account.deleted")
            : claimed
              ? t("account.signedInAs", { email: session?.email ?? "" })
              : mode === "forgot"
                ? t("recover.forgotBody")
                : t(canClaim ? "account.keepBody" : "account.signInBody")}
        </p>
      </header>

      {deleted ? (
        <section className="account__owned">
          <Link to="/" className="btn btn--primary btn--block">
            {t("common.done")}
          </Link>
        </section>
      ) : claimed ? (
        <section className="account__owned">
          {needsVerify ? (
            <p className="account__warning">
              {resent ? t("recover.verifyResent") : t("recover.verifyNudge")}{" "}
              {!resent ? (
                <button
                  type="button"
                  className="account__link"
                  disabled={busy}
                  onClick={() => void resendVerify()}
                >
                  {t("recover.resend")}
                </button>
              ) : null}
            </p>
          ) : null}
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
          {confirmingDelete ? (
            <div className="account__danger-card" role="alert">
              <h3>{t("account.deleteConfirmTitle")}</h3>
              <p>
                {t("account.deleteConfirmPrompt", {
                  count: owned?.length ?? 0,
                })}
              </p>
              <div className="account__danger-actions">
                <button
                  type="button"
                  className="btn btn--danger btn--block"
                  disabled={busy}
                  onClick={() => void onDelete()}
                >
                  {t(busy ? "common.moment" : "account.deleteConfirmButton")}
                </button>
                <button
                  type="button"
                  className="btn btn--quiet btn--block"
                  disabled={busy}
                  onClick={() => setConfirmingDelete(false)}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="account__actions">
              <Link to="/" className="btn btn--primary btn--block">
                {t("common.done")}
              </Link>
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={onSignOut}
              >
                {t("account.signOut")}
              </button>
              <button
                type="button"
                className="account__link account__link--center"
                onClick={() => setConfirmingDelete(true)}
              >
                {t("account.deleteButton")}
              </button>
            </div>
          )}
        </section>
      ) : mode === "forgot" ? (
        sentReset ? (
          <section className="account__owned">
            <p className="account__hint">{t("recover.sent")}</p>
            <button
              type="button"
              className="btn btn--quiet btn--block"
              onClick={() => {
                setMode("signin");
                setSentReset(false);
              }}
            >
              {t("recover.backToSignIn")}
            </button>
          </section>
        ) : (
          <form
            className="account__form"
            onSubmit={(event) => {
              event.preventDefault();
              void sendReset();
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

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={busy}
            >
              {t(busy ? "common.moment" : "recover.sendLink")}
            </button>

            <button
              type="button"
              className="btn btn--quiet btn--block"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
            >
              {t("recover.backToSignIn")}
            </button>
          </form>
        )
      ) : (
        <form
          className="account__form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {/*
            Above the form, because it is the shorter way through and the one
            most people will take. Whichever mode the form is in, this button
            does the same thing — keep this device's tournament if there is one
            to keep, sign in if there is not — so it is not repeated per mode.
          */}
          {providers.length > 0 ? (
            <div className="account__providers">
              {providers.map((provider) => (
                <button
                  key={provider.name}
                  type="button"
                  className="btn btn--quiet btn--block"
                  disabled={busy}
                  onClick={() => startOAuth(provider)}
                >
                  {t("account.continueWith", {
                    provider: provider.displayName || provider.name,
                  })}
                </button>
              ))}
              <p className="account__or">{t("account.or")}</p>
            </div>
          ) : null}

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

          {mode === "claim" ? (
            <p className="account__agreement">
              {t("account.termsNotice")}{" "}
              <Link to="/$" params={{ _splat: "terms" }}>
                {t("account.termsOfService")}
              </Link>{" "}
              {t("account.and")}{" "}
              <Link to="/$" params={{ _splat: "privacy" }}>
                {t("account.privacyPolicy")}
              </Link>
              .
            </p>
          ) : null}

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

          {mode === "signin" ? (
            <button
              type="button"
              className="account__link account__link--center"
              onClick={() => {
                setMode("forgot");
                setError(null);
                setSentReset(false);
              }}
            >
              {t("recover.forgotLink")}
            </button>
          ) : null}
        </form>
      )}

      <AccountLegal />
    </div>
  );
}
