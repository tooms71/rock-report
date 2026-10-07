import type { CSSProperties, ReactNode } from "react";
import {
  DISCUSSED_EMOJI,
  FLAG_EMOJI,
  FLAGGABLE_FIELDS,
  formatOffers,
  type ReactionRow,
} from "@/components/RevealGrid";
import { CheckIcon, FlagIcon, OffersIcon, RolesIcon } from "@/components/Icons";
import { isShown } from "@/lib/updates";
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

// The meeting's agenda: what the team flagged to discuss, then what closed and what
// opened. This is the reason the reveal exists, so it leads the page, sets in larger
// type for a shared screen, and sits on its own raised surface.
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
  const shown = updates.filter((u) => isShown(u));
  const nameFor = (participantId: string) =>
    participants.find((p) => p.id === participantId)?.display_name ?? "Someone";

  const offersClosed = shown
    .map((u) => ({
      id: u.id,
      name: nameFor(u.participant_id),
      text: formatOffers(u.offers_closed, u.offers_closed_note),
    }))
    .filter((item): item is { id: string; name: string; text: string } => item.text !== null);

  const rolesOpened = shown
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

  // Order stays fixed (person, then field) so numbers never jump while the room is
  // working through the list; finished items are marked in place.
  const flagged = shown.flatMap((u) =>
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
  );

  const remaining = flagged.filter((f) => !f.discussed).length;
  const hasInfo = offersClosed.length > 0 || rolesOpened.length > 0;

  return (
    <section
      aria-labelledby="agenda-heading"
      className={`rounded-3xl border border-grafite/20 bg-white p-6 shadow-[0_1px_2px_rgba(46,43,43,0.08),0_16px_40px_-16px_rgba(46,43,43,0.25)] sm:p-8 dark:border-white/25 dark:bg-white/[0.12] dark:shadow-none ${
        animate ? "arrive" : ""
      }`}
      style={animate ? ({ "--arrive-delay": "140ms" } as CSSProperties) : undefined}
    >
      <h2
        id="agenda-heading"
        className="font-heading text-4xl font-bold text-ardesia dark:text-marmol"
      >
        Agenda
      </h2>

      <div
        className={`mt-6 grid gap-10 ${
          hasInfo ? "md:grid-cols-[1.5fr_1fr] md:gap-14" : ""
        }`}
      >
        <div>
          <h3 className="flex items-center gap-2 font-heading text-2xl font-bold text-ember-ink">
            <FlagIcon filled className="size-6" />
            Flagged for discussion
          </h3>

          {flagged.length === 0 ? (
            <p className="mt-3 text-base text-grafite dark:text-marmol/80">
              Nothing flagged yet. Use Flag on any card to add a topic here.
            </p>
          ) : (
            <>
              <p
                className={`mt-1 flex items-center gap-1.5 text-base ${
                  remaining === 0
                    ? "font-semibold text-ember-ink"
                    : "text-grafite dark:text-marmol/80"
                }`}
              >
                {remaining === 0 ? (
                  <>
                    <CheckIcon className="size-5" />
                    All discussed. Nice work.
                  </>
                ) : (
                  `${remaining} left to discuss`
                )}
              </p>
              <ol className="mt-5 flex flex-col gap-6">
                {flagged.map((item, index) => (
                  <li key={item.itemKey} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="w-8 shrink-0 text-right font-heading text-2xl font-bold tabular-nums text-grafite dark:text-marmol/60"
                    >
                      {index + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-base font-semibold ${
                          item.discussed
                            ? "text-grafite dark:text-marmol/60"
                            : "text-ardesia dark:text-marmol"
                        }`}
                      >
                        {item.name} · {item.label}
                      </p>
                      <p
                        className={`whitespace-pre-line text-lg [overflow-wrap:anywhere] sm:text-xl ${
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
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-grafite/50 px-3 text-sm font-semibold text-grafite transition hover:border-ember-ink hover:text-ember-ink max-sm:min-h-11 dark:border-white/40 dark:text-marmol/80"
                            >
                              <CheckIcon className="size-4" />
                              {item.discussed ? "Discussed. Undo" : "Mark discussed"}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-grafite dark:text-marmol/70">
                              <CheckIcon className="size-4" />
                              Discussed
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        {hasInfo && (
          <div className="flex flex-col gap-8">
            <AgendaGroup title="Offers closed" icon={<OffersIcon className="size-5" />} items={offersClosed} />
            <AgendaGroup title="New roles opened" icon={<RolesIcon className="size-5" />} items={rolesOpened} />
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
  icon: ReactNode;
  items: { id: string; name: string; text: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-ardesia dark:text-marmol">
        <span className="text-ember-ink">{icon}</span>
        {title}
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="text-base [overflow-wrap:anywhere] text-ardesia dark:text-marmol"
          >
            <span className="font-semibold">{item.name}</span>
            <span className="text-grafite dark:text-marmol/70"> · </span>
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
