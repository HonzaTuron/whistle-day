import type { Sponsor } from "@whistleday/engine";
import { useEffect, useRef, useState } from "react";
import { useT } from "../../lib/i18n";

interface Props {
  sponsors: Sponsor[];
  /** Built from the record rather than passed in, so this stays presentational. */
  logoUrl: (sponsor: Sponsor) => string;
  busy: boolean;
  onAdd: (name: string, tier: string, logo: File | null) => void;
  onReplaceLogo: (sponsor: Sponsor, logo: File) => void;
  onRemove: (sponsor: Sponsor) => void;
  onMove: (sponsor: Sponsor, direction: "up" | "down") => void;
  onClose: () => void;
}

const LOGO_TYPES = "image/png,image/jpeg,image/svg+xml,image/webp";

/**
 * Who is on the closing panel, in the order they run.
 *
 * A name and nothing else is enough to be a sponsor — the picture is what
 * makes the panel worth having, but it can arrive by email an hour after the
 * conversation that landed the deal, so it is never required to add the row.
 * Tapping a logo already on the wall replaces it in place rather than
 * deleting the sponsor and starting over.
 *
 * Reordering is two buttons rather than a drag handle, the way the screen's
 * own rotation gets one: that list is dragged because it is checked and
 * rearranged often; a sponsor list is set up once a season and barely touched
 * afterwards, so a pair of arrows is the whole interface it needs.
 */
export function SponsorsSheet({
  sponsors,
  logoUrl,
  busy,
  onAdd,
  onReplaceLogo,
  onRemove,
  onMove,
  onClose,
}: Props) {
  const t = useT();
  const [name, setName] = useState("");
  const [tier, setTier] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const trimmed = name.trim();
  const ready = trimmed.length > 0 && !busy;

  const add = () => {
    if (!ready) return;
    onAdd(trimmed, tier.trim(), logo);
    setName("");
    setTier("");
    setLogo(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={t("sponsors.label")}>
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label={t("common.close")}
      />

      <div className="sheet__panel">
        <p className="sheet__meta">{t("sponsors.title")}</p>
        <p className="sheet__hint">{t("sponsors.intro")}</p>

        {sponsors.length > 0 ? (
          <ul className="crew">
            {sponsors.map((sponsor, index) => {
              const url = logoUrl(sponsor);
              return (
                <li key={sponsor.id} className="crew__row sponsor__row">
                  <label className="sponsor__logo">
                    {url ? (
                      <img src={url} alt="" />
                    ) : (
                      <span className="sponsor__logo-empty" aria-hidden="true">
                        {sponsor.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <input
                      type="file"
                      accept={LOGO_TYPES}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onReplaceLogo(sponsor, file);
                        event.target.value = "";
                      }}
                      aria-label={t("sponsors.changeLogo", { name: sponsor.name })}
                    />
                  </label>

                  <div className="crew__who">
                    <strong>{sponsor.name}</strong>
                    {sponsor.tier ? <small>{sponsor.tier}</small> : null}
                  </div>

                  <div className="sponsor__row-actions">
                    <button
                      type="button"
                      className="sponsor__move"
                      onClick={() => onMove(sponsor, "up")}
                      disabled={busy || index === 0}
                      aria-label={t("sponsors.moveUp", { name: sponsor.name })}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="sponsor__move"
                      onClick={() => onMove(sponsor, "down")}
                      disabled={busy || index === sponsors.length - 1}
                      aria-label={t("sponsors.moveDown", { name: sponsor.name })}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="crew__remove"
                      onClick={() => onRemove(sponsor)}
                      disabled={busy}
                      aria-label={t("sponsors.removeSponsor", { name: sponsor.name })}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="crew__empty">{t("sponsors.empty")}</p>
        )}

        <form
          className="sponsor__add"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <input
            name="name"
            value={name}
            placeholder={t("sponsors.addName")}
            aria-label={t("sponsors.addName")}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
          <input
            name="tier"
            value={tier}
            placeholder={t("sponsors.addTier")}
            aria-label={t("sponsors.addTier")}
            autoComplete="off"
            onChange={(event) => setTier(event.target.value)}
          />
          <label className="sponsor__pick">
            <input
              ref={fileInput}
              type="file"
              accept={LOGO_TYPES}
              className="sr-only"
              onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
            />
            <span>{logo ? logo.name : t("sponsors.addLogo")}</span>
          </label>
          <button type="submit" className="btn btn--small" disabled={!ready}>
            {t(busy ? "sponsors.adding" : "sponsors.add")}
          </button>
        </form>
        <p className="sheet__hint">{t("sponsors.addHint")}</p>

        <div className="sheet__actions">
          <button type="button" className="btn btn--quiet btn--block" onClick={onClose}>
            {t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
