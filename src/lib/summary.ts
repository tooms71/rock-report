import type { ReactionRow } from "@/components/RevealGrid";
import {
  buildAgenda,
  type AgendaInfoItem,
  type AgendaParticipant,
  type AgendaUpdate,
  type DiscussionItem,
} from "@/lib/agenda";

const oneLine = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("; ");

// Plain-text meeting notes, ready to paste into Slack or Notion, in the same order as the
// agenda: wins and offers, new roles, hive mind, then anything cool.
export function buildMeetingNotes({
  weekLabel,
  participants,
  updates,
  reactions,
}: {
  weekLabel: string;
  participants: AgendaParticipant[];
  updates: AgendaUpdate[];
  reactions: ReactionRow[];
}): string {
  const agenda = buildAgenda(participants, updates, reactions);
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

  if (agenda.wins.length > 0) sections.push(bullets("Wins", agenda.wins));
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
  if (agenda.hiveMind.length > 0) sections.push(numbered("Hive mind", agenda.hiveMind));
  if (agenda.cool.length > 0) sections.push(numbered("Anything cool you've seen", agenda.cool));

  return sections.join("\n\n");
}
