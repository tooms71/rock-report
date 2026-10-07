"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const LINE_CLASS = { 3: "line-clamp-3", 5: "line-clamp-5" } as const;

// Long entries fold to a few lines with a Show more control, but only when they
// actually overflow, so short text never grows a button.
export function ClampedText({
  children,
  lines = 3,
  className = "",
  label,
}: {
  children: ReactNode;
  lines?: keyof typeof LINE_CLASS;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, children]);

  return (
    <div>
      <p ref={ref} className={`${className} ${expanded ? "" : LINE_CLASS[lines]}`}>
        {children}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={label ? `${expanded ? "Show less" : "Show more"}: ${label}` : undefined}
          className="mt-1 inline-flex min-h-8 items-center text-sm font-semibold text-ember-ink underline underline-offset-2 max-sm:min-h-11"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
