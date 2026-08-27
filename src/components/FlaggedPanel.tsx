import type { ReactionRow } from "@/components/RevealGrid";

type ParticipantRow = {
  id: string;
  display_name: string;
};

type UpdateRow = {
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
  const flaggedUpdateIds = new Set(
    reactions.filter((r) => r.emoji === "🚩").map((r) => r.target_update_id)
  );

  if (flaggedUpdateIds.size === 0) return null;

  const names = updates
    .filter((u) => flaggedUpdateIds.has(u.id))
    .map((u) => participants.find((p) => p.id === u.participant_id)?.display_name ?? "Someone");

  return (
    <div className="rounded-2xl bg-ember-light p-4 dark:bg-ember/15">
      <p className="font-heading text-lg font-bold text-ember">
        🚩 Flagged for discussion ({names.length})
      </p>
      <ul className="mt-1 flex flex-col gap-0.5 text-sm text-ardesia dark:text-marmol">
        {names.map((name, i) => (
          <li key={i}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
