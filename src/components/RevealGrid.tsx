"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { UpdateFields } from "@/components/WritingForm";
import { AlertIcon, FlagIcon } from "@/components/Icons";
import { ClampedText } from "@/components/ClampedText";
import { isMeaningful, isShown } from "@/lib/updates";

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

// Reaction emoji stored in the reactions table: a flag raises a topic for
// discussion; a check marks it as discussed (facilitator only).
export const FLAG_EMOJI = "🚩";
export const DISCUSSED_EMOJI = "✅";

export function formatOffers(value: number | null, note: string | null): string | null {
  if (value === null) return null;
  return note ? `${value} · ${note}` : `${value}`;
}

export const FLAGGABLE_FIELDS: { key: keyof UpdateFields; label: string }[] = [
  { key: "roles_opened", label: "New roles opened" },
  { key: "top_priorities", label: "Top priorities of the week" },
  { key: "need_brain_on", label: "Blocked or struggling" },
  { key: "anything_else", label: "Cool or valuable to share" },
];

// Cards cascade in after the agenda has landed (see .arrive in globals.css).
const CARD_BASE_DELAY_MS = 320;
const CARD_STAGGER_MS = 70;
const CARD_MAX_DELAY_MS = 560;

export function RevealGrid({
  participants,
  updates,
  reactions,
  myParticipantId,
  onToggleFlag,
  readOnly = false,
  animate = false,
}: {
  participants: ParticipantRow[];
  updates: UpdateRow[];
  reactions: ReactionRow[];
  myParticipantId: string;
  onToggleFlag: (updateId: string, fieldKey: string) => void;
  readOnly?: boolean;
  animate?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {participants.map((p, index) => {
        const update = updates.find((u) => u.participant_id === p.id);
        return (
          <UpdateCard
            key={p.id}
            name={p.display_name}
            update={update}
            reactions={update ? reactions.filter((r) => r.target_update_id === update.id) : []}
            myParticipantId={myParticipantId}
            onToggleFlag={onToggleFlag}
            readOnly={readOnly}
            enterDelayMs={
              animate
                ? Math.min(CARD_BASE_DELAY_MS + index * CARD_STAGGER_MS, CARD_MAX_DELAY_MS)
                : null
            }
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
  readOnly,
  enterDelayMs,
}: {
  name: string;
  update: UpdateRow | undefined;
  reactions: ReactionRow[];
  myParticipantId: string;
  onToggleFlag: (updateId: string, fieldKey: string) => void;
  readOnly: boolean;
  enterDelayMs: number | null;
}) {
  const arriveClass = enterDelayMs === null ? "" : "arrive";
  const arriveStyle: CSSProperties | undefined =
    enterDelayMs === null
      ? undefined
      : ({ "--arrive-delay": `${enterDelayMs}ms` } as CSSProperties);

  if (!update || !isShown(update)) {
    return (
      <article
        style={arriveStyle}
        aria-label={`${name}: no update this week`}
        className={`rounded-2xl border border-grafite/20 p-5 dark:border-white/15 ${arriveClass}`}
      >
        <h3 className="font-heading text-xl font-bold text-ardesia dark:text-marmol">
          {name}
        </h3>
        <p className="mt-2 text-sm text-grafite dark:text-marmol/70">
          No update this week.
        </p>
      </article>
    );
  }

  const lateDraft = !update.submitted_at;

  const flagsFor = (key: string) =>
    reactions.filter(
      (r) => r.target_type === "field" && r.field_key === key && r.emoji === FLAG_EMOJI
    );
  // Offers closed lives on the agenda, so the card only carries Offers out, and only
  // when there is something to discuss.
  const hasOffers = !!update.offers_made;

  return (
    <article
      style={arriveStyle}
      aria-label={`${name}'s update`}
      className={`min-w-0 rounded-2xl border border-grafite/20 p-5 dark:border-white/15 ${arriveClass}`}
    >
      <div className="flex items-center gap-2">
        <h3 className="font-heading text-xl font-bold text-ardesia dark:text-marmol">
          {name}
        </h3>
      </div>
      {lateDraft && (
        <p className="mt-1 text-sm text-grafite dark:text-marmol/70">
          Draft. Saved, but not submitted.
        </p>
      )}

      {hasOffers && (
        <div className="mt-4">
          <Stat
            label="Offers out"
            value={update.offers_made}
            note={update.offers_made_note}
            subject={name}
            flag={{
              count: flagsFor("offers_made").length,
              flaggedByMe: flagsFor("offers_made").some(
                (r) => r.participant_id === myParticipantId
              ),
              readOnly,
              onToggle: () => onToggleFlag(update.id, "offers_made"),
            }}
          />
        </div>
      )}

      {!hasOffers && !FLAGGABLE_FIELDS.some(({ key }) => isMeaningful(update[key] as string | null)) && (
        <p className="mt-2 text-base text-grafite dark:text-marmol/80">
          Nothing else to discuss this week.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {FLAGGABLE_FIELDS.map(({ key, label }) => (
          <Field
            key={key}
            icon={key === "need_brain_on" ? <AlertIcon className="size-4 shrink-0 text-ember-ink" /> : undefined}
            label={label}
            subject={name}
            value={update[key] as string | null}
            count={flagsFor(key).length}
            flaggedByMe={flagsFor(key).some((r) => r.participant_id === myParticipantId)}
            readOnly={readOnly}
            onToggleFlag={() => onToggleFlag(update.id, key)}
          />
        ))}
      </div>
    </article>
  );
}

// A labelled, keyboard-reachable control, not a faint glyph: flagging is how the
// agenda gets built, so it has to be findable and easy to hit.
function FlagButton({
  label,
  subject,
  count,
  flaggedByMe,
  readOnly,
  onToggle,
}: {
  label: string;
  subject: string;
  count: number;
  flaggedByMe: boolean;
  readOnly: boolean;
  onToggle: () => void;
}) {
  const [justAdded, setJustAdded] = useState(false);
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (cueTimer.current) clearTimeout(cueTimer.current);
    },
    []
  );

  if (readOnly) {
    if (count === 0) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ember-ink">
        <FlagIcon filled className="size-3.5" />
        {count}
        <span className="sr-only"> flagged for discussion</span>
      </span>
    );
  }

  function handleClick() {
    if (!flaggedByMe) {
      setJustAdded(true);
      if (cueTimer.current) clearTimeout(cueTimer.current);
      cueTimer.current = setTimeout(() => setJustAdded(false), 2500);
    }
    onToggle();
  }

  return (
    <span className="relative inline-flex">
    {justAdded && (
      <span
        role="status"
        className="arrive pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-lg bg-ember-fill px-2.5 py-1 text-sm font-semibold text-white shadow-[0_4px_12px_-4px_rgba(46,43,43,0.4)]"
      >
        Added to agenda
      </span>
    )}
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={flaggedByMe}
      aria-label={`Flag ${subject}’s “${label}” for discussion`}
      title="Flag for discussion"
      className={`inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-lg px-1.5 text-sm font-semibold transition max-sm:min-h-11 max-sm:min-w-11 ${
        flaggedByMe
          ? "bg-ember-ink/10 text-ember-ink"
          : count > 0
          ? "text-ember-ink hover:bg-ember-ink/10"
          : "text-grafite hover:bg-ember-ink/10 hover:text-ember-ink dark:text-marmol/70"
      }`}
    >
      <FlagIcon filled={flaggedByMe} className="size-4" />
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
    </span>
  );
}

function Stat({
  label,
  subject,
  value,
  note,
  flag,
}: {
  label: string;
  subject?: string;
  value: number | null;
  note: string | null;
  flag?: {
    count: number;
    flaggedByMe: boolean;
    readOnly: boolean;
    onToggle: () => void;
  };
}) {
  return (
    <div>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <p className="text-sm font-semibold text-grafite dark:text-marmol/80">
          {label}
        </p>
        {flag && value !== null && (
          <FlagButton
            label={label}
            subject={subject ?? ""}
            count={flag.count}
            flaggedByMe={flag.flaggedByMe}
            readOnly={flag.readOnly}
            onToggle={flag.onToggle}
          />
        )}
      </div>
      {value === null ? (
        <p className="text-grafite dark:text-marmol/60" aria-label={`${label}: none entered`}>
          —
        </p>
      ) : (
        <p className="text-lg tabular-nums [overflow-wrap:anywhere] text-ardesia dark:text-marmol">
          {value}
          {note && <span> · {note}</span>}
        </p>
      )}
    </div>
  );
}

function Field({
  icon,
  label,
  subject,
  value,
  count,
  flaggedByMe,
  readOnly,
  onToggleFlag,
}: {
  icon?: ReactNode;
  label: string;
  subject: string;
  value: string | null;
  count: number;
  flaggedByMe: boolean;
  readOnly: boolean;
  onToggleFlag: () => void;
}) {
  if (!isMeaningful(value)) return null;

  return (
    <div>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-grafite dark:text-marmol/80">
          {icon}
          {label}
        </p>
        <FlagButton
          label={label}
          subject={subject}
          count={count}
          flaggedByMe={flaggedByMe}
          readOnly={readOnly}
          onToggle={onToggleFlag}
        />
      </div>
      <ClampedText
        lines={3}
        label={`${subject}’s “${label}”`}
        className="whitespace-pre-line text-lg [overflow-wrap:anywhere] text-ardesia dark:text-marmol"
      >
        {value}
      </ClampedText>
    </div>
  );
}
