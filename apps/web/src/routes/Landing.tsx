import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { rememberedTournament } from "../api/organiser";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { useT } from "../lib/i18n";

export function Landing() {
  const t = useT();
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
          <h1 className="home__logo">Whistle.day</h1>
          <p className="home__tagline">{t("landing.tagline")}</p>

          <div className="home__ctas">
            {running ? (
              <Link
                to="/t/$id"
                params={{ id: running.id }}
                className="btn btn--primary btn--block"
              >
                {t("landing.resume", { name: running.name })}
              </Link>
            ) : (
              <Link to="/new" className="btn btn--primary btn--block">
                {t("landing.setUp")}
              </Link>
            )}
            <Link to="/account" className="btn btn--quiet btn--block">
              {t("landing.signIn")}
            </Link>
          </div>
        </div>
      </header>

      <section className="home__section">
        <h2 className="home__section-title">{t("landing.howTitle")}</h2>
        <div className="home__steps">
          <div className="home__step">
            <span className="home__step-icon">1</span>
            <h3>{t("landing.step1Title")}</h3>
            <p>{t("landing.step1Body")}</p>
          </div>
          <div className="home__step">
            <span className="home__step-icon">2</span>
            <h3>{t("landing.step2Title")}</h3>
            <p>{t("landing.step2Body")}</p>
          </div>
          <div className="home__step">
            <span className="home__step-icon">3</span>
            <h3>{t("landing.step3Title")}</h3>
            <p>{t("landing.step3Body")}</p>
          </div>
        </div>
      </section>

      <section className="home__section">
        <h2 className="home__section-title">{t("landing.formatsTitle")}</h2>
        <div className="home__formats">
          <div className="home__format">
            <h3>{t("landing.formatRoundRobin")}</h3>
            <p>{t("landing.formatRoundRobinBody")}</p>
          </div>
          <div className="home__format">
            <h3>{t("landing.formatSingleElim")}</h3>
            <p>{t("landing.formatSingleElimBody")}</p>
          </div>
          <div className="home__format">
            <h3>{t("landing.formatDoubleElim")}</h3>
            <p>{t("landing.formatDoubleElimBody")}</p>
          </div>
          <div className="home__format">
            <h3>{t("landing.formatSwiss")}</h3>
            <p>{t("landing.formatSwissBody")}</p>
          </div>
        </div>
      </section>

      <section className="home__section home__section--screen">
        <h2 className="home__section-title">{t("landing.screenTitle")}</h2>
        <p className="home__section-note">{t("landing.screenNote")}</p>
        <input
          className="home__token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder={t("landing.tokenPlaceholder")}
          onKeyDown={(event) => event.key === "Enter" && open("/display/$token")}
        />
        <div className="home__token-actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!token.trim()}
            onClick={() => open("/display/$token")}
          >
            {t("landing.projector")}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!token.trim()}
            onClick={() => open("/m/$token")}
          >
            {t("landing.phone")}
          </button>
        </div>
      </section>

      <footer className="home__footer">
        <p>{t("landing.footer")}</p>
        <LanguageSwitch />
      </footer>
    </div>
  );
}
