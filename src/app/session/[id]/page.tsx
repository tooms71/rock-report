"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { RockCard } from "@/components/RockCard";
import { AgendaPanel } from "@/components/AgendaPanel";
import { RevealGrid, type ReactionRow } from "@/components/RevealGrid";
import { formatWeekOf, parseWeekOf } from "@/lib/date";
import type { UpdateFields } from "@/components/WritingForm";

type SessionRow = {
  id: string;
  week_of: string;
  phase: string;
};

type ParticipantRow = {
  id: string;
  display_name: string;
};

type UpdateRow = UpdateFields & {
  id: string;
  participant_id: string;
  submitted_at: string | null;
};

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("id, week_of, phase")
        .eq("id", sessionId)
        .maybeSingle();

      if (!active) return;
      setSession(sessionData);

      if (!sessionData) {
        setLoading(false);
        return;
      }

      const [
        { data: participantsData },
        { data: updatesData },
        { data: reactionsData },
      ] = await Promise.all([
        supabase.from("participants").select("id, display_name").eq("session_id", sessionId),
        supabase.from("updates").select("*").eq("session_id", sessionId),
        supabase.from("reactions").select("*").eq("session_id", sessionId),
      ]);

      if (!active) return;
      setParticipants(participantsData ?? []);
      setUpdates(updatesData ?? []);
      setReactions(reactionsData ?? []);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-grafite dark:text-marmol/70">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-10">
        <p className="text-grafite dark:text-marmol/70">Session not found.</p>
        <Link href="/archive" className="text-sm font-semibold text-ember-ink">
          ← Back to archive
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-ardesia dark:text-marmol">
            Week of {formatWeekOf(session.week_of)}
          </h1>
          <Link href="/archive" className="text-sm font-semibold text-ember-ink">
            ← Archive
          </Link>
        </div>
        <RockCard compact date={parseWeekOf(session.week_of)} />
      </div>

      <AgendaPanel participants={participants} updates={updates} reactions={reactions} />
      <section aria-labelledby="updates-heading" className="flex flex-col gap-4">
        <h2
          id="updates-heading"
          className="font-heading text-2xl font-bold text-ardesia dark:text-marmol"
        >
          Everyone&apos;s updates
        </h2>
        <RevealGrid
          participants={participants}
          updates={updates}
          reactions={reactions}
          myParticipantId=""
          onToggleFlag={() => {}}
          readOnly
        />
      </section>
    </main>
  );
}
