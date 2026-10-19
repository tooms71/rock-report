import type { UpdateFields } from "@/components/WritingForm";

export const UPDATE_FIELD_KEYS: (keyof UpdateFields)[] = [
  "offers_made",
  "offers_made_note",
  "offers_closed",
  "offers_closed_note",
  "roles_opened",
  "top_priorities",
  // Holds "Blocked or struggling". The column predates that prompt (it used to be
  // "where I could use another brain"), which is close enough that no migration is needed.
  "need_brain_on",
  "anything_else",
];

// Did the person put anything in their update at all?
export function hasContent(update: Partial<UpdateFields>): boolean {
  return UPDATE_FIELD_KEYS.some((key) => {
    const value = update[key];
    if (value === null || value === undefined) return false;
    return typeof value === "string" ? value.trim() !== "" : true;
  });
}

// An update is shown if it was submitted, or if it holds saved text even though the
// person never pressed Submit (time ran out). Nobody's work disappears at 0:00.
export function isShown(
  update: (Partial<UpdateFields> & { submitted_at: string | null }) | undefined
): boolean {
  return !!update && (!!update.submitted_at || hasContent(update));
}

// People often type "none" or "n/a" instead of leaving a box empty. Those mean "nothing
// here", so they must not become agenda items or cards, especially under "Blocked or
// struggling", where whatever is written goes straight onto the agenda.
const MEANS_NOTHING = new Set([
  "no", "nope", "none", "nothing", "nada", "nil", "na", "n a",
  "not applicable", "none this week", "nothing this week", "nothing to report",
  "no update", "no updates", "no blockers", "no blocker", "not blocked",
  "not at the moment", "all good", "all good here",
]);

export function isMeaningful(value: string | null | undefined): boolean {
  if (!value) return false;
  // Ignore case and punctuation: "N/A.", "None!" and "-" all count as nothing.
  const cleaned = value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned !== "" && !MEANS_NOTHING.has(cleaned);
}
