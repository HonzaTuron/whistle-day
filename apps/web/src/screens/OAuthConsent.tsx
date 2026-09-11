import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { usePreviewConsent } from "../api/hooks";
import { submitConsent } from "../api/connect";
import { isDeviceAccount, storedSession } from "../api/organiser";
import { useT } from "../lib/i18n";
import { AccountLegal } from "../components/AccountLegal";

/**
 * An AI agent asking to connect to a signed-in account.
 *
 * The far end of `GET /oauth/authorize` (backend/internal/oauth): an agent —
 * Claude, ChatGPT, anything speaking MCP — wants to act as whoever signs in
 * here, so their existing tournaments become reachable instead of the agent
 * always starting a fresh anonymous one. See mcp/auth.go for what a
 * completed connection then lets it do.
 *
 * No sign-up path, unlike Claim: only somebody who already has a claimed
 * account can approve this, since the whole point is connecting an agent to
 * an *existing* one. A device account or nobody at all is sent to sign in
 * first, back here.
 */
export function OAuthConsent({ requestId }: { requestId: string }) {
  const t = useT();
  const [decided, setDecided] = useState<"approve" | "deny" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = storedSession();

  const { data: request, isLoading, isError } = usePreviewConsent(requestId);

  // Approve and deny both redirect the browser away; a double click should
  // not fire the request twice while the first is still in flight.
  const inflight = useRef(false);

  const decide = async (approve: boolean) => {
    if (inflight.current || !session) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { redirect } = await submitConsent(session, requestId, approve);
      setDecided(approve ? "approve" : "deny");
      window.location.assign(redirect);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : t("connect.failed"));
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

  if (isError || !request) {
    return (
      <div className="account">
        <header>
          <h1>{t("connect.deadTitle")}</h1>
          <p>{t("connect.deadBody")}</p>
        </header>
      </div>
    );
  }

  if (decided === "deny") {
    return (
      <div className="account">
        <header>
          <h1>{t("connect.denied")}</h1>
        </header>
      </div>
    );
  }

  const signedIn = session !== null && !isDeviceAccount(session);

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
        <h1>{t("connect.title", { client: request.client_name || t("connect.unnamedClient") })}</h1>
        <p>{t("connect.body")}</p>
      </header>

      {!signedIn ? (
        <section className="account__owned">
          <p className="account__hint">{t("connect.signInPrompt")}</p>
          <Link
            to="/account"
            search={{ next: `/oauth/consent?request=${requestId}` }}
            className="btn btn--primary btn--block"
          >
            {t("connect.signInLink")}
          </Link>
        </section>
      ) : (
        <div className="account__actions">
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy}
            onClick={() => void decide(true)}
          >
            {t(busy ? "common.moment" : "connect.approve")}
          </button>
          <button
            type="button"
            className="btn btn--quiet btn--block"
            disabled={busy}
            onClick={() => void decide(false)}
          >
            {t("connect.deny")}
          </button>
        </div>
      )}

      <AccountLegal />
    </div>
  );
}
