import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { confirmPasswordReset } from "../api/recovery";
import { useT } from "../lib/i18n";
import { AccountLegal } from "../components/AccountLegal";

/**
 * The far end of a "reset your password" link.
 *
 * The token in the URL is the whole credential; PocketBase checks it and, if
 * it is still good, sets the new password. There is no address in the token
 * and the confirm call hands nothing back, so this cannot sign anybody in —
 * it points them at `/account` to do that with what they just chose.
 */
export function ResetPassword({ token }: { token: string }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"form" | "done" | "dead">("form");
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  const submit = async () => {
    if (inflight.current) return;
    if (password !== confirm) {
      setError(t("recover.mismatch"));
      return;
    }
    inflight.current = true;
    setError(null);
    try {
      await confirmPasswordReset(token, password);
      setState("done");
    } catch {
      // A reset token is single-use and short-lived; a failure here is almost
      // always one that has been spent or has expired rather than a fault.
      setState("dead");
    } finally {
      inflight.current = false;
    }
  };

  if (state === "done") {
    return (
      <div className="account">
        <header>
          <h1>{t("recover.doneTitle")}</h1>
          <p>{t("recover.doneBody")}</p>
        </header>
        <Link to="/account" className="btn btn--primary btn--block">
          {t("recover.toSignIn")}
        </Link>
        <AccountLegal />
      </div>
    );
  }

  if (state === "dead") {
    return (
      <div className="account">
        <header>
          <h1>{t("recover.deadTitle")}</h1>
          <p>{t("recover.deadBody")}</p>
        </header>
        <Link to="/account" className="btn btn--primary btn--block">
          {t("recover.tryAgain")}
        </Link>
        <AccountLegal />
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
        <h1>{t("recover.resetTitle")}</h1>
        <p>{t("recover.resetBody")}</p>
      </header>

      <form
        className="account__form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label>
          <span>{t("recover.newPassword")}</span>
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

        <label>
          <span>{t("recover.confirmPassword")}</span>
          <input
            type="password"
            name="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            minLength={8}
            required
          />
        </label>

        <button type="submit" className="btn btn--primary btn--block">
          {t("recover.setPassword")}
        </button>
      </form>

      <AccountLegal />
    </div>
  );
}
