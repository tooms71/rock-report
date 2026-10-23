import { AlertIcon, CheckIcon, OffersIcon, SendIcon } from "@/components/Icons";
import { roleStatusLabel, type RoleStatus } from "@/lib/roleStatus";

const LOOK: Record<RoleStatus, { icon: typeof CheckIcon; text: string }> = {
  on_track: { icon: CheckIcon, text: "text-moss-ink" },
  stalled: { icon: AlertIcon, text: "text-ember-ink" },
  offer_extended: { icon: SendIcon, text: "text-ardesia dark:text-marmol" },
  offer_accepted: { icon: OffersIcon, text: "text-ember-ink" },
};

// A role's status as a small icon and its name, read-only (the buttons live in the form).
export function RoleStatusBadge({ status }: { status: RoleStatus }) {
  const { icon: Icon, text } = LOOK[status];
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${text}`}>
      <Icon className="size-4 shrink-0" />
      {roleStatusLabel(status)}
    </span>
  );
}
