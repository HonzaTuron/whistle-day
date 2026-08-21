import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Somewhere to paste a screen link. Real traffic arrives on /display/:token or
 * /m/:token directly — from a QR code on the wall, or a link the organiser
 * sends round.
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
      <p>Open a screen with its token.</p>

      <input
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="screen token"
        onKeyDown={(event) => event.key === "Enter" && open("/display/$token")}
        autoFocus
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
