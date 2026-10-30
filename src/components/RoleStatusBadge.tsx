import {
  publicStatus,
  roleStatusEmoji,
  roleStatusLabel,
  type RoleStatus,
} from "@/lib/roleStatus";

const TEXT: Record<RoleStatus, string> = {
  on_track: "text-moss-ink",
  slow: "text-amber-ink",
  struggling: "text-grafite dark:text-marmol/80",
  stalled: "text-ember-ink",
  offer_extended: "text-ardesia dark:text-marmol",
  offer_accepted: "text-ember-ink",
};

// A role's status as an emoji and its name, read-only (the buttons live in the form). Shows
// what the team sees: gray is private to its owner, so it reads as yellow here. Pass `mine`
// on the owner's own screen to show the real gray.
export function RoleStatusBadge({ status, mine = false }: { status: RoleStatus; mine?: boolean }) {
  const shown = mine ? status : publicStatus(status);
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${TEXT[shown]}`}>
      <span aria-hidden="true">{roleStatusEmoji(shown)}</span>
      {roleStatusLabel(shown)}
    </span>
  );
}
