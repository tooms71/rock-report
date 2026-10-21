import {
  DISCUSSED_EMOJI,
  FLAG_EMOJI,
  formatOffers,
  type ReactionRow,
} from "@/components/RevealGrid";
import type { UpdateFields } from "@/components/WritingForm";
import { COOL_KEY, HIVE_MIND_KEY, UPVOTE_FIELDS } from "@/lib/fields";
import { isMeaningful, isShown } from "@/lib/updates";

export type AgendaParticipant = { id: string; display_name: string };

export type AgendaUpdate = UpdateFields & {
  id: string;
  participant_id: string;
  submitted_at: string | null;
};

export type AgendaInfoItem = { id: string; name: string; text: string };

// A topic the room can talk through: it can be upvoted and marked discussed.
export type DiscussionItem = {
  itemKey: string;
  updateId: string;
  fieldKey: string;
  name: string;
  label: string;
  value: string | null;
  discussed: boolean;
  voteCount: number;
};

// The meeting's agenda, in the order the room works through it:
//   1. wins, offers accepted, offers extended  (read out; nothing to vote on)
//   2. new roles opened                         (read out)
//   3. hive mind                                (everything people asked, most upvotes first)
//   4. anything cool                            (only what got an upvote, most first)
// Everyone is listed in the order they joined, so numbers match between the live view,
// the archive and the copied notes.
export function buildAgenda(
  participants: AgendaParticipant[],
  updates: AgendaUpdate[],
  reactions: ReactionRow[]
) {
  const joinOrder = new Map(participants.map((p, index) => [p.id, index]));
  const shown = updates
    .filter((u) => isShown(u))
    .sort(
      (a, b) =>
        (joinOrder.get(a.participant_id) ?? Infinity) -
        (joinOrder.get(b.participant_id) ?? Infinity)
    );
  const nameFor = (participantId: string) =>
    participants.find((p) => p.id === participantId)?.display_name ?? "Someone";

  const infoItems = (
    pick: (u: AgendaUpdate) => string | null | undefined
  ): AgendaInfoItem[] =>
    shown.flatMap((u) => {
      const text = pick(u);
      return text ? [{ id: u.id, name: nameFor(u.participant_id), text }] : [];
    });

  // Zero offers isn't agenda material.
  const offersAccepted = infoItems((u) =>
    u.offers_closed ? formatOffers(u.offers_closed, u.offers_closed_note) : null
  );
  const offersExtended = infoItems((u) =>
    u.offers_made ? formatOffers(u.offers_made, u.offers_made_note) : null
  );
  const offersAcceptedTotal = shown.reduce((sum, u) => sum + (u.offers_closed ?? 0), 0);
  const offersExtendedTotal = shown.reduce((sum, u) => sum + (u.offers_made ?? 0), 0);
  const wins = infoItems((u) => (isMeaningful(u.wins) ? u.wins : null));
  const rolesOpened = infoItems((u) => (isMeaningful(u.roles_opened) ? u.roles_opened : null));

  // Who upvoted each topic: several people can add to its count, but each only once.
  const keyOf = (r: ReactionRow) => `${r.target_update_id}:${r.field_key}`;
  const voters = new Map<string, Set<string>>();
  for (const r of reactions) {
    if (r.target_type !== "field" || r.emoji !== FLAG_EMOJI || !r.field_key) continue;
    const key = keyOf(r);
    if (!voters.has(key)) voters.set(key, new Set());
    voters.get(key)!.add(r.participant_id);
  }
  const discussedKeys = new Set(
    reactions
      .filter((r) => r.target_type === "field" && r.emoji === DISCUSSED_EMOJI && r.field_key)
      .map(keyOf)
  );

  const topics = (fieldKey: string, label: string, onlyUpvoted: boolean): DiscussionItem[] => {
    const items = shown.flatMap((u): DiscussionItem[] => {
      const value = u[fieldKey as typeof HIVE_MIND_KEY | typeof COOL_KEY];
      if (!isMeaningful(value)) return [];
      const itemKey = `${u.id}:${fieldKey}`;
      const voteCount = voters.get(itemKey)?.size ?? 0;
      if (onlyUpvoted && voteCount === 0) return [];
      return [
        {
          itemKey,
          updateId: u.id,
          fieldKey,
          name: nameFor(u.participant_id),
          label,
          value,
          discussed: discussedKeys.has(itemKey),
          voteCount,
        },
      ];
    });
    // Most upvotes first; ties keep join order (the sort is stable).
    return items.sort((a, b) => b.voteCount - a.voteCount);
  };

  const [hive, cool] = UPVOTE_FIELDS;
  const hiveMind = topics(hive.key, hive.label, false);
  const cools = topics(cool.key, cool.label, true);

  return {
    shown,
    nameFor,
    wins,
    offersAccepted,
    offersAcceptedTotal,
    offersExtended,
    offersExtendedTotal,
    rolesOpened,
    hiveMind,
    cool: cools,
    // Everything the room has to talk through, for counts and the close prompt.
    discussion: [...hiveMind, ...cools],
  };
}

// One-line counts for a session, used on the archive list and detail pages.
export function summarizeSession(updates: AgendaUpdate[], reactions: ReactionRow[]) {
  const { shown, discussion } = buildAgenda([], updates, reactions);
  return {
    updates: shown.length,
    topics: discussion.length,
    discussed: discussion.filter((item) => item.discussed).length,
  };
}

export function formatSessionSummary(summary: ReturnType<typeof summarizeSession>): string {
  const parts = [`${summary.updates} ${summary.updates === 1 ? "update" : "updates"}`];
  if (summary.topics > 0) {
    parts.push(`${summary.topics} to discuss`, `${summary.discussed} discussed`);
  }
  return parts.join(" · ");
}
