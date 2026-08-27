"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getMondayOfWeek, formatClock } from "@/lib/date";
import { RockCard } from "@/components/RockCard";
import { WritingForm, type UpdateFields } from "@/components/WritingForm";
import { RevealGrid, type ReactionRow } from "@/components/RevealGrid";
import { AgendaPanel } from "@/components/AgendaPanel";

const WRITING_DURATION_MS = 3 * 60 * 1000;

type SessionRow = {
  id: string;
  week_of: string;
  phase: string;
  writing_ends_at: string | null;
  facilitator_participant_id: string | null;
};

type ParticipantRow = {
  id: string;
  session_id: string;
  display_name: string;
  joined_at: string;
};

type UpdateRow = UpdateFields & {
  id: string;
  session_id: string;
  participant_id: string;
  submitted_at: string | null;
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

  const [allUpdates, setAllUpdates] = useState<UpdateRow[]>([]);
  const [myUpdate, setMyUpdate] = useState<UpdateRow | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);

  // Prefill the name field from a previous visit.
  useEffect(() => {
    const saved = window.localStorage.getItem(NAME_KEY);
    // localStorage isn't available during SSR, so this has to run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Stay in sync when the phase or timer changes — on any client, from any cause.
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(`session-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          setSession(payload.new as SessionRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // Load everyone's updates for this session, then keep them live.
  useEffect(() => {
    if (!session) return;
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("updates")
        .select("*")
        .eq("session_id", session!.id);
      if (!active) return;
      setAllUpdates(data ?? []);
    }

    load();
    return () => {
      active = false;
    };
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(`updates-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "updates",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as UpdateRow;
            setAllUpdates((prev) =>
              prev.some((u) => u.id === row.id) ? prev : [...prev, row]
            );
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as UpdateRow;
            setAllUpdates((prev) =>
              prev.map((u) => (u.id === row.id ? row : u))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // Load this session's reactions (including red flags), then keep them live.
  useEffect(() => {
    if (!session) return;
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("reactions")
        .select("*")
        .eq("session_id", session!.id);
      if (!active) return;
      setReactions(data ?? []);
    }

    load();
    return () => {
      active = false;
    };
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(`reactions-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reactions",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const row = payload.new as ReactionRow;
          setReactions((prev) =>
            prev.some((r) => r.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "reactions",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setReactions((prev) => prev.filter((r) => r.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // The moment writing starts, make sure I have a draft row to autosave into.
  useEffect(() => {
    if (!session || !me) return;
    if (session.phase !== "writing") return;
    if (myUpdate) return;

    let active = true;
    async function ensureDraft() {
      const { data: existing } = await supabase
        .from("updates")
        .select("*")
        .eq("session_id", session!.id)
        .eq("participant_id", me!.id)
        .maybeSingle();

      if (!active) return;
      if (existing) {
        setMyUpdate(existing);
        return;
      }

      const { data: created } = await supabase
        .from("updates")
        .insert({ session_id: session!.id, participant_id: me!.id })
        .select()
        .single();

      if (!active) return;
      if (created) {
        setMyUpdate(created);
        setAllUpdates((prev) =>
          prev.some((u) => u.id === created.id) ? prev : [...prev, created]
        );
      }
    }

    ensureDraft();
    return () => {
      active = false;
    };
  }, [session?.phase, session?.id, me, myUpdate]);

  async function attemptReveal(sessionId: string) {
    await supabase
      .from("sessions")
      .update({ phase: "reveal" })
      .eq("id", sessionId)
      .eq("phase", "writing");
  }

  // Countdown, computed from the shared writing_ends_at — never a local stopwatch.
  useEffect(() => {
    if (!session || session.phase !== "writing" || !session.writing_ends_at) {
      // Reset the displayed countdown to match the external session state we just read.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSecondsLeft(null);
      return;
    }

    const endsAt = new Date(session.writing_ends_at).getTime();
    function tick() {
      setSecondsLeft(Math.max(0, (endsAt - Date.now()) / 1000));
    }
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [session?.phase, session?.writing_ends_at]);

  // Flip to reveal when time's up. The DB guard (phase='writing') means only one
  // caller across all connected clients actually succeeds, however many try.
  useEffect(() => {
    if (!session || session.phase !== "writing") return;
    if (secondsLeft === null || secondsLeft > 0) return;
    attemptReveal(session.id);
  }, [session?.phase, session?.id, secondsLeft]);

  // Flip to reveal early once everyone present has submitted.
  useEffect(() => {
    if (!session || session.phase !== "writing") return;
    if (participants.length === 0) return;
    const submittedCount = allUpdates.filter((u) => u.submitted_at).length;
    if (submittedCount >= participants.length) {
      attemptReveal(session.id);
    }
  }, [session?.phase, session?.id, allUpdates, participants.length]);

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

  async function handleStartWriting() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const writingEndsAt = new Date(Date.now() + WRITING_DURATION_MS).toISOString();
      const { data, error: startError } = await supabase
        .from("sessions")
        .update({ phase: "writing", writing_ends_at: writingEndsAt })
        .eq("id", session.id)
        .eq("phase", "lobby")
        .select()
        .single();
      if (startError) throw startError;
      setSession(data);
    } catch {
      setError("Couldn't start writing. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevealNow() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await attemptReveal(session.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseSession() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: closeError } = await supabase
        .from("sessions")
        .update({ phase: "closed" })
        .eq("id", session.id)
        .eq("phase", "reveal")
        .select()
        .single();
      if (closeError) throw closeError;
      setSession(data);
    } catch {
      setError("Couldn't close the session. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAutosave(fields: UpdateFields) {
    if (!myUpdate) return;
    const { data } = await supabase
      .from("updates")
      .update(fields)
      .eq("id", myUpdate.id)
      .select()
      .single();
    if (data) setMyUpdate(data);
  }

  async function handleSubmitUpdate() {
    if (!myUpdate) return;
    const { data } = await supabase
      .from("updates")
      .update({ submitted_at: new Date().toISOString() })
      .eq("id", myUpdate.id)
      .select()
      .single();
    if (data) setMyUpdate(data);
  }

  async function handleUnsubmit() {
    if (!myUpdate) return;
    const { data } = await supabase
      .from("updates")
      .update({ submitted_at: null })
      .eq("id", myUpdate.id)
      .select()
      .single();
    if (data) setMyUpdate(data);
  }

  async function handleToggleFlag(updateId: string, fieldKey: string) {
    if (!me || !session) return;

    const existing = reactions.find(
      (r) =>
        r.target_type === "field" &&
        r.target_update_id === updateId &&
        r.field_key === fieldKey &&
        r.emoji === "🚩" &&
        r.participant_id === me.id
    );

    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      return;
    }

    const { data } = await supabase
      .from("reactions")
      .insert({
        session_id: session.id,
        target_type: "field",
        target_update_id: updateId,
        field_key: fieldKey,
        emoji: "🚩",
        participant_id: me.id,
      })
      .select()
      .single();
    if (data) setReactions((prev) => [...prev, data]);
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-grafite">Loading…</p>
      </main>
    );
  }

  const isFacilitator = !!me && me.id === session?.facilitator_participant_id;
  const submittedCount = allUpdates.filter((u) => u.submitted_at).length;

  const isRevealing = session?.phase === "reveal" || session?.phase === "closed";

  return (
    <main
      className={`mx-auto flex w-full flex-1 flex-col gap-6 px-6 py-10 ${
        isRevealing ? "max-w-4xl" : "max-w-md"
      }`}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-3xl font-bold text-ardesia dark:text-marmol">
            Rock Report
          </h1>
          <Link href="/archive" className="text-sm font-semibold text-ember">
            Past sessions →
          </Link>
        </div>

        <RockCard />
      </div>

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
            {session.phase === "closed"
              ? "This week's session has ended. Join to see what was shared."
              : participants.length === 0
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

      {session && me && session.phase === "lobby" && (
        <div className="flex flex-col gap-4">
          <PresenceList participants={participants} session={session} />
          {isFacilitator ? (
            <button
              onClick={handleStartWriting}
              disabled={busy}
              className="rounded-lg bg-ember px-4 py-2 font-semibold text-white transition disabled:opacity-50"
            >
              Start writing (3:00)
            </button>
          ) : (
            <p className="text-sm text-grafite dark:text-marmol/80">
              You&apos;re in. Waiting for the facilitator to start writing.
            </p>
          )}
        </div>
      )}

      {session && me && session.phase === "writing" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="font-heading text-4xl font-bold tabular-nums text-ember">
              {secondsLeft !== null ? formatClock(secondsLeft) : "3:00"}
            </p>
            <p className="text-sm text-grafite dark:text-marmol/80">
              {submittedCount}/{participants.length} submitted
            </p>
          </div>

          {isFacilitator && (
            <button
              onClick={handleRevealNow}
              disabled={busy}
              className="self-start rounded-lg border border-ember px-3 py-1.5 text-sm font-semibold text-ember transition disabled:opacity-50"
            >
              Reveal now
            </button>
          )}

          {myUpdate && !myUpdate.submitted_at && (
            <WritingForm
              initialFields={myUpdate}
              onAutosave={handleAutosave}
              onSubmit={handleSubmitUpdate}
              submitting={busy}
            />
          )}

          {myUpdate && myUpdate.submitted_at && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-grafite dark:text-marmol/80">
                Submitted. Waiting for the reveal…
              </p>
              <button
                onClick={handleUnsubmit}
                className="self-start text-sm font-semibold text-ember"
              >
                Edit my answers
              </button>
            </div>
          )}
        </div>
      )}

      {session && me && (session.phase === "reveal" || session.phase === "closed") && (
        <div className="flex flex-col gap-4">
          <p className="font-heading text-2xl font-bold text-ardesia dark:text-marmol">
            {session.phase === "closed" ? "📁 Session closed" : "🎉 This week's updates"}
          </p>
          {session.phase === "closed" && (
            <p className="text-sm text-grafite dark:text-marmol/80">
              This session has ended. Here&apos;s what was shared, read-only.
            </p>
          )}
          <AgendaPanel
            participants={participants}
            updates={allUpdates}
            reactions={reactions}
          />
          <RevealGrid
            participants={participants}
            updates={allUpdates}
            reactions={reactions}
            myParticipantId={me.id}
            onToggleFlag={handleToggleFlag}
            readOnly={session.phase === "closed"}
          />
          {session.phase === "reveal" && isFacilitator && (
            <button
              onClick={handleCloseSession}
              disabled={busy}
              className="self-start rounded-lg bg-ardesia px-4 py-2 font-semibold text-white transition disabled:opacity-50 dark:bg-marmol dark:text-ardesia"
            >
              Close session
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-ember">{error}</p>}
    </main>
  );
}

function PresenceList({
  participants,
  session,
}: {
  participants: ParticipantRow[];
  session: SessionRow;
}) {
  return (
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
