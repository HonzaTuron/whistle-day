import { call, pb, useToken } from "./client";
import { writeSession, type Session } from "./organiser";

/**
 * Continuing with Google or Facebook.
 *
 * ## The whole point of this file
 *
 * An organiser's account usually starts as one nobody asked for: the wizard
 * made it, it lives in this browser, and it owns their tournament. If pressing
 * "Continue with Google" produced a *new* account, the tournament would still
 * be there and its owner would still be an address nobody can ever sign in to
 * — which is precisely the loss `/api/organiser/claim` exists to prevent,
 * arriving through a different door.
 *
 * PocketBase does the right thing, but only when asked properly. Its OAuth2
 * handler resolves an identity in this order:
 *
 *   1. an account already linked to that Google/Facebook identity;
 *   2. **the account the request itself is authenticated as**;
 *   3. an account whose email matches the one the provider returned;
 *   4. a new account.
 *
 * Step 2 is the one that matters, and with the SDK it is not a header we set
 * by hand — it is whatever is on `pb.authStore` when the exchange is made. So
 * this device's token goes on the store first, and "sign in with Google"
 * becomes "claim this account with Google". Forgetting it is not an error
 * anybody would see in testing: it works, it signs you in, and the tournament
 * is quietly gone.
 *
 * Step 3 cannot collide here: a device account's address ends in
 * `@device.whistleday.local` and no Google account will ever present one.
 *
 * ## Why the redirect flow and not the popup
 *
 * The SDK's `authWithOAuth2` opens a popup and does all of this in one call,
 * which is lovely on a laptop. This runs on a phone in a sports hall, where
 * popups are blocked often enough that the nice version is the unreliable one.
 * So it is the redirect: leave, come back to `/account`, exchange the code.
 *
 * `/account` rather than a route of its own, because the flow starts there,
 * ends there, and that is the screen that has to change. What has to survive
 * the round trip — the provider, its `state` and the PKCE verifier — goes in
 * `sessionStorage`, because it is worthless a minute later and has no reason
 * to outlive the tab.
 */

const PENDING_KEY = "whistleday.oauth.pending";

export interface OAuthProvider {
  name: string;
  displayName: string;
  state: string;
  codeVerifier: string;
  authURL: string;
}

interface Pending {
  name: string;
  state: string;
  codeVerifier: string;
}

/** Where the provider sends the browser back to. */
const redirectURL = () => `${window.location.origin}/account`;

/**
 * Which buttons this deployment can draw.
 *
 * Whether Google and Facebook are configured is the server's business — the
 * credentials are set in PocketBase, not here — so the screen asks rather than
 * assumes. A deployment with neither shows neither, and the email and password
 * form below is the whole of the screen.
 */
export async function availableProviders(): Promise<OAuthProvider[]> {
  try {
    const methods = await pb().collection("users").listAuthMethods();
    if (!methods.oauth2?.enabled) return [];
    return (methods.oauth2.providers ?? []) as OAuthProvider[];
  } catch {
    // A sign-in screen that cannot reach the server has bigger problems than
    // a missing button, and the form below says so when it is submitted.
    return [];
  }
}

/**
 * Send the browser to the provider.
 *
 * Nothing is returned because nothing comes back — the page is replaced. What
 * is left behind in `sessionStorage` is what `completeOAuth` needs to finish
 * the exchange when the browser returns.
 */
export function startOAuth(provider: OAuthProvider): void {
  const pending: Pending = {
    name: provider.name,
    state: provider.state,
    codeVerifier: provider.codeVerifier,
  };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  window.location.assign(provider.authURL + encodeURIComponent(redirectURL()));
}

/** Whether the address we came back to is a provider handing us a result. */
export function isOAuthReturn(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has("code") || params.has("error");
}

/**
 * Finish the exchange, as this device's account if it has one.
 *
 * `session` is optional because somebody signing in on a second device has no
 * local account to keep, and that case must work too.
 */
export async function completeOAuth(session: Session | null): Promise<Session> {
  const raw = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const failed = params.get("error");
  clearReturnParams();

  if (failed) throw new Error(failed);
  if (!raw || !code || !state) throw new Error("oauth");

  const pending = JSON.parse(raw) as Pending;
  // The SDK checks this for its popup flow and cannot for this one, so it is
  // checked here. It is the only thing standing between this tab and somebody
  // else's authorisation code being redeemed in it.
  if (pending.state !== state) throw new Error("oauth");

  // Before the exchange, not after: this is what turns a sign-in into a claim.
  if (session) useToken(session.token);

  const auth = await call(() =>
    pb()
      .collection("users")
      .authWithOAuth2Code(pending.name, code, pending.codeVerifier, redirectURL()),
  );

  return writeSession({
    userId: auth.record.id,
    email: auth.record.email as string,
    // There is no password on an account reached this way. The stored one is
    // the device account's, and it still works — it is the same account — but
    // there is nothing new to learn here, so whatever was known is kept.
    password: session?.password ?? "",
    token: auth.token,
  });
}

/**
 * Take `code` and `state` out of the address bar.
 *
 * A reload with them still there would try to redeem a code that has already
 * been spent, and the screen would report a failure for something that
 * succeeded.
 */
function clearReturnParams(): void {
  const url = new URL(window.location.href);
  const search = url.searchParams;
  for (const key of ["code", "state", "error", "error_description"]) {
    search.delete(key);
  }
  window.history.replaceState({}, "", url.pathname + (search.size ? `?${search}` : ""));
}
