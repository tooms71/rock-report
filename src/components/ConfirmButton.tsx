"use client";

import { useState } from "react";

// A button that asks "are you sure?" inline (no modal) before an action that
// affects everyone in the session and can't be undone.
export function ConfirmButton({
  label,
  prompt,
  confirmLabel,
  onConfirm,
  disabled,
  className,
  needsConfirm = true,
}: {
  label: string;
  prompt: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  className: string;
  needsConfirm?: boolean;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        disabled={disabled}
        className={className}
        onClick={() => (needsConfirm ? setAsking(true) : onConfirm())}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-grafite/70 px-4 py-3 dark:border-white/40"
    >
      <p className="text-sm text-ardesia dark:text-marmol">{prompt}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
          className="min-h-9 rounded-lg bg-ember-fill px-3 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="min-h-9 rounded-lg border border-grafite/30 px-3 text-sm font-semibold text-ardesia transition dark:border-white/25 dark:text-marmol"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
