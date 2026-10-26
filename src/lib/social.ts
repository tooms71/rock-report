// Reactions and comments on people's wins, the way the team did it in the Notion doc.
export const WINS_KEY = "wins";

export const WIN_EMOJIS = [
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "👏", label: "Applaud" },
  { emoji: "❤️", label: "Love" },
  { emoji: "🔥", label: "Fire" },
] as const;

export type CommentRow = {
  id: string;
  session_id: string;
  target_type: string;
  target_update_id: string;
  field_key: string | null;
  participant_id: string;
  body: string;
  created_at: string;
};

export const MAX_COMMENT_LENGTH = 500;
