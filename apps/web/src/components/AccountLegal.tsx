import { Link } from "@tanstack/react-router";
import { useT } from "../lib/i18n";

/**
 * Legal navigation footer for account, auth, and auxiliary views.
 *
 * Discreet links to the privacy policy, terms of service, and user data
 * deletion paths.
 */
export function AccountLegal() {
  const t = useT();

  return (
    <nav className="account__legal" aria-label="Legal">
      <Link to="/$" params={{ _splat: "privacy" }}>
        {t("nav.privacy")}
      </Link>
      <span className="account__legal-sep" aria-hidden="true">
        ·
      </span>
      <Link to="/$" params={{ _splat: "terms" }}>
        {t("nav.terms")}
      </Link>
      <span className="account__legal-sep" aria-hidden="true">
        ·
      </span>
      <Link to="/$" params={{ _splat: "user-deletion" }}>
        {t("nav.deletion")}
      </Link>
    </nav>
  );
}
