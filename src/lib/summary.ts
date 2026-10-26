import type { ReactionRow } from "@/components/RevealGrid";
import {
  buildAgenda,
  type AgendaInfoItem,
  type AgendaParticipant,
  type AgendaUpdate,
  type DiscussionItem,
} from "@/lib/agenda";
import type { RoleUpdateRow } from "@/lib/roleStatus";
import { WIN_EMOJIS, WINS_KEY, type CommentRow } from "@/lib/social";

const oneLine = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("; ");

// Plain-text meeting notes, ready to paste into Slack or Notion, in the same order as the
// agenda: wins and offers, new roles, the facilitator's topics, hive mind, anomalies and
// trends, then worth sharing.
export function buildMeetingNotes({
  weekLabel,
  participants,
  updates,
  reactions,
  roleUpdates = [],
  comments = [],
}: {
  weekLabel: string;
  participants: AgendaParticipant[];
  updates: AgendaUpdate[];
  reactions: ReactionRow[];
  roleUpdates?: RoleUpdateRow[];
  comments?: CommentRow[];
}): string {
  const agenda = buildAgenda(participants, updates, reactions, roleUpdates);
  const sections: string[] = [`Rock Report: week of ${weekLabel}`];

  const bullets = (heading: string, items: AgendaInfoItem[]) =>
    [heading, ...items.map((i) => `- ${i.name}: ${oneLine(i.text)}`)].join("\n");
  const numbered = (heading: string, items: DiscussionItem[]) =>
    [
      heading,
      ...items.map(
        (item, index) =>
          `${index + 1}. ${item.discussed ? "[discussed]" : "[not discussed]"} ${item.name}${
            item.voteCount > 0 ? ` (${item.voteCount} ${item.voteCount === 1 ? "upvote" : "upvotes"})` : ""
          }: ${oneLine(item.value ?? "")}`
      ),
    ].join("\n");
  const withTotal = (heading: string, items: AgendaInfoItem[], total: number) =>
    items.length >= 2 ? `${heading} (${total} this week)` : heading;

  // Wins carry the team's reactions and comments, like the Notion doc they replace.
  if (agenda.wins.length > 0) {
    const lines = agenda.wins.flatMap((win) => {
      const tallies = WIN_EMOJIS.flatMap(({ emoji }) => {
        const count = reactions.filter(
          (r) =>
            r.target_type === "field" &&
            r.target_update_id === win.id &&
            r.field_key === WINS_KEY &&
            r.emoji === emoji
        ).length;
        return count > 0 ? [`${emoji} ${count}`] : [];
      });
      const replies = comments
        .filter((c) => c.target_update_id === win.id && c.field_key === WINS_KEY)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((c) => `  - ${agenda.nameFor(c.participant_id)}: ${oneLine(c.body)}`);
      return [
        `- ${win.name}: ${oneLine(win.text)}${tallies.length > 0 ? ` (${tallies.join(" ")})` : ""}`,
        ...replies,
      ];
    });
    sections.push(["Wins", ...lines].join("\n"));
  }
  if (agenda.offersAccepted.length > 0) {
    sections.push(
      bullets(
        withTotal("Offers accepted", agenda.offersAccepted, agenda.offersAcceptedTotal),
        agenda.offersAccepted
      )
    );
  }
  if (agenda.offersExtended.length > 0) {
    sections.push(
      bullets(
        withTotal("Offers extended", agenda.offersExtended, agenda.offersExtendedTotal),
        agenda.offersExtended
      )
    );
  }
  if (agenda.rolesOpened.length > 0) sections.push(bullets("New roles opened", agenda.rolesOpened));
  if (agenda.facilitatorTopics.length > 0) {
    const authors = [...new Set(agenda.facilitatorTopics.map((t) => t.name))].join(" and ");
    sections.push(numbered(`Topics from ${authors}`, agenda.facilitatorTopics));
  }
  if (agenda.hiveMind.length > 0) sections.push(numbered("Hive mind", agenda.hiveMind));
  if (agenda.anomalies.length > 0) {
    sections.push(numbered("Anomalies and trends", agenda.anomalies));
  }
  if (agenda.cool.length > 0) sections.push(numbered("Worth sharing", agenda.cool));

  return sections.join("\n\n");
}
