import type { StaffRole } from "@seedly/engine";
import { useEffect, useState } from "react";
import { renderSVG } from "uqr";
import type { StaffRecord } from "../../api/organiser";

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

const ROLES: { value: StaffRole; label: string; hint: string }[] = [
  { value: "referee", label: "Referee", hint: "Runs matches and enters results." },
  { value: "scorer", label: "Scorer", hint: "Keeps score, set by set." },
  { value: "organizer", label: "Co-organiser", hint: "Runs the day alongside you." },
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
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Crew">
      <button
        type="button"
        className="sheet__backdrop"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="sheet__panel">
        <p className="sheet__meta">Who is running this with you</p>
        <p className="sheet__hint">
          Everyone here can enter results from their own phone. The role is who
          they are, not what they are allowed to touch.
        </p>

        {crew.length > 0 ? (
          <ul className="crew">
            {crew.map((member) => (
              <li key={member.id} className="crew__row">
                <div className="crew__who">
                  <strong>{member.name || "Someone"}</strong>
                  <small>{ROLE_NAMES.get(member.role) ?? member.role}</small>
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
                      Remove
                    </button>
                    <button
                      type="button"
                      className="btn btn--quiet btn--small"
                      onClick={() => setConfirming(null)}
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="crew__remove"
                    onClick={() => setConfirming(member.id)}
                    aria-label={`Remove ${member.name || "this person"}`}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="crew__empty">
            Nobody yet — you are running this on your own.
          </p>
        )}

        <div className="crew__invite">
          <p className="sheet__question">Add someone</p>
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
                {role.label}
              </button>
            ))}
          </div>

          {link && qr ? (
            <>
              <p className="sheet__hint">
                {ROLES.find((role) => role.value === link.role)?.hint} Have them
                scan this — there is nothing to sign up for.
              </p>
              <div className="crew__qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <button
                type="button"
                className="done__link"
                onClick={() => void copy(link.url)}
              >
                <span>{link.url.replace(/^https?:\/\//, "")}</span>
                <small>{copied ? "Copied" : "Tap to copy"}</small>
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={onReset}
                disabled={busy}
              >
                {busy ? "Working…" : "Replace this code"}
              </button>
              <p className="sheet__hint">
                Replacing it stops the old one working. Anyone already on the
                list stays — they came through the door, they are not it.
              </p>
            </>
          ) : (
            <p className="sheet__hint">
              Pick what they will be doing and a code appears.
            </p>
          )}
        </div>

        <div className="sheet__actions">
          <button type="button" className="btn btn--quiet btn--block" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
