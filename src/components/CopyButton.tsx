"use client";

import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "error";

// Fallback for browsers or embedded views that refuse the async clipboard API:
// select the text in a throwaway field and use the older copy command.
function copyViaSelection(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(field);
  }
}

export function CopyButton({
  getText,
  label,
  copiedText,
  primary = false,
}: {
  getText: () => string;
  label: string;
  copiedText: string;
  primary?: boolean;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function copy() {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState(copyViaSelection(text) ? "copied" : "error");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 3000);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copy}
        className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition ${
          primary
            ? "bg-ember-fill text-white"
            : "border border-grafite/50 text-ardesia hover:border-ember-ink hover:text-ember-ink dark:border-white/40 dark:text-marmol"
        }`}
      >
        {label}
      </button>
      <span
        role="status"
        aria-live="polite"
        className={`text-sm ${
          state === "error"
            ? "font-semibold text-ember-ink"
            : "text-grafite dark:text-marmol/80"
        }`}
      >
        {state === "copied" && copiedText}
        {state === "error" && "Couldn’t copy from this browser. Try again."}
      </span>
    </div>
  );
}
