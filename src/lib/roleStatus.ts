// The four things someone can say about each of their open roles.
export const ROLE_STATUSES = [
  { value: "on_track", label: "On track" },
  { value: "stalled", label: "Stalled" },
  { value: "offer_extended", label: "Offer extended" },
  { value: "offer_accepted", label: "Offer accepted" },
] as const;

export type RoleStatus = (typeof ROLE_STATUSES)[number]["value"];

export const roleStatusLabel = (status: RoleStatus) =>
  ROLE_STATUSES.find((s) => s.value === status)?.label ?? status;

export type RoleUpdateRow = {
  id: string;
  session_id: string;
  participant_id: string;
  notion_page_id: string;
  role_title: string;
  role_url: string | null;
  status: RoleStatus;
  note: string | null;
  updated_at: string;
};

// A stalled role goes on the agenda as a hive mind topic, so it can be upvoted and marked
// discussed like any other topic. Reactions are keyed by update + field, so a role gets a
// field key of its own.
export const roleFieldKey = (notionPageId: string) => `role:${notionPageId}`;
