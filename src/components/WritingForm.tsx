"use client";

import { useEffect, useId, useRef, useState } from "react";
import { inputClass } from "@/lib/ui";
import { UPDATE_FIELD_KEYS } from "@/lib/updates";

export type UpdateFields = {
  roles_opened: string | null;
  wins: string | null;
  need_brain_on: string | null; // the hive mind box
  anything_else: string | null; // worth sharing
  facilitator_topics: string | null; // the facilitator's own agenda topics
};

const FIELD_KEYS = UPDATE_FIELD_KEYS;

// The row we get from the database carries extra columns (id, submitted_at...);
// only ever send the user-editable fields back.
function pickFields(source: UpdateFields): UpdateFields {
  const picked = {} as Record<string, unknown>;
  for (const key of FIELD_KEYS) picked[key] = source[key] ?? null;
  return picked as UpdateFields;
}

const AUTOSAVE_DELAY_MS = 600;

type SaveState = "idle" | "saving" | "saved" | "error";

export function WritingForm({
  initialFields,
  onAutosave,
  onSubmit,
  submitting,
  isFacilitator = false,
  hasRoleUpdates = false,
}: {
  initialFields: UpdateFields;
  onAutosave: (fields: UpdateFields) => Promise<boolean>;
  onSubmit: (fields: UpdateFields) => void;
  submitting: boolean;
  // The facilitator gets a box of her own for topics she adds to the agenda.
  isFacilitator?: boolean;
  // Role buttons tapped above the form count as an answer, so an empty text form is fine.
  hasRoleUpdates?: boolean;
}) {
  const [fields, setFields] = useState<UpdateFields>(() => pickFields(initialFields));
  const fieldsRef = useRef(fields);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAutosaveRef = useRef(onAutosave);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  useEffect(() => {
    onAutosaveRef.current = onAutosave;
  });

  async function save(next: UpdateFields) {
    setSaveState("saving");
    const ok = await onAutosaveRef.current(next);
    setSaveState(ok ? "saved" : "error");
  }

  function updateField<K extends keyof UpdateFields>(key: K, value: UpdateFields[K]) {
    const next = { ...fieldsRef.current, [key]: value };
    fieldsRef.current = next;
    setFields(next);
    setConfirmEmpty(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void save(next);
    }, AUTOSAVE_DELAY_MS);
  }

  // Never lose what was typed in the last moments: if a save is still pending when
  // the form goes away (the meeting started) or the tab is hidden, write it out now.
  useEffect(() => {
    function flushIfPending() {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void onAutosaveRef.current(fieldsRef.current);
    }
    function onVisibilityChange() {
      if (document.hidden) flushIfPending();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flushIfPending();
    };
  }, []);

  function handleSubmit() {
    const isEmpty = FIELD_KEYS.every(
      (key) => fieldsRef.current[key] === null || fieldsRef.current[key] === ""
    );
    if (isEmpty && !hasRoleUpdates && !confirmEmpty) {
      setConfirmEmpty(true);
      return;
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    onSubmit(fieldsRef.current);
  }

  return (
    <div
      className="flex flex-col gap-5"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          handleSubmit();
        }
      }}
    >
      <p className="text-sm text-grafite dark:text-marmol/80">
        Leave anything that doesn&apos;t apply to you blank.
      </p>

      <TextField
        label="Wins to celebrate"
        hint="Anything you'd like celebrated, other than offers accepted"
        value={fields.wins}
        onChange={(v) => updateField("wins", v)}
        rows={2}
      />

      <TextField
        label="New roles opened"
        placeholder="List client and role"
        value={fields.roles_opened}
        onChange={(v) => updateField("roles_opened", v)}
        rows={2}
      />

      {isFacilitator && (
        <TextField
          label="Facilitator - Topics to Discuss"
          hint="Only you see this box. One topic per line. They go on the agenda after new roles, before the hive mind"
          value={fields.facilitator_topics}
          onChange={(v) => updateField("facilitator_topics", v)}
          rows={3}
        />
      )}

      <TextField
        label="What might you want to discuss with the Hive Mind?"
        hint="For example market changes, problems you're running into, or advice on how to shape a search. Leave blank if nothing. Whatever you write goes on the agenda and the team can upvote it"
        value={fields.need_brain_on}
        onChange={(v) => updateField("need_brain_on", v)}
        rows={3}
      />

      <TextField
        label="Is there anything you built or saw this week that was cool or valuable to share?"
        hint="Something you built, learned or noticed"
        value={fields.anything_else}
        onChange={(v) => updateField("anything_else", v)}
        rows={3}
      />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="min-h-11 rounded-lg bg-ember-fill px-4 py-2 font-semibold text-white transition disabled:opacity-50"
        >
          {confirmEmpty ? "Everything is blank. Submit anyway" : "Submit"}
        </button>
        <p
          role="status"
          aria-live="polite"
          className={`text-xs ${
            saveState === "error"
              ? "font-semibold text-ember-ink"
              : "text-grafite dark:text-marmol/70"
          }`}
        >
          {saveState === "idle" && "Saves as you type. Everyone sees it when the meeting starts."}
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved. Keep editing until you submit."}
          {saveState === "error" &&
            "Couldn't save just now. Your text is still here, and we'll try again as you type."}
        </p>
      </div>
    </div>
  );
}

const labelClass = "text-sm font-semibold text-ardesia dark:text-marmol";

function TextField({
  label,
  hint,
  placeholder,
  value,
  onChange,
  rows,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  rows: number;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-grafite dark:text-marmol/70">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        aria-describedby={hint ? hintId : undefined}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        rows={rows}
        className={`resize-none ${inputClass}`}
      />
    </div>
  );
}
