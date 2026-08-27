import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { rememberedTournament } from "../api/organiser";

export function Landing() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [running] = useState(rememberedTournament);

  const open = (to: "/display/$token" | "/m/$token") => {
    const trimmed = token.trim();
    if (trimmed) navigate({ to, params: { token: trimmed } });
  };

  return (
    <div className="home">
      <header className="home__hero">
        <div className="home__hero-bg" />
        <div className="home__hero-content">
          <h1 className="home__logo">Seedly</h1>
          <p className="home__tagline">
            Run a tournament off a phone and put it on the wall.
          </p>

          <div className="home__ctas">
            {running ? (
              <Link
                to="/t/$id"
                params={{ id: running.id }}
                className="btn btn--primary btn--block"
              >
                Back to {running.name}
              </Link>
            ) : (
              <Link to="/new" className="btn btn--primary btn--block">
                Set up a tournament
              </Link>
            )}
            <Link to="/account" className="btn btn--quiet btn--block">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="home__section">
        <h2 className="home__section-title">How it works</h2>
        <div className="home__steps">
          <div className="home__step">
            <span className="home__step-icon">1</span>
            <h3>Set it up</h3>
            <p>
              Name your tournament, add the teams, pick the format. Done in
              under a minute — no account needed.
            </p>
          </div>
          <div className="home__step">
            <span className="home__step-icon">2</span>
            <h3>Run the day</h3>
            <p>
              Put matches on courts, mark what is being played, enter results as
              they come in. All from your phone.
            </p>
          </div>
          <div className="home__step">
            <span className="home__step-icon">3</span>
            <h3>Put it on the wall</h3>
            <p>
              A projector screen that updates itself — tables rebuild, the
              bracket fills in, the next Swiss round draws itself.
            </p>
          </div>
        </div>
      </section>

      <section className="home__section">
        <h2 className="home__section-title">Formats</h2>
        <div className="home__formats">
          <div className="home__format">
            <h3>Round Robin</h3>
            <p>Every team plays every other. Groups feed into the playoff.</p>
          </div>
          <div className="home__format">
            <h3>Single Elimination</h3>
            <p>Lose once and you are out. Classic bracket, straight through.</p>
          </div>
          <div className="home__format">
            <h3>Double Elimination</h3>
            <p>
              A second chance: drop into the losers bracket and fight your way
              back.
            </p>
          </div>
          <div className="home__format">
            <h3>Swiss</h3>
            <p>
              Every round pairs like with like. No elimination — every team
              plays every round.
            </p>
          </div>
        </div>
      </section>

      <section className="home__section home__section--screen">
        <h2 className="home__section-title">Open a screen</h2>
        <p className="home__section-note">
          Enter the token from the QR code by the door, or from the organiser
          screen.
        </p>
        <input
          className="home__token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="screen token"
          onKeyDown={(event) => event.key === "Enter" && open("/display/$token")}
        />
        <div className="home__token-actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!token.trim()}
            onClick={() => open("/display/$token")}
          >
            Projector
          </button>
          <button
            type="button"
            className="btn"
            disabled={!token.trim()}
            onClick={() => open("/m/$token")}
          >
            Phone
          </button>
        </div>
      </section>

      <footer className="home__footer">
        <p>Seedly — free and open-source tournament organiser.</p>
      </footer>
    </div>
  );
}
