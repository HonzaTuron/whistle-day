import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ensureOrganiser,
  joinWithInvite,
  previewInvite,
  rememberTournament,
  type JoinResult,
} from "../api/organiser";
import type { StaffRole } from "@seedly/engine";

const ROLES: Record<StaffRole, string> = {
  organizer: "help run it",
  referee: "referee",
  scorer: "keep score",
};

/**
 * The other end of a QR code held up in a hall.
 *
 * The whole screen is one box and one button, and the box is optional. Whoever
 * is looking at this was handed a phone thirty seconds ago and has a match
 * waiting, so the shortest correct path is: read the name of the tournament,
 * say who you are, tap once, be on the match list.
 *
 * There is no sign-up, and that is not a shortcut — it is the same bargain the
 * organiser's wizard makes. The account is created silently on this device.
 * What it costs is stated at the bottom rather than hidden: this browser is
 * the way back in, and /account is how to make it survive the phone.
 *
 * The name is asked for here rather than typed by the organiser because this
 * is the end of the transaction that knows it, and because the alternative is
 * an organiser spelling somebody's name into a phone while a court waits.
 */
export function Join({ token }: { token: string }) {
  const navigate = useNavigate();
  const [invite, setInvite] = useState<{ name: string; role: StaffRole } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Read before joining: an invitation nobody can name is one nobody should
  // accept, and this is the request that turns a token into a tournament.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const preview = await previewInvite(token);
        if (!cancelled) setInvite(preview);
      } catch {
        if (!cancelled) {
          setError("This invitation has expired, or was never valid.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Guards a double tap on a slow hall connection: joining twice would be two
  // requests racing for the same unique (tournament, user) row.
  const inflight = useRef<Promise<JoinResult> | null>(null);

  const join = async () => {
    if (inflight.current) return;
    setBusy(true);
    setError(null);
    try {
      const session = await ensureOrganiser();
      inflight.current = joinWithInvite(session, token, name);
      const joined = await inflight.current;
      // The landing page's way back, so a phone that gets locked and reopened
      // does not need the QR code a second time. The screen token is unknown
      // here and the results screen fills it in on its first load.
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

  if (loading) return <p className="results__message">Loading…</p>;

  if (!invite) {
    return (
      <div className="join">
        <h1 className="join__title">Nothing to join</h1>
        <p className="join__lead">
          {error ?? "This invitation is not valid."} Ask whoever is running the
          day for a fresh code.
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
