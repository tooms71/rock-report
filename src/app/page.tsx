"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getMondayOfWeek } from "@/lib/date";
import { RockCard } from "@/components/RockCard";

type SessionRow = {
  id: string;
  week_of: string;
  phase: string;
  facilitator_participant_id: string | null;
};

type ParticipantRow = {
  id: string;
  session_id: string;
  display_name: string;
  joined_at: string;
};

const NAME_KEY = "rockreport:name";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [me, setMe] = useState<ParticipantRow | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the name field from a previous visit.
  useEffect(() => {
    const saved = window.localStorage.getItem(NAME_KEY);
    if (saved) setName(saved);
  }, []);

  // Load this week's session (if any) and its participants.
  useEffect(() => {
    let active = true;

    async function load() {
      const weekOf = getMondayOfWeek(new Date());
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("*")
        .eq("week_of", weekOf)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      setSession(sessionData);

      if (sessionData) {
        const { data: participantsData } = await supabase
          .from("participants")
          .select("*")
          .eq("session_id", sessionData.id)
          .order("joined_at", { ascending: true });

        if (!active) return;
        setParticipants(participantsData ?? []);
      }

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  // Live presence: new joins appear for everyone without a refresh.
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(`lobby-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const newParticipant = payload.new as ParticipantRow;
          setParticipants((prev) =>
            prev.some((p) => p.id === newParticipant.id)
              ? prev
              : [...prev, newParticipant]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  async function handleCreateSession() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const weekOf = getMondayOfWeek(new Date());

      const { data: newSession, error: sessionError } = await supabase
        .from("sessions")
        .insert({ week_of: weekOf, phase: "lobby" })
        .select()
        .single();
      if (sessionError) throw sessionError;

      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .insert({ session_id: newSession.id, display_name: trimmed })
        .select()
        .single();
      if (participantError) throw participantError;

      const { data: updatedSession, error: updateError } = await supabase
        .from("sessions")
        .update({ facilitator_participant_id: participant.id })
        .eq("id", newSession.id)
        .select()
        .single();
      if (updateError) throw updateError;

      window.localStorage.setItem(NAME_KEY, trimmed);
      setSession(updatedSession);
      setParticipants([participant]);
      setMe(participant);
    } catch {
      setError("Couldn't create the session. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!session) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const existing = participants.find(
        (p) => p.display_name.trim().toLowerCase() === trimmed.toLowerCase()
      );

      let participant = existing ?? null;
      if (!participant) {
        const { data, error: insertError } = await supabase
          .from("participants")
          .insert({ session_id: session.id, display_name: trimmed })
          .select()
          .single();
        if (insertError) throw insertError;
        participant = data;
        setParticipants((prev) => [...prev, data]);
      }

      window.localStorage.setItem(NAME_KEY, trimmed);
      setMe(participant);
    } catch {
      setError("Couldn't join. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-grafite">Loading…</p>
      </main>
    );
  }

  const isFacilitator = !!me && me.id === session?.facilitator_participant_id;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="font-heading text-3xl font-bold text-ardesia">
        Rock Report
      </h1>

      <RockCard />

      {!session && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-grafite dark:text-marmol/80">
            No session yet this week. Start one for the team.
          </p>
          <NameInput name={name} setName={setName} disabled={busy} />
          <button
            onClick={handleCreateSession}
            disabled={busy || !name.trim()}
            className="rounded-lg bg-ember px-4 py-2 font-semibold text-white transition disabled:opacity-50"
          >
            Create this week&apos;s session
          </button>
        </div>
      )}

      {session && !me && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-grafite dark:text-marmol/80">
            {participants.length === 0
              ? "This week's session is open. Be the first to join."
              : "This week's session is open — join in."}
          </p>
          {participants.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setName(p.display_name)}
                  className="rounded-full bg-marmol px-3 py-1 text-sm text-ardesia hover:bg-marmol/70"
                >
                  {p.display_name}
                </button>
              ))}
            </div>
          )}
          <NameInput name={name} setName={setName} disabled={busy} />
          <button
            onClick={handleJoin}
            disabled={busy || !name.trim()}
            className="rounded-lg bg-ember px-4 py-2 font-semibold text-white transition disabled:opacity-50"
          >
            Join
          </button>
        </div>
      )}

      {session && me && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-grafite dark:text-marmol/70">
              Who&apos;s here ({participants.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {participants.map((p) => (
                <span
                  key={p.id}
                  className="rounded-full bg-marmol px-3 py-1 text-sm text-ardesia"
                >
                  {p.display_name}
                  {p.id === session.facilitator_participant_id && " 🎙️"}
                </span>
              ))}
            </div>
          </div>

          <p className="text-sm text-grafite dark:text-marmol/80">
            {isFacilitator
              ? "You created this session. The Start button arrives in the next step."
              : "You're in. Waiting for the facilitator to start writing."}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-ember">{error}</p>}
    </main>
  );
}

function NameInput({
  name,
  setName,
  disabled,
}: {
  name: string;
  setName: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <input
      type="text"
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder="Your name"
      disabled={disabled}
      className="rounded-lg border border-marmol bg-white px-3 py-2 text-ardesia outline-none focus:border-ember"
    />
  );
}
