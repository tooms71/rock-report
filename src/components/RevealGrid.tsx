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
  target_update_id: string;
  emoji: string;
  participant_id: string;
};

const REACTION_EMOJIS = ["👍", "🎉", "😂", "💡", "🚩"];

export function RevealGrid({
  participants,
  updates,
  reactions,
  myParticipantId,
  onToggleReaction,
}: {
  participants: ParticipantRow[];
  updates: UpdateRow[];
  reactions: ReactionRow[];
  myParticipantId: string;
  onToggleReaction: (updateId: string, emoji: string) => void;
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
            onToggleReaction={onToggleReaction}
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
  onToggleReaction,
}: {
  name: string;
  update: UpdateRow | undefined;
  reactions: ReactionRow[];
  myParticipantId: string;
  onToggleReaction: (updateId: string, emoji: string) => void;
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
  const isFlagged = reactions.some((r) => r.emoji === "🚩");

  return (
    <div
      className={`rounded-2xl border bg-marmol/60 p-5 dark:bg-white/8 ${
        isFlagged
          ? "border-l-4 border-ember"
          : "border-marmol dark:border-white/15"
      }`}
    >
      <p className="font-heading text-xl font-bold text-ardesia dark:text-marmol">
        {name}
      </p>

      {hasOffers && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat
            label="Offers made"
            value={update.offers_made}
            note={update.offers_made_note}
          />
          <Stat
            label="Offers closed"
            value={update.offers_closed}
            note={update.offers_closed_note}
          />
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        <Field label="New roles opened" value={update.roles_opened} />
        <Field
          label="💡 Something learned / surprised"
          value={update.learned_or_surprised}
        />
        <Field label="🧠 Where I could use a brain" value={update.need_brain_on} />
      </div>

      <ReactionBar
        updateId={update.id}
        reactions={reactions}
        myParticipantId={myParticipantId}
        onToggle={onToggleReaction}
      />
    </div>
  );
}

function ReactionBar({
  updateId,
  reactions,
  myParticipantId,
  onToggle,
}: {
  updateId: string;
  reactions: ReactionRow[];
  myParticipantId: string;
  onToggle: (updateId: string, emoji: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {REACTION_EMOJIS.map((emoji) => {
        const matching = reactions.filter((r) => r.emoji === emoji);
        const mine = matching.some((r) => r.participant_id === myParticipantId);
        const isFlag = emoji === "🚩";

        return (
          <button
            key={emoji}
            onClick={() => onToggle(updateId, emoji)}
            className={
              isFlag
                ? mine
                  ? "flex items-center gap-1 rounded-full bg-ember px-2.5 py-1 text-sm text-white transition"
                  : "flex items-center gap-1 rounded-full border border-ember/50 px-2.5 py-1 text-sm text-ember transition hover:bg-ember-light dark:hover:bg-ember/10"
                : mine
                ? "flex items-center gap-1 rounded-full bg-ardesia px-2.5 py-1 text-sm text-white transition dark:bg-marmol dark:text-ardesia"
                : "flex items-center gap-1 rounded-full border border-marmol px-2.5 py-1 text-sm text-grafite transition dark:border-white/15 dark:text-marmol/70"
            }
          >
            <span>{emoji}</span>
            {matching.length > 0 && (
              <span className="tabular-nums">{matching.length}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: number | null;
  note: string | null;
}) {
  if (value === null) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-grafite dark:text-marmol/70">
        {label}
      </p>
      <p className="tabular-nums text-ardesia dark:text-marmol">
        {value}
        {note && <span className="text-grafite dark:text-marmol/80"> · {note}</span>}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-grafite dark:text-marmol/70">
        {label}
      </p>
      <p className="text-ardesia dark:text-marmol">{value}</p>
    </div>
  );
}
