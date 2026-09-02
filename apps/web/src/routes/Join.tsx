import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ensureOrganiser,
  joinWithInvite,
  rememberTournament,
  type JoinResult,
} from "../api/organiser";
import { usePreviewInvite } from "../api/hooks";
import { useT, type MessageKey } from "../lib/i18n";
import type { StaffRole } from "@seedly/engine";

/** What the invitation says this person is being asked to do. */
const ROLES: Record<StaffRole, MessageKey> = {
  organizer: "join.roleOrganizer",
  referee: "join.roleReferee",
  scorer: "join.roleScorer",
};

export function Join({ token }: { token: string }) {
  const t = useT();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: invite, isLoading, isError } = usePreviewInvite(token);

  const inflight = useRef<Promise<JoinResult> | null>(null);

  const join = async () => {
    if (inflight.current) return;
    setBusy(true);
    setError(null);
    try {
      const session = await ensureOrganiser();
      inflight.current = joinWithInvite(session, token, name);
      const joined = await inflight.current;
      rememberTournament({ id: joined.tournament, name: joined.name, token: "" });
      await navigate({ to: "/t/$id", params: { id: joined.tournament } });
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : t("join.failed"));
      setBusy(false);
    } finally {
      inflight.current = null;
    }
  };

  if (isLoading) return <p className="results__message">{t("common.loading")}</p>;

  if (!invite) {
    return (
      <div className="join">
        <h1 className="join__title">{t("join.nothing")}</h1>
        <p className="join__lead">
          {isError ? t("join.expired") : error ?? t("join.invalid")}{" "}
          {t("join.askForFresh")}
        </p>
      </div>
    );
  }

  return (
    <div className="join">
      <p className="join__eyebrow">
        {t("join.asked", { role: t(ROLES[invite.role]) })}
      </p>
      <h1 className="join__title">{invite.name}</h1>

      <label className="join__field">
        <span>{t("join.yourName")}</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("join.namePlaceholder")}
          autoComplete="name"
          maxLength={60}
          enterKeyHint="go"
          onKeyDown={(event) => {
            if (event.key === "Enter") void join();
          }}
        />
        <small>{t("join.nameHint")}</small>
      </label>

      {error ? (
        <div className="wiz__error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={() => void join()}
        disabled={busy}
      >
        {t(busy ? "join.joining" : "join.start")}
      </button>

      <p className="join__warning">{t("join.warning")}</p>
    </div>
  );
}
