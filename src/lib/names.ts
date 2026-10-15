type NameSource = { email?: string | null; user_metadata?: Record<string, unknown> };

// The name shown on the agenda and cards: the first name from the Google profile. If
// someone in the session already has that first name, add a last initial ("Shannon T.");
// failing that, fall back to the part of the email before the @.
export function displayNameFor(user: NameSource, takenNames: string[]): string {
  const meta = user.user_metadata ?? {};
  const emailName = (user.email ?? "").split("@")[0];
  const full = String(meta.full_name ?? meta.name ?? "").trim() || emailName;
  const parts = full.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "Someone";

  const taken = new Set(takenNames.map((n) => n.trim().toLowerCase()));
  if (!taken.has(first.toLowerCase())) return first;

  const lastInitial = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : "";
  const withInitial = lastInitial ? `${first} ${lastInitial}.` : first;
  if (!taken.has(withInitial.toLowerCase())) return withInitial;

  return emailName && !taken.has(emailName.toLowerCase()) ? emailName : `${withInitial} 2`;
}
