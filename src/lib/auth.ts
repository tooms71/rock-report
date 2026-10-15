// Who may use the app: people signed in with a Carrara Google account. Google itself is
// set to "Internal" so outsiders can't sign in at all; this is the app's own second check.
export const ALLOWED_EMAIL_DOMAIN = "carrara.is";

export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}
