import type { ReactionRow } from "@/components/RevealGrid";
import { buildAgenda, type AgendaParticipant, type AgendaUpdate } from "@/lib/agenda";

const oneLine = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("; ");

// Plain-text meeting notes, ready to paste into Slack or Notion: the agenda plus
// everyone's top priorities, so someone who missed the meeting can catch up.
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
  const { shown, nameFor, offersClosed, offersClosedTotal, rolesOpened, flagged } = buildAgenda(
    participants,
    updates,
    reactions
  );

  const sections: string[] = [`Rock Report: week of ${weekLabel}`];

  if (offersClosed.length > 0) {
    sections.push(
      [
        offersClosed.length >= 2 ? `Offers closed (${offersClosedTotal} this week)` : "Offers closed",
        ...offersClosed.map((i) => `- ${i.name}: ${oneLine(i.text)}`)].join("\n")
    );
  }
  if (rolesOpened.length > 0) {
    sections.push(
      ["New roles opened", ...rolesOpened.map((i) => `- ${i.name}: ${oneLine(i.text)}`)].join("\n")
    );
  }
  if (flagged.length > 0) {
    sections.push(
      [
        "Flagged for discussion",
        ...flagged.map(
          (f, index) =>
            `${index + 1}. ${f.discussed ? "[discussed]" : "[not discussed]"} ${f.name} · ${f.label}${
              f.flagCount > 1 ? ` (${f.flagCount} flags)` : ""
            }: ${oneLine(f.value ?? "")}`
        ),
      ].join("\n")
    );
  }

  const priorities = shown
    .filter((u) => u.top_priorities?.trim())
    .map((u) => `- ${nameFor(u.participant_id)}: ${oneLine(u.top_priorities ?? "")}`);
  if (priorities.length > 0) {
    sections.push(["Top priorities of the week", ...priorities].join("\n"));
  }

  return sections.join("\n\n");
}
