"use client";

import { useEffect, useRef, useState } from "react";

export type UpdateFields = {
  offers_made: number | null;
  offers_made_note: string | null;
  offers_closed: number | null;
  offers_closed_note: string | null;
  roles_opened: string | null;
  top_priorities: string | null;
  anything_else: string | null;
};

const AUTOSAVE_DELAY_MS = 600;

export function WritingForm({
  initialFields,
  onAutosave,
  onSubmit,
  submitting,
}: {
  initialFields: UpdateFields;
  onAutosave: (fields: UpdateFields) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const [fields, setFields] = useState(initialFields);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateField<K extends keyof UpdateFields>(key: K, value: UpdateFields[K]) {
    const next = { ...fields, [key]: value };
    setFields(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onAutosave(next), AUTOSAVE_DELAY_MS);
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Offers out"
          value={fields.offers_made}
          note={fields.offers_made_note}
          onValueChange={(v) => updateField("offers_made", v)}
          onNoteChange={(v) => updateField("offers_made_note", v)}
        />
        <NumberField
          label="Offers closed"
          value={fields.offers_closed}
          note={fields.offers_closed_note}
          onValueChange={(v) => updateField("offers_closed", v)}
          onNoteChange={(v) => updateField("offers_closed_note", v)}
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
        hint="No more than 3"
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

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="rounded-lg bg-ember px-4 py-2 font-semibold text-white transition disabled:opacity-50"
      >
        Submit
      </button>
    </div>
  );
}

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
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-grafite dark:text-marmol/70">
        {label}
      </label>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ""}
        onChange={(e) =>
          onValueChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className="rounded-lg border border-marmol bg-white px-3 py-2 tabular-nums text-ardesia outline-none focus:border-ember"
      />
      <input
        type="text"
        placeholder="Optional note"
        value={note ?? ""}
        onChange={(e) => onNoteChange(e.target.value || null)}
        className="rounded-lg border border-marmol bg-white px-3 py-1.5 text-sm text-ardesia outline-none focus:border-ember"
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
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-grafite dark:text-marmol/70">
        {label}
      </label>
      {hint && (
        <p className="text-xs text-grafite dark:text-marmol/70">({hint})</p>
      )}
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        rows={rows}
        className="resize-none rounded-lg border border-marmol bg-white px-3 py-2 text-ardesia outline-none focus:border-ember"
      />
    </div>
  );
}
