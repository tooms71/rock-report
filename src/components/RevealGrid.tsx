"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { UpdateFields } from "@/components/WritingForm";
import { HiveIcon, SparkIcon, TopicsIcon, TrendIcon, UpvoteIcon } from "@/components/Icons";
import { ClampedText } from "@/components/ClampedText";
import { ANOMALIES_KEY, HIVE_MIND_KEY, COOL_KEY } from "@/lib/fields";
import { RoleStatusBadge } from "@/components/RoleStatusBadge";
import { roleFieldKey, type RoleUpdateRow } from "@/lib/roleStatus";
import { Reactions, type Social } from "@/components/Reactions";
import { WINS_KEY } from "@/lib/social";
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

// Reaction emoji stored in the reactions table. The flag emoji is how an upvote is stored
// (the screens call it an upvote); the check marks a topic as discussed (facilitator only).
export const FLAG_EMOJI = "🚩";
export const DISCUSSED_EMOJI = "✅";

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
  roleUpdates = [],
  social,
}: {
  participants: ParticipantRow[];
  updates: UpdateRow[];
  reactions: ReactionRow[];
  myParticipantId: string;
  onToggleFlag: (updateId: string, fieldKey: string) => void;
  readOnly?: boolean;
  animate?: boolean;
  roleUpdates?: RoleUpdateRow[];
  social?: Social;
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
            roles={roleUpdates.filter((r) => r.participant_id === p.id)}
            social={social}
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
  roles,
  social,
  myParticipantId,
  onToggleFlag,
  readOnly,
  enterDelayMs,
}: {
  name: string;
  update: UpdateRow | undefined;
  reactions: ReactionRow[];
  roles: RoleUpdateRow[];
  social?: Social;
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

  if (!update || !isShown(update, roles.length > 0)) {
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

  const votesFor = (key: string) =>
    reactions.filter(
      (r) => r.target_type === "field" && r.field_key === key && r.emoji === FLAG_EMOJI
    );
  const upvote = (key: string) => ({
    count: votesFor(key).length,
    byMe: votesFor(key).some((r) => r.participant_id === myParticipantId),
    readOnly,
    onToggle: () => onToggleFlag(update.id, key),
  });

  // Everything someone wrote, in the order the agenda reads it out. Only the hive mind,
  // anomalies and worth-sharing boxes can be upvoted; the rest is read out as written.
  const rows: {
    label: string;
    value: string | null;
    icon?: ReactNode;
    upvoteKey?: string;
  }[] = [
    { label: "Wins", value: update.wins },
    { label: "New roles opened", value: update.roles_opened },
    {
      label: "Topics to add",
      value: update.facilitator_topics,
      icon: <TopicsIcon className="size-4 shrink-0 text-ember-ink" />,
    },
    {
      label: "Hive mind",
      value: update.need_brain_on,
      icon: <HiveIcon className="size-4 shrink-0 text-ember-ink" />,
      upvoteKey: HIVE_MIND_KEY,
    },
    {
      label: "Anomalies and trends",
      value: update.anomalies,
      icon: <TrendIcon className="size-4 shrink-0 text-ember-ink" />,
      upvoteKey: ANOMALIES_KEY,
    },
    {
      label: "Worth sharing",
      value: update.anything_else,
      icon: <SparkIcon className="size-4 shrink-0 text-ember-ink" />,
      upvoteKey: COOL_KEY,
    },
  ];
  const filled = rows.filter((row) => isMeaningful(row.value));
  const hasAnything = filled.length > 0 || roles.length > 0;

  return (
    <article
      style={arriveStyle}
      aria-label={`${name}'s update`}
      className={`min-w-0 rounded-2xl border border-grafite/20 p-5 dark:border-white/15 ${arriveClass}`}
    >
      <h3 className="font-heading text-xl font-bold text-ardesia dark:text-marmol">{name}</h3>
      {lateDraft && (
        <p className="mt-1 text-sm text-grafite dark:text-marmol/70">
          Draft. Saved, but not submitted.
        </p>
      )}

      {!hasAnything ? (
        <p className="mt-2 text-base text-grafite dark:text-marmol/80">Nothing this week.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {roles.length > 0 && (
            <div>
              <p className="flex min-h-8 items-center text-sm font-semibold text-grafite dark:text-marmol/80">
                Open roles
              </p>
              <ul className="flex flex-col gap-3">
                {roles.map((role) => (
                  <li key={role.id}>
                    <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base text-ardesia [overflow-wrap:anywhere] dark:text-marmol">
                        {role.role_title}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 text-sm text-grafite dark:text-marmol/80">
                        <RoleStatusBadge status={role.status} />
                        {role.status === "stalled" && role.discuss && (
                          <span className="font-semibold text-ember-ink">On the agenda</span>
                        )}
                        {role.note && <span className="[overflow-wrap:anywhere]">{role.note}</span>}
                      </p>
                    </div>
                    {role.status === "stalled" && role.discuss && (
                      <UpvoteButton
                        label="Stalled role"
                        subject={name}
                        {...upvote(roleFieldKey(role.notion_page_id))}
                      />
                    )}
                    </div>
                    {social &&
                      (role.status === "offer_accepted" ||
                        (role.status === "stalled" && role.discuss)) && (
                        <div>
                          <Reactions
                            updateId={update.id}
                            fieldKey={roleFieldKey(role.notion_page_id)}
                            reactions={reactions}
                            social={social}
                            emoji={role.status === "offer_accepted"}
                            comments={role.status === "stalled"}
                          />
                        </div>
                      )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {filled.map((row) => (
            <Field
              key={row.label}
              icon={row.icon}
              label={row.label}
              subject={name}
              value={row.value}
              upvote={row.upvoteKey ? upvote(row.upvoteKey) : undefined}
            >
              {social && row.label === "Wins" && (
                <Reactions
                  updateId={update.id}
                  fieldKey={WINS_KEY}
                  reactions={reactions}
                  social={social}
                  emoji
                  comments
                />
              )}
              {social && row.upvoteKey && (
                <Reactions
                  updateId={update.id}
                  fieldKey={row.upvoteKey}
                  reactions={reactions}
                  social={social}
                  comments
                />
              )}
            </Field>
          ))}
        </div>
      )}
    </article>
  );
}

// An upvote control: a small up arrow with its count, filled once you have voted. Only
// the hive mind and anything-cool boxes get one.
function UpvoteButton({
  label,
  subject,
  count,
  byMe,
  readOnly,
  onToggle,
}: {
  label: string;
  subject: string;
  count: number;
  byMe: boolean;
  readOnly: boolean;
  onToggle: () => void;
}) {
  const [justVoted, setJustVoted] = useState(false);
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
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-ember-ink">
        <UpvoteIcon filled className="size-3.5" />
        {count}
        <span className="sr-only"> {count === 1 ? "upvote" : "upvotes"}</span>
      </span>
    );
  }

  function handleClick() {
    if (!byMe) {
      setJustVoted(true);
      if (cueTimer.current) clearTimeout(cueTimer.current);
      cueTimer.current = setTimeout(() => setJustVoted(false), 2500);
    }
    onToggle();
  }

  return (
    <span className="relative inline-flex">
      {justVoted && (
        <span
          role="status"
          className="arrive pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-lg bg-ember-fill px-2.5 py-1 text-sm font-semibold text-white shadow-[0_4px_12px_-4px_rgba(46,43,43,0.4)]"
        >
          Upvoted
        </span>
      )}
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={byMe}
        aria-label={`Upvote ${subject}’s ${label}`}
        title="Upvote"
        className={`inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-lg px-1.5 text-sm font-semibold transition max-sm:min-h-11 max-sm:min-w-11 ${
          byMe
            ? "bg-ember-ink/10 text-ember-ink"
            : count > 0
            ? "text-ember-ink hover:bg-ember-ink/10"
            : "text-grafite hover:bg-ember-ink/10 hover:text-ember-ink dark:text-marmol/70"
        }`}
      >
        <UpvoteIcon filled={byMe} className="size-4" />
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </button>
    </span>
  );
}

function Field({
  icon,
  label,
  subject,
  value,
  upvote,
  children,
}: {
  icon?: ReactNode;
  label: string;
  subject: string;
  value: string | null;
  upvote?: { count: number; byMe: boolean; readOnly: boolean; onToggle: () => void };
  children?: ReactNode;
}) {
  if (!isMeaningful(value)) return null;

  return (
    <div>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-grafite dark:text-marmol/80">
          {icon}
          {label}
        </p>
        {upvote && <UpvoteButton label={label} subject={subject} {...upvote} />}
      </div>
      <ClampedText
        lines={3}
        label={`${subject}’s ${label}`}
        className="whitespace-pre-line text-lg [overflow-wrap:anywhere] text-ardesia dark:text-marmol"
      >
        {value}
      </ClampedText>
      {children}
    </div>
  );
}
