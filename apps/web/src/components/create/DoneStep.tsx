import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { renderSVG } from "uqr";
import type { LaunchResult } from "../../api/launch";

interface Props {
  name: string;
  tournamentId: string;
  result: LaunchResult;
}

/**
 * The end of the wizard is two links, and they are not interchangeable.
 *
 * The QR code is the spectators' one — the phone view, the thing that gets
 * printed and taped to the door. The projector link is the organiser's, and it
 * is a button rather than a code because the laptop it belongs on is not the
 * device holding this screen.
 *
 * The code is rendered black on white whatever the theme does. A QR inverted
 * into the dark palette scans on roughly half the phones in a hall, which is
 * the worst possible failure: it works when you test it.
 */
export function DoneStep({ name, tournamentId, result }: Props) {
  const [copied, setCopied] = useState<"phone" | "projector" | null>(null);

  const qr = renderSVG(result.phoneUrl, {
    pixelSize: 8,
    border: 2,
    blackColor: "#0b0f14",
    whiteColor: "#ffffff",
    ecc: "M",
  });

  const copy = async (which: "phone" | "projector", url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access is refused on some phones; the link is on screen and
      // can be read out or long-pressed instead.
    }
  };

  return (
    <div className="done">
      <p className="done__eyebrow">Live now</p>
      <h1 className="done__title">{name}</h1>

      <div className="done__qr" dangerouslySetInnerHTML={{ __html: qr }} />
      <p className="done__caption">Scan for the schedule, tables and results</p>

      <button
        type="button"
        className="done__link"
        onClick={() => void copy("phone", result.phoneUrl)}
      >
        <span>{result.phoneUrl.replace(/^https?:\/\//, "")}</span>
        <small>{copied === "phone" ? "Copied" : "Tap to copy"}</small>
      </button>

      <div className="done__actions">
        <Link
          to="/t/$id"
          params={{ id: tournamentId }}
          className="btn btn--primary btn--block"
        >
          Start entering results
        </Link>
        <a className="btn btn--block" href={result.projectorUrl}>
          Open the projector screen
        </a>
        <button
          type="button"
          className="btn btn--quiet btn--block"
          onClick={() => void copy("projector", result.projectorUrl)}
        >
          {copied === "projector" ? "Projector link copied" : "Copy the projector link"}
        </button>
      </div>

      <p className="done__warning">
        This tournament is managed from this device — this browser is the only
        one that can change it.{" "}
        <Link to="/account">Put an email on it</Link> and it will survive a lost
        phone.
      </p>
    </div>
  );
}
