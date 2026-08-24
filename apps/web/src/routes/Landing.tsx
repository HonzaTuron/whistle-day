import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { rememberedTournament } from "../api/organiser";

/**
 * Two audiences, in order of who is standing here.
 *
 * Someone setting a tournament up needs one button. Everyone else arrives on
 * /display/:token or /m/:token directly — from a QR code by the door or a link
 * passed round — and only ends up here having typed the bare domain, which is
 * what the token box is for.
 */
export function Landing() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  // Read once, from localStorage, so the way back to a tournament being run
  // right now is on screen before any request has been made.
  const [running] = useState(rememberedTournament);

  const open = (to: "/display/$token" | "/m/$token") => {
    const trimmed = token.trim();
    if (trimmed) navigate({ to, params: { token: trimmed } });
  };

  return (
    <div className="landing">
      <h1>Seedly</h1>
      <p>Run a tournament off a phone and put it on the wall.</p>

      {running ? (
        <Link
          to="/t/$id"
          params={{ id: running.id }}
          className="btn btn--primary landing__cta"
        >
          Back to {running.name}
        </Link>
      ) : null}

      <Link
        to="/new"
        className={"btn landing__cta" + (running ? "" : " btn--primary")}
      >
        Set up a tournament
      </Link>

      <p className="landing__divider">or open a screen you have a token for</p>

      <input
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="screen token"
        onKeyDown={(event) => event.key === "Enter" && open("/display/$token")}
      />

      <div className="landing__actions">
        <button type="button" onClick={() => open("/display/$token")}>
          Projector
        </button>
        <button type="button" onClick={() => open("/m/$token")}>
          Phone
        </button>
      </div>

      <Link to="/account" className="landing__account">
        Sign in, or keep a tournament you set up here
      </Link>
    </div>
  );
}
