// What someone can say about each of their open roles. The first four are a traffic light
// for how the search is going; the last two are offers.
//
// `short` is the label on the buttons in the narrow writing column; `label` is the full
// name used everywhere else; `emoji` sits beside either (screen readers skip it);
// `hint` explains the choice under the buttons once it is picked.
export const ROLE_STATUSES = [
  {
    value: "on_track",
    label: "Going well",
    short: "Going well",
    emoji: "🟢",
    group: "health",
    hint: "Going well. No need to discuss.",
  },
  {
    value: "slow",
    label: "Slow",
    short: "Slow",
    emoji: "🟡",
    group: "health",
    hint: "Going okay, but you're keeping an eye on it because it's slow.",
  },
  {
    // Private: only the owner sees gray. Everyone else sees it as yellow (see publicStatus).
    value: "struggling",
    label: "Struggling",
    short: "Struggling",
    emoji: "⚪",
    group: "health",
    hint: "Not going great, but not ready to problem-solve with the group. Only you see gray; the team sees yellow.",
  },
  {
    // The stored value is still "stalled" from when this was the only red option.
    value: "stalled",
    label: "Blocked",
    short: "Blocked",
    emoji: "🔴",
    group: "health",
    hint: "Blocked, and you want help on this role in the meeting. It goes on the agenda.",
  },
  { value: "offer_extended", label: "Offer extended", short: "Extended", emoji: "🤞", group: "offer", hint: "" },
  { value: "offer_accepted", label: "Offer accepted", short: "Accepted", emoji: "🎉", group: "offer", hint: "" },
] as const;

export type RoleStatus = (typeof ROLE_STATUSES)[number]["value"];

// What the rest of the team sees. Gray ("struggling") is private to its owner and reads as
// yellow to everyone else.
export const publicStatus = (status: RoleStatus): RoleStatus =>
  status === "struggling" ? "slow" : status;

export const roleStatusEmoji = (status: RoleStatus) =>
  ROLE_STATUSES.find((s) => s.value === status)?.emoji ?? "";

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
  // No longer used: a blocked role goes on the agenda by itself now.
  discuss: boolean;
  updated_at: string;
};

// A blocked role goes on the agenda as a hive mind topic, so it can be upvoted and marked
// discussed like any other topic. Reactions are keyed by update + field, so a role gets a
// field key of its own.
export const roleFieldKey = (notionPageId: string) => `role:${notionPageId}`;
