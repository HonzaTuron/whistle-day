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
  rememberedTournament,
  rememberTournament,
  signIn,
  signOut,
  storedSession,
  type Session,
  type TournamentRecord,
} from "../api/organiser";
import {
  availableProviders,
  completeHandoffOAuth,
  completeOAuth,
  isOAuthReturn,
  pendingHandoff,
  startOAuth,
  type OAuthProvider,
} from "../api/oauth";
import { requestPasswordReset, resendVerification } from "../api/recovery";
import { AccountLegal } from "../components/AccountLegal";
import { GoogleIcon } from "../components/GoogleIcon";
import { SiteNav } from "../components/marketing/SiteNav";

type Mode = "claim" | "signin" | "forgot";

/** What a tournament's own state is called on the list of them. */
const STATUS: Record<string, MessageKey> = {
  draft: "status.draft",
  live: "status.live",
  finished: "status.finished",
  archived: "status.archived",
};

export function Account({ next }: { next?: string } = {}) {
  const t = useT();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(storedSession);
  const [running] = useState(rememberedTournament);
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
  const [handoff] = useState(pendingHandoff);
  // Starts false on every render, server or client, so hydration never has
  // to reconcile two different trees for the same markup: `handoff` itself
  // reads sessionStorage, which is empty on the server, so branching the
  // JSX on it directly would render one thing there and — the moment this
  // is genuinely a handoff return — another on the client. This only flips
  // once the effect below has actually started completing one.
  const [completingHandoff, setCompletingHandoff] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
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
   * Coming back from Google or Facebook by way of a handoff link instead of
   * this device's own account — see the note atop `completeHandoffOAuth` in
   * `api/oauth.ts` for why that runs on its own client rather than this
   * screen's session. Checked ahead of the ordinary return below, and that
   * one is skipped entirely when this is what brought the browser back:
   * the two are never the same request.
   */
  useEffect(() => {
    if (!returning || !handoff) return;
    setCompletingHandoff(true);
    setBusy(true);
    void completeHandoffOAuth()
      .then(({ tournament }) => {
        rememberTournament({ id: tournament, name: handoff.tournamentName, token: "" });
        return navigate({ to: "/t/$id", params: { id: tournament } });
      })
      .catch(() => {
        setHandoffError(t("account.oauthFailed"));
        setCompletingHandoff(false);
        setBusy(false);
      });
  }, [returning, handoff]);

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
    if (!returning || handoff) return;
    if (storedSession() && !session) return;

    setBusy(true);
    void completeOAuth(session)
      .then((next) => {
        active.current = Promise.resolve(next);
        setSession(next);
      })
      .catch(() => setError(t("account.oauthFailed")))
      .finally(() => setBusy(false));
  }, [returning, handoff, session]);

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
      const nextSession =
        mode === "claim" && session
          ? await claimAccount(session, email.trim(), password)
          : await signIn(email.trim(), password);
      active.current = Promise.resolve(nextSession);
      setSession(nextSession);
      setPassword("");
      // Sent here to sign in before approving something — the consent
      // screen at `next` picks up from a claimed account exactly where this
      // one leaves off.
      if (next && !isDeviceAccount(nextSession)) {
        window.location.assign(next);
        return;
      }
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

  if (completingHandoff && !handoffError) {
    return (
      <>
        <SiteNav />
        <div className="account">
          <header>
            <h1>{t("claim.finishing")}</h1>
            <p>{t("common.moment")}</p>
          </header>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <div className="account">
      {handoffError ? (
        <div className="wiz__error" role="alert">
          <span>{handoffError}</span>
          <button
            type="button"
            onClick={() => setHandoffError(null)}
            aria-label={t("common.dismiss")}
          >
            ✕
          </button>
        </div>
      ) : null}
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
                : canClaim
                  ? running
                    ? t("account.keepBodyNamed", { name: running.name })
                    : t("account.keepBody")
                  : t("account.signInBody")}
        </p>
        {canClaim && running ? (
          <Link
            to="/t/$id"
            params={{ id: running.id }}
            className="account__link account__link--center"
          >
            {t("landing.resume", { name: running.name })}
          </Link>
        ) : null}
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
                  {provider.name === "google" ? (
                    <GoogleIcon className="account__provider-icon" />
                  ) : null}
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
    </>
  );
}
