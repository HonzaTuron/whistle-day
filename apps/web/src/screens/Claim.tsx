import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { usePreviewHandoff } from "../api/hooks";
import {
  availableProviders,
  startHandoffOAuth,
  type OAuthProvider,
} from "../api/oauth";
import { claimHandoff, rememberTournament } from "../api/organiser";
import { useT } from "../lib/i18n";
import { AccountLegal } from "../components/AccountLegal";
import { GoogleIcon } from "../components/GoogleIcon";

/**
 * Being handed a tournament.
 *
 * Somebody — usually an agent, occasionally the phone that set it up — built a
 * tournament on an account nobody owns, and sent this link. Setting an email
 * and a password here makes that account, and everything it holds, this
 * person's.
 *
 * The screen says what is being accepted before it asks for anything, because
 * the link arrives with no context: it is a URL in a message, and the person
 * opening it has never seen this site. The name comes from a public endpoint
 * that answers with a name and nothing else.
 *
 * There is no "sign in instead". The account being claimed is not one this
 * person has ever had, and signing in as somebody else would leave the
 * tournament exactly where it was — which is the confusion this screen exists
 * to avoid rather than offer.
 */
export function Claim({ token }: { token: string }) {
  const t = useT();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);

  const { data: handoff, isLoading, isError } = usePreviewHandoff(token);

  useEffect(() => {
    void availableProviders().then(setProviders);
  }, []);

  // A handoff is single-use, so a double submit is one success and one "this
  // link is not valid any more" — which would replace the first with an error.
  const inflight = useRef(false);

  const acceptWithProvider = async (provider: OAuthProvider) => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    try {
      // The page is about to be replaced by the provider, so there is
      // nothing to reset on success — only on the request that starts it
      // failing outright, before the browser ever leaves.
      await startHandoffOAuth(token, handoff?.tournament ?? "", provider);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : t("claim.failed"));
      setBusy(false);
      inflight.current = false;
    }
  };

  const accept = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { tournament } = await claimHandoff(token, email.trim(), password);
      rememberTournament({
        id: tournament,
        name: handoff?.tournament ?? "",
        token: "",
      });
      await navigate({ to: "/t/$id", params: { id: tournament } });
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : t("claim.failed"));
      setBusy(false);
      inflight.current = false;
    }
  };

  if (isLoading) {
    return (
      <div className="account">
        <p className="account__hint">{t("common.moment")}</p>
      </div>
    );
  }

  if (isError || !handoff) {
    return (
      <div className="account">
        <header>
          <h1>{t("claim.deadTitle")}</h1>
          <p>{t("claim.deadBody")}</p>
        </header>
      </div>
    );
  }

  return (
    <div className="account">
      {error ? (
        <div className="wiz__error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={t("common.dismiss")}
          >
            ✕
          </button>
        </div>
      ) : null}

      <header>
        <h1>{t("claim.title", { tournament: handoff.tournament })}</h1>
        <p>{t("claim.body")}</p>
      </header>

      <form
        className="account__form"
        onSubmit={(event) => {
          event.preventDefault();
          void accept();
        }}
      >
        {providers.length > 0 ? (
          <div className="account__providers">
            {providers.map((provider) => (
              <button
                key={provider.name}
                type="button"
                className="btn btn--quiet btn--block"
                disabled={busy}
                onClick={() => void acceptWithProvider(provider)}
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
            autoComplete="new-password"
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
          {t(busy ? "common.moment" : "claim.accept")}
        </button>

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

        <p className="account__hint">{t("claim.once")}</p>
      </form>

      <AccountLegal />
    </div>
  );
}
