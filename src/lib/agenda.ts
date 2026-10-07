import {
  DISCUSSED_EMOJI,
  FLAG_EMOJI,
  FLAGGABLE_FIELDS,
  formatOffers,
  type ReactionRow,
} from "@/components/RevealGrid";
import type { UpdateFields } from "@/components/WritingForm";
import { isShown } from "@/lib/updates";

export type AgendaParticipant = { id: string; display_name: string };

export type AgendaUpdate = UpdateFields & {
  id: string;
  participant_id: string;
  submitted_at: string | null;
};

export type AgendaInfoItem = { id: string; name: string; text: string };

export type FlaggedItem = {
  itemKey: string;
  updateId: string;
  fieldKey: string;
  name: string;
  label: string;
  value: string | null;
  discussed: boolean;
};

const FLAG_FIELDS: { key: keyof UpdateFields; label: string }[] = [
  { key: "offers_made", label: "Offers out" },
  ...FLAGGABLE_FIELDS,
];

// The meeting's agenda, derived from the revealed updates and reactions: what closed,
// what opened, and what the team flagged (in a fixed person-then-field order so item
// numbers never jump while the room works through them).
export function buildAgenda(
  participants: AgendaParticipant[],
  updates: AgendaUpdate[],
  reactions: ReactionRow[]
) {
  const shown = updates.filter((u) => isShown(u));
  const nameFor = (participantId: string) =>
    participants.find((p) => p.id === participantId)?.display_name ?? "Someone";

  // Zero closed offers isn't agenda material.
  const offersClosed: AgendaInfoItem[] = shown.flatMap((u) =>
    u.offers_closed
      ? [
          {
            id: u.id,
            name: nameFor(u.participant_id),
            text: formatOffers(u.offers_closed, u.offers_closed_note) ?? "",
          },
        ]
      : []
  );

  const rolesOpened: AgendaInfoItem[] = shown.flatMap((u) =>
    u.roles_opened
      ? [{ id: u.id, name: nameFor(u.participant_id), text: u.roles_opened }]
      : []
  );

  const keyOf = (r: ReactionRow) => `${r.target_update_id}:${r.field_key}`;
  const flagKeys = new Set(
    reactions
      .filter((r) => r.target_type === "field" && r.emoji === FLAG_EMOJI && r.field_key)
      .map(keyOf)
  );
  const discussedKeys = new Set(
    reactions
      .filter((r) => r.target_type === "field" && r.emoji === DISCUSSED_EMOJI && r.field_key)
      .map(keyOf)
  );

  const flagged: FlaggedItem[] = shown.flatMap((u) =>
    FLAG_FIELDS.filter(({ key }) => flagKeys.has(`${u.id}:${key}`)).map(({ key, label }) => ({
      itemKey: `${u.id}:${key}`,
      updateId: u.id,
      fieldKey: key as string,
      name: nameFor(u.participant_id),
      label,
      value:
        key === "offers_made"
          ? formatOffers(u.offers_made, u.offers_made_note)
          : (u[key] as string | null),
      discussed: discussedKeys.has(`${u.id}:${key}`),
    }))
  );

  return { shown, nameFor, offersClosed, rolesOpened, flagged };
}
