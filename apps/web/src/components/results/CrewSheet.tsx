import type { StaffRole } from "@seedly/engine";
import { useEffect, useState } from "react";
import { renderSVG } from "uqr";
import type { StaffRecord } from "../../api/organiser";
import { useT, type MessageKey } from "../../lib/i18n";

interface Props {
  crew: StaffRecord[];
  /** The live join link for the role on show, once it has been asked for. */
  link: { role: StaffRole; url: string } | null;
  /** True while a token is being minted or withdrawn. */
  busy: boolean;
  onRole: (role: StaffRole) => void;
  onReset: () => void;
  onRemove: (member: StaffRecord) => void;
  onClose: () => void;
}

/**
 * Putting a second person on a second phone.
 *
 * The QR is the feature. A referee standing at court three is three metres
 * away from the organiser and nowhere near their email, so the invitation is
 * something held up and scanned — proximity is the authentication, and anyone
 * close enough to scan the code is someone already being handed a court.
 *
 * One code per role rather than one per person, because the alternative is
 * typing names into a phone in a hall. Whoever scans it says who they are at
 * the other end, where that is known.
 *
 * The code renders black on white whatever the theme is doing. A QR inverted
 * into the dark palette scans on roughly half the phones in a hall, which is
 * the worst way to fail: it works when you test it.
 */

const ROLES: { value: StaffRole; label: MessageKey; hint: MessageKey }[] = [
  { value: "referee", label: "crew.referee", hint: "crew.refereeHint" },
  { value: "scorer", label: "crew.scorer", hint: "crew.scorerHint" },
  { value: "organizer", label: "crew.organizer", hint: "crew.organizerHint" },
];

const ROLE_NAMES = new Map(ROLES.map((role) => [role.value, role.label]));

export function CrewSheet({
  crew,
  link,
  busy,
  onRole,
  onReset,
  onRemove,
  onClose,
}: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Refused on some phones. The link is on screen to be read out or
      // long-pressed, and the code above it does not need the clipboard.
    }
  };

  const qr = link
    ? renderSVG(link.url, {
        pixelSize: 7,
        border: 2,
        blackColor: "#0b0f14",
        whiteColor: "#ffffff",
        ecc: "M",
      })
    : null;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={t("crew.label")}>
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label={t("common.close")}
      />

      <div className="sheet__panel">
        <p className="sheet__meta">{t("crew.title")}</p>
        <p className="sheet__hint">{t("crew.intro")}</p>

        {crew.length > 0 ? (
          <ul className="crew">
            {crew.map((member) => (
              <li key={member.id} className="crew__row">
                <div className="crew__who">
                  <strong>{member.name || t("board.someone")}</strong>
                  <small>
                    {ROLE_NAMES.has(member.role)
                      ? t(ROLE_NAMES.get(member.role)!)
                      : member.role}
                  </small>
                </div>
                {confirming === member.id ? (
                  <div className="crew__confirm">
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      onClick={() => {
                        setConfirming(null);
                        onRemove(member);
                      }}
                    >
                      {t("common.remove")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--quiet btn--small"
                      onClick={() => setConfirming(null)}
                    >
                      {t("common.keep")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="crew__remove"
                    onClick={() => setConfirming(member.id)}
                    aria-label={t("crew.removeMember", {
                      name: member.name || t("crew.thisPerson"),
                    })}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="crew__empty">{t("crew.empty")}</p>
        )}

        <div className="crew__invite">
          <p className="sheet__question">{t("crew.add")}</p>
          <div className="crew__roles">
            {ROLES.map((role) => (
              <button
                key={role.value}
                type="button"
                className={"chip" + (link?.role === role.value ? " is-on" : "")}
                aria-pressed={link?.role === role.value}
                onClick={() => onRole(role.value)}
                disabled={busy}
              >
                {t(role.label)}
              </button>
            ))}
          </div>

          {link && qr ? (
            <>
              <p className="sheet__hint">
                {(() => {
                  const hint = ROLES.find((role) => role.value === link.role)?.hint;
                  return hint ? `${t(hint)} ` : "";
                })()}
                {t("crew.scanThis")}
              </p>
              <div className="crew__qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <button
                type="button"
                className="done__link"
                onClick={() => void copy(link.url)}
              >
                <span>{link.url.replace(/^https?:\/\//, "")}</span>
                <small>{t(copied ? "common.copied" : "common.copy")}</small>
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={onReset}
                disabled={busy}
              >
                {t(busy ? "crew.working" : "crew.replace")}
              </button>
              <p className="sheet__hint">{t("crew.replaceNote")}</p>
            </>
          ) : (
            <p className="sheet__hint">{t("crew.pickRole")}</p>
          )}
        </div>

        <div className="sheet__actions">
          <button type="button" className="btn btn--quiet btn--block" onClick={onClose}>
            {t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
