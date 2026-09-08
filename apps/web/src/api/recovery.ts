import { call, pb } from "./client";

/**
 * Getting back into a claimed account.
 *
 * All four are thin passes to the SDK's built-in auth flows on the `users`
 * collection — the server does the work, and the email templates
 * (`backend/migrations/…_recovery_mail.go`) point their links back at the two
 * screens in this app rather than at the PocketBase dashboard.
 *
 * None of this applies to the device account the wizard makes: it has no real
 * address, so there is nothing to send to and nothing to reset to. The path
 * in is `claimAccount`, and this is the path back once that is done.
 */

/**
 * Ask for a reset link. Always resolves, whether or not the address has an
 * account — telling the two apart is a way to enumerate who has signed up.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await call(() => pb().collection("users").requestPasswordReset(email));
}

/** Set the new password from the token in a reset link. */
export async function confirmPasswordReset(
  token: string,
  password: string,
): Promise<void> {
  await call(() =>
    pb().collection("users").confirmPasswordReset(token, password, password),
  );
}

/** Confirm an address from the token in a verification link. */
export async function confirmVerification(token: string): Promise<void> {
  await call(() => pb().collection("users").confirmVerification(token));
}

/** Send another verification link to an address that has not confirmed yet. */
export async function resendVerification(email: string): Promise<void> {
  await call(() => pb().collection("users").requestVerification(email));
}
