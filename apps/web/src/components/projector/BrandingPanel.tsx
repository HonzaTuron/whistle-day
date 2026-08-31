import type { DisplayPayload, DisplaySponsor } from "@seedly/engine";
import { useState } from "react";

/**
 * The closing card of the rotation.
 *
 * Two things share it, in that order of size: the people who paid for the
 * hall, and the software that ran the day. Sponsors arrive already filtered by
 * the server — an organiser without a subscription sends none — so there is no
 * plan to check here and nothing to hide.
 *
 * Unlike every other panel this one is never empty, which is the point: it is
 * the one page that does not depend on there being a result yet.
 */
export function BrandingPanel({ payload }: { payload: DisplayPayload }) {
  const { sponsors } = payload;

  return (
    <div className={sponsors.length > 0 ? "branding branding--partners" : "branding"}>
      {sponsors.length > 0 && (
        <ul
          className="branding__slots"
          // Six logos in one row are unreadable and two are lost in it. The
          // grid follows the count rather than a fixed template.
          style={{ "--columns": Math.min(sponsors.length, 3) } as React.CSSProperties}
        >
          {sponsors.map((sponsor, index) => (
            <SponsorSlot key={`${sponsor.name}-${sponsor.logo}-${index}`} sponsor={sponsor} />
          ))}
        </ul>
      )}

      <div className="branding__credit">
        <span className="branding__mark">Seedly</span>
        <small>Scoring and screens for this tournament</small>
      </div>
    </div>
  );
}

function SponsorSlot({ sponsor }: { sponsor: DisplaySponsor }) {
  // A logo that 404s draws a broken-image icon, which on a projector is worse
  // than the sponsor's name in plain type. If there is no name either, the
  // slot goes rather than leaving a hole where a logo was promised.
  const [broken, setBroken] = useState(false);

  if (broken && !sponsor.name) return null;

  return (
    <li className="branding__slot">
      {sponsor.logo && !broken ? (
        <img
          className="branding__logo"
          src={sponsor.logo}
          alt={sponsor.name}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="branding__name">{sponsor.name}</span>
      )}
      {sponsor.tier && <small className="branding__tier">{sponsor.tier}</small>}
    </li>
  );
}
