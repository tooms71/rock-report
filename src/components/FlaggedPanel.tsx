import { FLAGGABLE_FIELDS, type ReactionRow } from "@/components/RevealGrid";
import type { UpdateFields } from "@/components/WritingForm";

type ParticipantRow = {
  id: string;
  display_name: string;
};

type UpdateRow = UpdateFields & {
  id: string;
  participant_id: string;
};

export function FlaggedPanel({
  participants,
  updates,
  reactions,
}: {
  participants: ParticipantRow[];
  updates: UpdateRow[];
  reactions: ReactionRow[];
}) {
  const flagKeys = new Set(
    reactions
      .filter((r) => r.target_type === "field" && r.emoji === "🚩" && r.field_key)
      .map((r) => `${r.target_update_id}:${r.field_key}`)
  );

  if (flagKeys.size === 0) return null;

  const items = updates.flatMap((update) => {
    const name = participants.find((p) => p.id === update.participant_id)?.display_name ?? "Someone";
    return FLAGGABLE_FIELDS.filter(({ key }) =>
      flagKeys.has(`${update.id}:${key}`)
    ).map(({ key, label }) => ({
      updateId: update.id,
      fieldKey: key,
      name,
      label,
      value: update[key] as string | null,
    }));
  });

  return (
    <div className="rounded-2xl bg-ember-light p-4 dark:bg-ember/15">
      <p className="font-heading text-lg font-bold text-ember">
        🚩 Flagged for discussion ({items.length})
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <li key={`${item.updateId}:${item.fieldKey}`} className="text-sm">
            <span className="font-semibold text-ardesia dark:text-marmol">
              {item.name} · {item.label}:
            </span>{" "}
            <span className="text-ardesia dark:text-marmol">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
