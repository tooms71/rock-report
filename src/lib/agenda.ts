import { DISCUSSED_EMOJI, FLAG_EMOJI, type ReactionRow } from "@/components/RevealGrid";
import type { UpdateFields } from "@/components/WritingForm";
import { FACILITATOR_TOPICS_KEY, UPVOTE_FIELDS } from "@/lib/fields";
import { WINS_KEY } from "@/lib/social";
import { roleFieldKey, type RoleUpdateRow } from "@/lib/roleStatus";
import { isMeaningful, isShown } from "@/lib/updates";

export type AgendaParticipant = { id: string; display_name: string };

export type AgendaUpdate = UpdateFields & {
  id: string;
  participant_id: string;
  submitted_at: string | null;
};

// updateId + fieldKey say which thing this is, so reactions and comments can be attached.
export type AgendaInfoItem = {
  id: string;
  name: string;
  text: string;
  updateId?: string;
  fieldKey?: string;
};

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
//   1. wins, offers accepted, offers extended  (offers come from the role buttons)
//   2. new roles opened                         (read out)
//   3. topics the facilitator added             (in the order she wrote them)
//   4. hive mind                                (everything people asked, plus any stalled
//                                                role its owner put forward, most upvotes first)
//   5. anomalies and trends                     (only what got an upvote, most first)
//   6. worth sharing                            (only what got an upvote, most first)
// Everyone is listed in the order they joined, so numbers match between the live view,
// the archive and the copied notes.
export function buildAgenda(
  participants: AgendaParticipant[],
  updates: AgendaUpdate[],
  reactions: ReactionRow[],
  roleUpdates: RoleUpdateRow[] = []
) {
  const joinOrder = new Map(participants.map((p, index) => [p.id, index]));
  const hasRoles = (participantId: string) =>
    roleUpdates.some((r) => r.participant_id === participantId);
  const shown = updates
    .filter((u) => isShown(u, hasRoles(u.participant_id)))
    .sort(
      (a, b) =>
        (joinOrder.get(a.participant_id) ?? Infinity) -
        (joinOrder.get(b.participant_id) ?? Infinity)
    );
  const nameFor = (participantId: string) =>
    participants.find((p) => p.id === participantId)?.display_name ?? "Someone";

  const infoItems = (
    pickKey: string,
    pick: (u: AgendaUpdate) => string | null | undefined
  ): AgendaInfoItem[] =>
    shown.flatMap((u) => {
      const text = pick(u);
      return text
        ? [{ id: u.id, name: nameFor(u.participant_id), text, updateId: u.id, fieldKey: pickKey }]
        : [];
    });

  // Offers are the roles someone tapped "offer accepted" or "offer extended" on.
  const roleItems = (status: RoleUpdateRow["status"]): AgendaInfoItem[] =>
    shown.flatMap((u) =>
      roleUpdates
        .filter((r) => r.participant_id === u.participant_id && r.status === status)
        .map((r) => ({
          id: r.id,
          name: nameFor(u.participant_id),
          text: r.note ? `${r.role_title} · ${r.note}` : r.role_title,
          updateId: u.id,
          fieldKey: roleFieldKey(r.notion_page_id),
        }))
    );
  const offersAccepted = roleItems("offer_accepted");
  const offersExtended = roleItems("offer_extended");
  const offersAcceptedTotal = offersAccepted.length;
  const offersExtendedTotal = offersExtended.length;
  const wins = infoItems(WINS_KEY, (u) => (isMeaningful(u.wins) ? u.wins : null));
  const rolesOpened = infoItems("roles_opened", (u) => (isMeaningful(u.roles_opened) ? u.roles_opened : null));

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

  const voteCountFor = (itemKey: string) => voters.get(itemKey)?.size ?? 0;

  const topics = (fieldKey: string, label: string, onlyUpvoted: boolean): DiscussionItem[] => {
    const items = shown.flatMap((u): DiscussionItem[] => {
      const value = u[fieldKey as (typeof UPVOTE_FIELDS)[number]["key"]];
      if (!isMeaningful(value)) return [];
      const itemKey = `${u.id}:${fieldKey}`;
      const voteCount = voteCountFor(itemKey);
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

  // A stalled role joins the hive mind list only when its owner asked to discuss it.
  const stalledRoles: DiscussionItem[] = shown.flatMap((u) =>
    roleUpdates
      .filter((r) => r.participant_id === u.participant_id && r.status === "stalled" && r.discuss)
      .map((r) => {
        const fieldKey = roleFieldKey(r.notion_page_id);
        const itemKey = `${u.id}:${fieldKey}`;
        return {
          itemKey,
          updateId: u.id,
          fieldKey,
          name: nameFor(u.participant_id),
          label: "Stalled role",
          value: r.note ? `${r.role_title}. ${r.note}` : r.role_title,
          discussed: discussedKeys.has(itemKey),
          voteCount: voteCountFor(itemKey),
        };
      })
  );

  const [hive, anomaly, cool] = UPVOTE_FIELDS;
  const hiveMind = [...topics(hive.key, hive.label, false), ...stalledRoles].sort(
    (a, b) => b.voteCount - a.voteCount
  );
  const anomalies = topics(anomaly.key, anomaly.label, true);
  const cools = topics(cool.key, cool.label, true);

  // The facilitator's box: one agenda topic per line, kept in the order she wrote them.
  // They are on the agenda whatever the votes, so they are not upvoted.
  const facilitatorTopics: DiscussionItem[] = shown.flatMap((u) =>
    (u[FACILITATOR_TOPICS_KEY] ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => isMeaningful(line))
      .map((line, index) => {
        const fieldKey = `${FACILITATOR_TOPICS_KEY}:${index}`;
        const itemKey = `${u.id}:${fieldKey}`;
        return {
          itemKey,
          updateId: u.id,
          fieldKey,
          name: nameFor(u.participant_id),
          label: "Topic",
          value: line,
          discussed: discussedKeys.has(itemKey),
          voteCount: 0,
        };
      })
  );

  return {
    shown,
    nameFor,
    wins,
    offersAccepted,
    offersAcceptedTotal,
    offersExtended,
    offersExtendedTotal,
    rolesOpened,
    facilitatorTopics,
    hiveMind,
    anomalies,
    cool: cools,
    // Everything the room has to talk through, for counts and the close prompt.
    discussion: [...facilitatorTopics, ...hiveMind, ...anomalies, ...cools],
  };
}

// One-line counts for a session, used on the archive list and detail pages.
export function summarizeSession(
  updates: AgendaUpdate[],
  reactions: ReactionRow[],
  roleUpdates: RoleUpdateRow[] = []
) {
  const { shown, discussion } = buildAgenda([], updates, reactions, roleUpdates);
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
