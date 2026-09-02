import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ensureOrganiser,
  joinWithInvite,
  rememberTournament,
  type JoinResult,
} from "../api/organiser";
import { usePreviewInvite } from "../api/hooks";
import type { StaffRole } from "@seedly/engine";

const ROLES: Record<StaffRole, string> = {
  organizer: "help run it",
  referee: "referee",
  scorer: "keep score",
};

export function Join({ token }: { token: string }) {
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
      setError(
        thrown instanceof Error ? thrown.message : "Could not join this tournament.",
      );
      setBusy(false);
    } finally {
      inflight.current = null;
    }
  };

  if (isLoading) return <p className="results__message">Loading…</p>;

  if (!invite) {
    return (
      <div className="join">
        <h1 className="join__title">Nothing to join</h1>
        <p className="join__lead">
          {isError
            ? "This invitation has expired, or was never valid."
            : error ?? "This invitation is not valid."}{" "}
          Ask whoever is running the day for a fresh code.
        </p>
      </div>
    );
  }

  return (
    <div className="join">
      <p className="join__eyebrow">You have been asked to {ROLES[invite.role]}</p>
      <h1 className="join__title">{invite.name}</h1>

      <label className="join__field">
        <span>Your name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Jana"
          autoComplete="name"
          maxLength={60}
          enterKeyHint="go"
          onKeyDown={(event) => {
            if (event.key === "Enter") void join();
          }}
        />
        <small>
          So the others can tell who entered a result. You can leave it blank.
        </small>
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
        {busy ? "Joining…" : "Join and start"}
      </button>

      <p className="join__warning">
        You are joining on this device, without an account. Clearing this
        browser is the one thing that will lock you out.
      </p>
    </div>
  );
}
