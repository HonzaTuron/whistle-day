import { apiCall, writeSession, type Session } from "./organiser";

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
 * Step 2 is the one that matters. Sending this device's token along with the
 * exchange turns "sign in with Google" into "claim this account with Google",
 * and the tournament stays where it is. Forgetting the token is not an error
 * anybody would see in testing — it works, it signs you in, and the tournament
 * is quietly gone.
 *
 * Step 3 cannot collide here: a device account's address ends in
 * `@device.whistleday.local` and no Google account will ever present one.
 *
 * ## The redirect comes back to /account
 *
 * Rather than a route of its own, because the flow starts there, ends there,
 * and the screen it returns to is the one that has to change. `/account` is
 * already `noindex` and already an app route, so nothing has to learn about a
 * new address.
 *
 * What has to survive the round trip is the provider's name, its `state` and
 * its PKCE verifier. They go in `sessionStorage` rather than `localStorage`:
 * they are worthless a minute later and there is no reason for them to outlive
 * the tab.
 */

const PENDING_KEY = "whistleday.oauth.pending";

export interface OAuthProvider {
  name: string;
  displayName: string;
  state: string;
  codeVerifier: string;
  authURL: string;
}

interface AuthMethods {
  oauth2?: {
    enabled?: boolean;
    providers?: OAuthProvider[];
  };
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
    const methods = await apiCall<AuthMethods>(
      "/api/collections/users/auth-methods",
    );
    if (!methods.oauth2?.enabled) return [];
    return methods.oauth2.providers ?? [];
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
 * Finish the exchange, as this device if it has an account already.
 *
 * `session` is the device account, and passing it is what makes this a claim
 * rather than a signup — see the note at the top. It is optional because
 * somebody signing in on a second device has no local account to keep, and
 * that case must also work.
 */
export async function completeOAuth(session: Session | null): Promise<Session> {
  const raw = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  clearReturnParams();

  const params = new URLSearchParams(window.location.search);
  if (params.get("error")) {
    throw new Error(params.get("error") ?? "oauth");
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!raw || !code || !state) {
    throw new Error("oauth");
  }

  const pending = JSON.parse(raw) as Pending;
  // The state is the only thing standing between this and somebody else's
  // authorisation code being redeemed by this tab.
  if (pending.state !== state) {
    throw new Error("oauth");
  }

  const auth = await apiCall<{ token: string; record: { id: string; email: string } }>(
    "/api/collections/users/auth-with-oauth2",
    {
      method: "POST",
      // The device account, so PocketBase links rather than creates.
      ...(session ? { token: session.token } : {}),
      body: {
        provider: pending.name,
        code,
        codeVerifier: pending.codeVerifier,
        redirectURL: redirectURL(),
      },
    },
  );

  return writeSession({
    userId: auth.record.id,
    email: auth.record.email,
    // There is no password on an account reached this way. The stored one
    // would be the device account's, which still works and is still this
    // person's — but writing it back here would be claiming to know a
    // credential for an identity that does not have one.
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
