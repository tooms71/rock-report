"use client";

import { useEffect, useId, useRef, useState } from "react";
import { inputClass } from "@/lib/ui";
import { UPDATE_FIELD_KEYS } from "@/lib/updates";

export type UpdateFields = {
  offers_made: number | null;
  offers_made_note: string | null;
  offers_closed: number | null;
  offers_closed_note: string | null;
  roles_opened: string | null;
  top_priorities: string | null;
  anything_else: string | null;
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
  lastToSubmit = false,
}: {
  initialFields: UpdateFields;
  onAutosave: (fields: UpdateFields) => Promise<boolean>;
  onSubmit: (fields: UpdateFields) => void;
  submitting: boolean;
  lastToSubmit?: boolean;
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
  // the form goes away (timer ran out) or the tab is hidden, write it out now.
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
    if (isEmpty && !confirmEmpty) {
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
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Offers closed"
          value={fields.offers_closed}
          note={fields.offers_closed_note}
          onValueChange={(v) => updateField("offers_closed", v)}
          onNoteChange={(v) => updateField("offers_closed_note", v)}
        />
        <NumberField
          label="Offers out"
          value={fields.offers_made}
          note={fields.offers_made_note}
          onValueChange={(v) => updateField("offers_made", v)}
          onNoteChange={(v) => updateField("offers_made_note", v)}
        />
      </div>

      <TextField
        label="New roles opened"
        value={fields.roles_opened}
        onChange={(v) => updateField("roles_opened", v)}
        rows={2}
      />

      <TextField
        label="What are your top priorities of the week?"
        hint="No more than 3, one per line"
        value={fields.top_priorities}
        onChange={(v) => updateField("top_priorities", v)}
        rows={3}
      />

      <TextField
        label="Anything else?"
        placeholder="Something you learned, something that surprised you, where you could use another brain, something interesting about your week…"
        value={fields.anything_else}
        onChange={(v) => updateField("anything_else", v)}
        rows={3}
      />

      <div className="flex flex-col gap-2">
        {lastToSubmit && (
          <p className="text-sm font-semibold text-ember-ink">
            You&apos;re the last one still writing. Submitting reveals everyone&apos;s
            updates right away.
          </p>
        )}
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
          {saveState === "idle" && "Your answers save as you type."}
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved. You can keep editing until you submit."}
          {saveState === "error" &&
            "Couldn't save just now. Your text is still here, and we'll try again as you type."}
        </p>
        <p className="text-xs text-grafite dark:text-marmol/70">
          Everyone sees this when time&apos;s up. Whatever is saved by then is shown,
          even if you haven&apos;t pressed Submit. Tip: Cmd or Ctrl + Enter submits.
        </p>
      </div>
    </div>
  );
}

const labelClass = "text-sm font-semibold text-ardesia dark:text-marmol";

function NumberField({
  label,
  value,
  note,
  onValueChange,
  onNoteChange,
}: {
  label: string;
  value: number | null;
  note: string | null;
  onValueChange: (value: number | null) => void;
  onNoteChange: (value: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ""}
        onChange={(e) =>
          onValueChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className={`${inputClass} tabular-nums`}
      />
      <input
        type="text"
        aria-label={`${label}: optional note`}
        placeholder="Optional note"
        value={note ?? ""}
        onChange={(e) => onNoteChange(e.target.value || null)}
        className={`${inputClass} py-1.5 text-sm`}
      />
    </div>
  );
}

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
