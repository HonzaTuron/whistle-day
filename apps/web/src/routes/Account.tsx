import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  claimAccount,
  ensureOrganiser,
  isDeviceAccount,
  myTournaments,
  rememberTournament,
  signIn,
  storedSession,
  type Session,
  type TournamentRecord,
} from "../api/organiser";

type Mode = "claim" | "signin";

export function Account() {
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

  const active = useRef<Promise<Session> | null>(null);

  useEffect(() => {
    if (!storedSession()) return;
    active.current ??= ensureOrganiser();
    void active.current
      .then(setSession)
      .catch(() => setError("Cannot reach the scoring system."));
  }, []);

  const claimed = session !== null && !isDeviceAccount(session);
  const canClaim = session !== null && !claimed;

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
        setError(
          "That address cannot be saved on this device. If it is already your account, sign in with it — anything set up here stays live and this browser stops being the way in.",
        );
      } else {
        setError(thrown instanceof Error ? thrown.message : "That did not work.");
      }
    } finally {
      setBusy(false);
    }
  };

  const open = (tournament: TournamentRecord) => {
    rememberTournament({ id: tournament.id, name: tournament.name, token: "" });
    void navigate({ to: "/t/$id", params: { id: tournament.id } });
  };

  return (
    <div className="account">
      {error ? (
        <div className="wiz__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ) : null}

      <header>
        <h1>
          {claimed ? "Signed in" : canClaim ? "Keep your tournament" : "Sign in"}
        </h1>
        <p>
          {claimed ? (
            <>
              As <strong>{session?.email}</strong>. Sign in with that anywhere
              else to pick your tournaments up there.
            </>
          ) : canClaim ? (
            "The way back into your tournament lives in this browser and nowhere else — whether you set it up or were handed a code at the door. An email and a password give it somewhere else to live."
          ) : (
            "Nothing has been set up on this device. Sign in and whatever you run from another one comes with you."
          )}
        </p>
      </header>

      {claimed ? (
        <section className="account__owned">
          {owned === null ? (
            <p className="account__hint">Looking…</p>
          ) : owned.length === 0 ? (
            <p className="account__hint">No tournaments on this account yet.</p>
          ) : (
            <ul>
              {owned.map((tournament) => (
                <li key={tournament.id}>
                  <button type="button" onClick={() => open(tournament)}>
                    <span>{tournament.name}</span>
                    <small>{tournament.status}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/" className="btn btn--quiet btn--block">
            Done
          </Link>
        </section>
      ) : (
        <form
          className="account__form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label>
            <span>Email</span>
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
            <span>Password</span>
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
            {busy
              ? "One moment…"
              : mode === "claim"
                ? "Save access"
                : "Sign in"}
          </button>

          {canClaim ? (
            <button
              type="button"
              className="btn btn--quiet btn--block"
              onClick={() => {
                setMode(mode === "claim" ? "signin" : "claim");
                setError(null);
              }}
            >
              {mode === "claim"
                ? "I already have an account"
                : "Keep this device's tournament instead"}
            </button>
          ) : null}

          {mode === "signin" && canClaim ? (
            <p className="account__warning">
              Signing in as somebody else leaves anything set up on this device
              behind. It stays live on the wall; this browser just stops being
              the way in.
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
