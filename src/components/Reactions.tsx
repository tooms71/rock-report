"use client";

import { useState } from "react";
import { ChevronIcon, CommentIcon } from "@/components/Icons";
import type { ReactionRow } from "@/components/RevealGrid";
import { MAX_COMMENT_LENGTH, WIN_EMOJIS, type CommentRow } from "@/lib/social";
import { inputClass } from "@/lib/ui";

export type Social = {
  comments: CommentRow[];
  nameOf: (participantId: string) => string;
  myParticipantId: string;
  // Reading and the meeting are open to reactions; a closed session is read-only.
  canReact: boolean;
  onToggleEmoji?: (updateId: string, fieldKey: string, emoji: string) => void;
  onAddComment?: (updateId: string, fieldKey: string, body: string) => Promise<boolean>;
};

// Emoji reactions and/or a folded comment thread under one thing someone wrote (a win, an
// accepted offer, a hive mind request...). Both are keyed by the person's update plus the
// field, and arrive live, so people can react while items are being read out.
export function Reactions({
  updateId,
  fieldKey,
  reactions,
  social,
  emoji = false,
  comments: withComments = false,
}: {
  updateId: string;
  fieldKey: string;
  reactions: ReactionRow[];
  social: Social;
  // Which of the two this item gets: wins get both, accepted offers just emoji, hive mind
  // and the other boxes just comments.
  emoji?: boolean;
  comments?: boolean;
}) {
  // Comments stay folded until someone opens them, so the agenda stays short.
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const mine = reactions.filter(
    (r) => r.target_type === "field" && r.target_update_id === updateId && r.field_key === fieldKey
  );
  const comments = social.comments
    .filter((c) => c.target_update_id === updateId && c.field_key === fieldKey)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const canReact = emoji && social.canReact && !!social.onToggleEmoji;
  const canComment = withComments && social.canReact && !!social.onAddComment;

  const chips = emoji
    ? WIN_EMOJIS.map(({ emoji: symbol, label }) => {
        const rows = mine.filter((r) => r.emoji === symbol);
        return {
          emoji: symbol,
          label,
          count: rows.length,
          byMe: rows.some((r) => r.participant_id === social.myParticipantId),
        };
      }).filter((chip) => canReact || chip.count > 0)
    : [];

  const showComments = canComment || (withComments && comments.length > 0);
  if (chips.length === 0 && !showComments) return null;

  async function send() {
    const body = draft.trim();
    if (!body || sending || !social.onAddComment) return;
    setSending(true);
    const ok = await social.onAddComment(updateId, fieldKey, body);
    setSending(false);
    if (ok) setDraft("");
  }

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map(({ emoji, label, count, byMe }) =>
          canReact ? (
            <button
              key={emoji}
              type="button"
              aria-pressed={byMe}
              aria-label={`${label}${count > 0 ? `, ${count}` : ""}`}
              onClick={() => social.onToggleEmoji?.(updateId, fieldKey, emoji)}
              className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-sm font-semibold tabular-nums transition max-sm:min-h-11 ${
                byMe
                  ? "border-ember-ink bg-ember-ink/10 text-ember-ink"
                  : "border-grafite/30 text-grafite hover:border-ember-ink dark:border-white/25 dark:text-marmol/80"
              }`}
            >
              <span aria-hidden="true">{emoji}</span>
              {count > 0 && count}
            </button>
          ) : (
            <span
              key={emoji}
              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-grafite/30 px-2.5 text-sm font-semibold tabular-nums text-grafite dark:border-white/25 dark:text-marmol/80"
            >
              <span aria-hidden="true">{emoji}</span>
              {count}
              <span className="sr-only">{label}</span>
            </span>
          )
        )}
        {showComments && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-grafite transition hover:text-ember-ink max-sm:min-h-11 dark:text-marmol/80"
          >
            <CommentIcon className="size-4" />
            {comments.length === 0
              ? "Comment"
              : `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`}
            <ChevronIcon className="size-4" open={open} />
          </button>
        )}
      </div>

      {showComments && open && (
        <div className="flex flex-col gap-2">
          {comments.length > 0 && (
            <ul className="flex flex-col gap-1" aria-label="Comments">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="text-sm text-ardesia [overflow-wrap:anywhere] dark:text-marmol"
                >
                  <span className="font-semibold">{social.nameOf(c.participant_id)}</span>
                  <span className="text-grafite dark:text-marmol/70"> · </span>
                  {c.body}
                </li>
              ))}
            </ul>
          )}
          {canComment && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                type="text"
                aria-label="Add a comment"
                placeholder="Add a comment"
                autoFocus
                maxLength={MAX_COMMENT_LENGTH}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className={`min-w-0 flex-1 ${inputClass}`}
              />
              <button
                type="submit"
                disabled={sending || draft.trim() === ""}
                className="min-h-11 shrink-0 rounded-lg bg-ember-fill px-3 text-sm font-semibold text-white transition disabled:opacity-50"
              >
                Post
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
