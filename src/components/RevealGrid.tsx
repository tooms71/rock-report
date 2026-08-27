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

export type ReactionRow = {
  id: string;
  target_type: string;
  target_update_id: string;
  field_key: string | null;
  emoji: string;
  participant_id: string;
};

export function formatOffers(value: number | null, note: string | null): string | null {
  if (value === null) return null;
  return note ? `${value} · ${note}` : `${value}`;
}

export const FLAGGABLE_FIELDS: {
  key: keyof UpdateFields;
  label: string;
  emoji?: string;
}[] = [
  { key: "roles_opened", label: "New roles opened" },
  { key: "learned_or_surprised", label: "Something learned / surprised", emoji: "💡" },
  { key: "need_brain_on", label: "Where I could use a brain", emoji: "🧠" },
  { key: "anything_else", label: "Anything else?" },
];

export function RevealGrid({
  participants,
  updates,
  reactions,
  myParticipantId,
  onToggleFlag,
}: {
  participants: ParticipantRow[];
  updates: UpdateRow[];
  reactions: ReactionRow[];
  myParticipantId: string;
  onToggleFlag: (updateId: string, fieldKey: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {participants.map((p) => {
        const update = updates.find((u) => u.participant_id === p.id);
        return (
          <UpdateCard
            key={p.id}
            name={p.display_name}
            update={update}
            reactions={update ? reactions.filter((r) => r.target_update_id === update.id) : []}
            myParticipantId={myParticipantId}
            onToggleFlag={onToggleFlag}
          />
        );
      })}
    </div>
  );
}

function UpdateCard({
  name,
  update,
  reactions,
  myParticipantId,
  onToggleFlag,
}: {
  name: string;
  update: UpdateRow | undefined;
  reactions: ReactionRow[];
  myParticipantId: string;
  onToggleFlag: (updateId: string, fieldKey: string) => void;
}) {
  if (!update || !update.submitted_at) {
    return (
      <div className="rounded-2xl border border-marmol p-5 dark:border-white/15">
        <p className="font-heading text-xl font-bold text-ardesia dark:text-marmol">
          {name}
        </p>
        <p className="mt-2 text-sm text-grafite dark:text-marmol/70">
          Didn&apos;t submit an update this week.
        </p>
      </div>
    );
  }

  const hasOffers = update.offers_made !== null || update.offers_closed !== null;
  const flagCount = reactions.filter(
    (r) => r.target_type === "field" && r.emoji === "🚩"
  ).length;

  return (
    <div className="rounded-2xl border border-marmol bg-marmol/60 p-5 dark:border-white/15 dark:bg-white/8">
      <div className="flex items-center gap-2">
        <p className="font-heading text-xl font-bold text-ardesia dark:text-marmol">
          {name}
        </p>
        {flagCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-ember px-2 py-0.5 text-xs font-semibold text-white">
            🚩 {flagCount}
          </span>
        )}
      </div>

      {hasOffers && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat
            label="Offers closed"
            value={update.offers_closed}
            note={update.offers_closed_note}
          />
          <Stat
            label="Offers made"
            value={update.offers_made}
            note={update.offers_made_note}
            flag={{
              reactions: reactions.filter(
                (r) => r.target_type === "field" && r.field_key === "offers_made"
              ),
              myParticipantId,
              onToggleFlag: () => onToggleFlag(update.id, "offers_made"),
            }}
          />
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {FLAGGABLE_FIELDS.map(({ key, label, emoji }) => (
          <Field
            key={key}
            label={emoji ? `${emoji} ${label}` : label}
            value={update[key] as string | null}
            reactions={reactions.filter(
              (r) => r.target_type === "field" && r.field_key === key
            )}
            myParticipantId={myParticipantId}
            onToggleFlag={() => onToggleFlag(update.id, key)}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  flag,
}: {
  label: string;
  value: number | null;
  note: string | null;
  flag?: {
    reactions: ReactionRow[];
    myParticipantId: string;
    onToggleFlag: () => void;
  };
}) {
  if (value === null) return null;

  const flagCount = flag?.reactions.length ?? 0;
  const flaggedByMe =
    flag?.reactions.some((r) => r.participant_id === flag.myParticipantId) ?? false;

  return (
    <div
      className={
        flagCount > 0 ? "rounded-lg bg-ember-light p-2 dark:bg-ember/15" : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-grafite dark:text-marmol/70">
          {label}
        </p>
        {flag && (
          <button
            onClick={flag.onToggleFlag}
            title="Flag for discussion"
            className={`flex shrink-0 items-center gap-0.5 rounded px-1 text-xs transition ${
              flaggedByMe
                ? "text-ember"
                : "text-grafite/50 hover:text-ember dark:text-marmol/40"
            }`}
          >
            🚩{flagCount > 0 && <span className="tabular-nums">{flagCount}</span>}
          </button>
        )}
      </div>
      <p className="tabular-nums text-ardesia dark:text-marmol">
        {value}
        {note && <span className="text-grafite dark:text-marmol/80"> · {note}</span>}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  reactions,
  myParticipantId,
  onToggleFlag,
}: {
  label: string;
  value: string | null;
  reactions: ReactionRow[];
  myParticipantId: string;
  onToggleFlag: () => void;
}) {
  if (!value) return null;

  const flagCount = reactions.length;
  const flaggedByMe = reactions.some((r) => r.participant_id === myParticipantId);

  return (
    <div
      className={
        flagCount > 0
          ? "rounded-lg bg-ember-light p-2 dark:bg-ember/15"
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-grafite dark:text-marmol/70">
          {label}
        </p>
        <button
          onClick={onToggleFlag}
          title="Flag for discussion"
          className={`flex shrink-0 items-center gap-0.5 rounded px-1 text-xs transition ${
            flaggedByMe
              ? "text-ember"
              : "text-grafite/50 hover:text-ember dark:text-marmol/40"
          }`}
        >
          🚩{flagCount > 0 && <span className="tabular-nums">{flagCount}</span>}
        </button>
      </div>
      <p className="text-ardesia dark:text-marmol">{value}</p>
    </div>
  );
}
