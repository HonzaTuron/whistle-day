import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

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

  const open = (to: "/display/$token" | "/m/$token") => {
    const trimmed = token.trim();
    if (trimmed) navigate({ to, params: { token: trimmed } });
  };

  return (
    <div className="landing">
      <h1>Seedly</h1>
      <p>Run a tournament off a phone and put it on the wall.</p>

      <Link to="/new" className="btn btn--primary landing__cta">
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
    </div>
  );
}
