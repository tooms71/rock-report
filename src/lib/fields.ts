// The two question boxes the team votes on. Their database columns keep their older
// names: need_brain_on began life as "where I could use another brain", which is the hive
// mind, and anything_else is the "anything cool you've seen" box.
export const HIVE_MIND_KEY = "need_brain_on";
export const COOL_KEY = "anything_else";

export const UPVOTE_FIELDS = [
  { key: HIVE_MIND_KEY, label: "Hive mind" },
  { key: COOL_KEY, label: "Anything cool" },
] as const;
