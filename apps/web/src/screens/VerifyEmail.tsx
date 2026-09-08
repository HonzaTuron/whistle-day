import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { confirmVerification } from "../api/recovery";
import { useT } from "../lib/i18n";

/**
 * The far end of a "confirm your email" link.
 *
 * Nothing to fill in: the token in the URL is the confirmation, so this spends
 * it on mount and says how it went. A spent or expired token lands on the
 * "request another" copy rather than an error — by the time somebody clicks a
 * link they last saw days ago, that is the likely reason.
 */
export function VerifyEmail({ token }: { token: string }) {
  const t = useT();
  const [state, setState] = useState<"working" | "done" | "dead">("working");
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    confirmVerification(token)
      .then(() => setState("done"))
      .catch(() => setState("dead"));
  }, [token]);

  if (state === "working") {
    return (
      <div className="account">
        <p className="account__hint">{t("common.moment")}</p>
      </div>
    );
  }

  return (
    <div className="account">
      <header>
        <h1>{t(state === "done" ? "verify.doneTitle" : "verify.deadTitle")}</h1>
        <p>{t(state === "done" ? "verify.doneBody" : "verify.deadBody")}</p>
      </header>
      <Link to="/account" className="btn btn--primary btn--block">
        {t("verify.toAccount")}
      </Link>
    </div>
  );
}
