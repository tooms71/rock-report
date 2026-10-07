import type { CSSProperties } from "react";
import {
  DISCUSSED_EMOJI,
  FLAG_EMOJI,
  FLAGGABLE_FIELDS,
  formatOffers,
  type ReactionRow,
} from "@/components/RevealGrid";
import { CheckIcon, FlagIcon } from "@/components/Icons";
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
  { key: "offers_made", label: "Offers out" },
  ...FLAGGABLE_FIELDS,
];

// The meeting's agenda: what closed, what opened, then everything the team flagged.
// This is the reason the reveal exists, so it gets the most presence on the page.
export function AgendaPanel({
  participants,
  updates,
  reactions,
  canMarkDiscussed = false,
  onToggleDiscussed,
  animate = false,
}: {
  participants: ParticipantRow[];
  updates: UpdateRow[];
  reactions: ReactionRow[];
  canMarkDiscussed?: boolean;
  onToggleDiscussed?: (updateId: string, fieldKey: string) => void;
  animate?: boolean;
}) {
  const submitted = updates.filter((u) => u.submitted_at);
  const nameFor = (participantId: string) =>
    participants.find((p) => p.id === participantId)?.display_name ?? "Someone";

  const offersClosed = submitted
    .map((u) => ({
      id: u.id,
      name: nameFor(u.participant_id),
      text: formatOffers(u.offers_closed, u.offers_closed_note),
    }))
    .filter((item): item is { id: string; name: string; text: string } => item.text !== null);

  const rolesOpened = submitted
    .map((u) => ({ id: u.id, name: nameFor(u.participant_id), text: u.roles_opened }))
    .filter((item): item is { id: string; name: string; text: string } => !!item.text);

  const keyOf = (r: ReactionRow) => `${r.target_update_id}:${r.field_key}`;
  const flagKeys = new Set(
    reactions
      .filter((r) => r.target_type === "field" && r.emoji === FLAG_EMOJI && r.field_key)
      .map(keyOf)
  );
  const discussedKeys = new Set(
    reactions
      .filter((r) => r.target_type === "field" && r.emoji === DISCUSSED_EMOJI && r.field_key)
      .map(keyOf)
  );

  const flagged = submitted
    .flatMap((u) =>
      FLAG_FIELDS.filter(({ key }) => flagKeys.has(`${u.id}:${key}`)).map(({ key, label }) => ({
        itemKey: `${u.id}:${key}`,
        updateId: u.id,
        fieldKey: key as string,
        name: nameFor(u.participant_id),
        label,
        value:
          key === "offers_made"
            ? formatOffers(u.offers_made, u.offers_made_note)
            : (u[key] as string | null),
        discussed: discussedKeys.has(`${u.id}:${key}`),
      }))
    )
    // Open items first; discussed ones sink to the bottom once the group moves on.
    .sort((a, b) => Number(a.discussed) - Number(b.discussed));

  if (offersClosed.length === 0 && rolesOpened.length === 0 && flagged.length === 0) {
    return null;
  }

  const remaining = flagged.filter((f) => !f.discussed).length;
  const hasInfo = offersClosed.length > 0 || rolesOpened.length > 0;

  return (
    <section
      aria-labelledby="agenda-heading"
      className={`rounded-3xl border border-marmol bg-marmol/50 p-6 sm:p-8 dark:border-white/15 dark:bg-white/8 ${
        animate ? "arrive" : ""
      }`}
      style={animate ? ({ "--arrive-delay": "140ms" } as CSSProperties) : undefined}
    >
      <h2
        id="agenda-heading"
        className="font-heading text-3xl font-bold text-ardesia dark:text-marmol"
      >
        Agenda
      </h2>

      <div
        className={`mt-6 grid gap-8 ${
          hasInfo && flagged.length > 0 ? "md:grid-cols-[1fr_1.4fr] md:gap-12" : ""
        }`}
      >
        {hasInfo && (
          <div className="flex flex-col gap-7">
            <AgendaGroup title="Offers closed" icon="💰" items={offersClosed} />
            <AgendaGroup title="New roles opened" icon="🧭" items={rolesOpened} />
          </div>
        )}

        {flagged.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-ember-ink">
              <FlagIcon filled className="size-5" />
              Flagged for discussion
            </h3>
            <p className="mt-1 text-sm text-grafite dark:text-marmol/70">
              {remaining === 0
                ? "All discussed."
                : `${remaining} left to discuss`}
            </p>
            <ol className="mt-4 flex flex-col gap-5">
              {flagged.map((item, index) => (
                <li key={item.itemKey} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 w-6 shrink-0 text-right font-heading text-lg font-bold tabular-nums text-grafite dark:text-marmol/60"
                  >
                    {index + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        item.discussed
                          ? "text-grafite dark:text-marmol/60"
                          : "text-ardesia dark:text-marmol"
                      }`}
                    >
                      {item.name} · {item.label}
                    </p>
                    <p
                      className={`whitespace-pre-line ${
                        item.discussed
                          ? "text-grafite line-through decoration-1 dark:text-marmol/60"
                          : "text-ardesia dark:text-marmol"
                      }`}
                    >
                      {item.value}
                    </p>
                    {(canMarkDiscussed || item.discussed) && (
                      <div className="mt-2">
                        {canMarkDiscussed && onToggleDiscussed ? (
                          <button
                            type="button"
                            onClick={() => onToggleDiscussed(item.updateId, item.fieldKey)}
                            aria-pressed={item.discussed}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-grafite/30 px-2.5 text-xs font-semibold text-grafite transition hover:border-ember-ink hover:text-ember-ink max-sm:min-h-11 dark:border-white/25 dark:text-marmol/80"
                          >
                            <CheckIcon className="size-3.5" />
                            {item.discussed ? "Discussed. Undo" : "Mark discussed"}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-grafite dark:text-marmol/70">
                            <CheckIcon className="size-3.5" />
                            Discussed
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

function AgendaGroup({
  title,
  icon,
  items,
}: {
  title: string;
  icon: string;
  items: { id: string; name: string; text: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="font-heading text-xl font-bold text-ardesia dark:text-marmol">
        <span aria-hidden="true">{icon} </span>
        {title}
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="text-ardesia dark:text-marmol">
            <span className="font-semibold">{item.name}</span>
            <span className="text-grafite dark:text-marmol/70"> · </span>
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
