import { FLAGGABLE_FIELDS, formatOffers, type ReactionRow } from "@/components/RevealGrid";
import type { UpdateFields } from "@/components/WritingForm";

type ParticipantRow = {
  id: string;
  display_name: string;
};

type UpdateRow = UpdateFields & {
  id: string;
  participant_id: string;
  submitted_at: string | null;
};

const FLAG_FIELDS: { key: keyof UpdateFields; label: string }[] = [
  { key: "offers_made", label: "Offers made" },
  ...FLAGGABLE_FIELDS,
];

export function AgendaPanel({
  participants,
  updates,
  reactions,
}: {
  participants: ParticipantRow[];
  updates: UpdateRow[];
  reactions: ReactionRow[];
}) {
  const submitted = updates.filter((u) => u.submitted_at);
  const nameFor = (participantId: string) =>
    participants.find((p) => p.id === participantId)?.display_name ?? "Someone";

  const offersClosed = submitted
    .map((u) => ({ name: nameFor(u.participant_id), text: formatOffers(u.offers_closed, u.offers_closed_note) }))
    .filter((item): item is { name: string; text: string } => item.text !== null);

  const rolesOpened = submitted
    .map((u) => ({ name: nameFor(u.participant_id), text: u.roles_opened }))
    .filter((item): item is { name: string; text: string } => !!item.text);

  const flagKeys = new Set(
    reactions
      .filter((r) => r.target_type === "field" && r.emoji === "🚩" && r.field_key)
      .map((r) => `${r.target_update_id}:${r.field_key}`)
  );

  const flagged = submitted.flatMap((u) =>
    FLAG_FIELDS.filter(({ key }) => flagKeys.has(`${u.id}:${key}`)).map(({ key, label }) => ({
      itemKey: `${u.id}:${key}`,
      name: nameFor(u.participant_id),
      label,
      value:
        key === "offers_made"
          ? formatOffers(u.offers_made, u.offers_made_note)
          : (u[key] as string | null),
    }))
  );

  if (offersClosed.length === 0 && rolesOpened.length === 0 && flagged.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <AgendaSection
        title="💰 Offers closed"
        items={offersClosed.map((i) => `${i.name}: ${i.text}`)}
      />
      <AgendaSection
        title="🧭 New roles opened"
        items={rolesOpened.map((i) => `${i.name}: ${i.text}`)}
      />

      {flagged.length > 0 && (
        <div className="rounded-2xl bg-ember-light p-4 dark:bg-ember/15">
          <p className="font-heading text-lg font-bold text-ember">
            🚩 Flagged for discussion ({flagged.length})
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {flagged.map((item) => (
              <li key={item.itemKey} className="text-sm">
                <span className="font-semibold text-ardesia dark:text-marmol">
                  {item.name} · {item.label}:
                </span>{" "}
                <span className="text-ardesia dark:text-marmol">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AgendaSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-marmol bg-marmol/40 p-4 dark:border-white/15 dark:bg-white/5">
      <p className="font-heading text-lg font-bold text-ardesia dark:text-marmol">
        {title}
      </p>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-ardesia dark:text-marmol">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
