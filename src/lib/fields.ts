// The question boxes the team votes on. Their database columns keep their older names:
// need_brain_on began life as "where I could use another brain", which is the hive mind,
// and anything_else is the "worth sharing" box.
export const HIVE_MIND_KEY = "need_brain_on";
export const COOL_KEY = "anything_else";
// The facilitator's own box: topics she adds to the agenda herself (not voted on).
export const FACILITATOR_TOPICS_KEY = "facilitator_topics";

export const UPVOTE_FIELDS = [
  { key: HIVE_MIND_KEY, label: "Hive mind" },
  { key: COOL_KEY, label: "Worth sharing" },
] as const;
