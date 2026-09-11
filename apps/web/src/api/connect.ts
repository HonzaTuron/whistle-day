import { send, type Session } from "./organiser";

/**
 * The browser side of an AI agent asking to act as a signed-in person.
 *
 * `oauth.ts` is the opposite role: Whistle.day signing a person in via
 * someone else's OAuth — Google, Facebook — as a client. This file is the
 * reverse: Whistle.day is the authorization server, and this is what the
 * `/oauth/consent` screen calls once a person has landed there mid-flow.
 * Nothing here talks to Google or Facebook; it talks to this server's own
 * `/api/oauth/consent/*` routes — see backend/internal/oauth for the other
 * half, and backend/internal/mcp/auth.go for what a completed flow then
 * lets an agent do.
 */

export interface ConsentPreview {
  client_name: string;
  scope: string;
  resource: string;
}

/**
 * What the request is for, before anyone signs in or decides anything — the
 * same "do not ask somebody to accept a blank cheque" reasoning as
 * previewHandoff. Public: a request id is a short-lived pointer to a pending
 * authorize call, not a secret anything depends on.
 */
export const previewConsentRequest = (requestId: string) =>
  send<ConsentPreview>(null, `/api/oauth/consent/${requestId}`);

export interface ConsentResult {
  /** Where to send the browser next — the connecting client's own
   * redirect_uri, carrying either a code or an access_denied error. */
  redirect: string;
}

/** Approve or deny, as whoever is signed in. */
export const submitConsent = (session: Session, requestId: string, approve: boolean) =>
  send<ConsentResult>(session, `/api/oauth/consent/${requestId}`, {
    method: "POST",
    body: { approve },
  });
