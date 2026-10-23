import { roleStatusEmoji, roleStatusLabel, type RoleStatus } from "@/lib/roleStatus";

const TEXT: Record<RoleStatus, string> = {
  on_track: "text-moss-ink",
  stalled: "text-ember-ink",
  offer_extended: "text-ardesia dark:text-marmol",
  offer_accepted: "text-ember-ink",
};

// A role's status as an emoji and its name, read-only (the buttons live in the form).
export function RoleStatusBadge({ status }: { status: RoleStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${TEXT[status]}`}>
      <span aria-hidden="true">{roleStatusEmoji(status)}</span>
      {roleStatusLabel(status)}
    </span>
  );
}
