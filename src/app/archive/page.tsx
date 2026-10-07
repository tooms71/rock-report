"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatWeekOf } from "@/lib/date";

type SessionRow = {
  id: string;
  week_of: string;
  phase: string;
};

const PHASE_LABELS: Record<string, string> = {
  lobby: "Not started",
  writing: "In progress",
  reveal: "Revealed",
  closed: "Closed",
};

export default function ArchivePage() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("sessions")
        .select("id, week_of, phase")
        .order("week_of", { ascending: false });
      if (!active) return;
      setSessions(data ?? []);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold text-ardesia dark:text-marmol">
          Past sessions
        </h1>
        <Link href="/" className="text-sm font-semibold text-ember-ink">
          ← Home
        </Link>
      </div>

      {sessions === null && (
        <p className="text-sm text-grafite dark:text-marmol/70">Loading…</p>
      )}

      {sessions?.length === 0 && (
        <p className="text-sm text-grafite dark:text-marmol/70">
          No sessions yet — once a week&apos;s ritual happens, it&apos;ll show up here.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {sessions?.map((s) => (
          <Link
            key={s.id}
            href={`/session/${s.id}`}
            className="flex items-center justify-between rounded-lg border border-marmol px-4 py-3 transition hover:bg-marmol/40 dark:border-white/15 dark:hover:bg-white/5"
          >
            <span className="font-medium text-ardesia dark:text-marmol">
              Week of {formatWeekOf(s.week_of)}
            </span>
            <span className="text-xs uppercase tracking-wide text-grafite dark:text-marmol/60">
              {PHASE_LABELS[s.phase] ?? s.phase}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
