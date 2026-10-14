"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getMondayOfWeek, formatClock, formatWeekOf, parseWeekOf } from "@/lib/date";
import { getCurrentRock } from "@/lib/rocks";
import { RockCard } from "@/components/RockCard";
import { WritingForm, type UpdateFields } from "@/components/WritingForm";
import {
  DISCUSSED_EMOJI,
  FLAG_EMOJI,
  RevealGrid,
  type ReactionRow,
} from "@/components/RevealGrid";
import { AgendaPanel } from "@/components/AgendaPanel";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyButton } from "@/components/CopyButton";
import { SubmittedSummary } from "@/components/SubmittedSummary";
import { buildMeetingNotes } from "@/lib/summary";
import { buildAgenda } from "@/lib/agenda";
import { inputClass } from "@/lib/ui";
import { isShown } from "@/lib/updates";
import { isSimilarName } from "@/lib/names";
import { CheckIcon } from "@/components/Icons";

const WRITING_DURATION_MS = 3 * 60 * 1000;

// Someone who opens a session that's already revealed or closed just reads it;
// they aren't added as a participant (that would create an empty card for them).
const VIEWER_ID = "viewer";

const CONNECTION_ERROR =
  "Couldn't reach the database. Check your connection (or whether Supabase is paused), then try again.";

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
  const [chosenMe, setChosenMe] = useState<ParticipantRow | null>(null);
  const [savedName, setSavedName] = useState("");
  const [optedOut, setOptedOut] = useState(false);
  // If this browser remembers a name that's already in the session (a refresh, a
  // laptop waking up), put the person straight back in; "Not you?" undoes it.
  const autoMe =
    !optedOut && savedName
      ? participants.find(
          (p) => p.display_name.trim().toLowerCase() === savedName.trim().toLowerCase()
        ) ?? null
      : null;
  const me = chosenMe ?? autoMe;
  const [name, setName] = useState("");
  // Set when the typed name is one typo away from someone already in the session.
  const [nameSuggestion, setNameSuggestion] = useState<ParticipantRow | null>(null);

  function updateName(value: string) {
    setName(value);
    setNameSuggestion(null);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allUpdates, setAllUpdates] = useState<UpdateRow[]>([]);
  const [myUpdate, setMyUpdate] = useState<UpdateRow | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // Highest remaining time seen, so the progress bar stays accurate after "+1 min".
  const [timerCeiling, setTimerCeiling] = useState(WRITING_DURATION_MS / 1000);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);

  // Prefill the name field from a previous visit.
  useEffect(() => {
    const saved = window.localStorage.getItem(NAME_KEY);
    // localStorage isn't available during SSR, so this has to run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setName(saved);
    if (saved) setSavedName(saved);
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
      const remaining = Math.max(0, (endsAt - Date.now()) / 1000);
      setSecondsLeft(remaining);
      setTimerCeiling((ceiling) => (remaining > ceiling ? remaining : ceiling));
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

  // Arrive at the top of the reveal, not wherever the writing form was scrolled to.
  useEffect(() => {
    if (session?.phase === "reveal") window.scrollTo({ top: 0 });
  }, [session?.phase]);

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
      setChosenMe(participant);
    } catch {
      setError(CONNECTION_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(override?: { name: string; forceNew?: boolean }) {
    if (!session) return;
    const trimmed = (override?.name ?? name).trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    setNameSuggestion(null);
    try {
      const existing = participants.find(
        (p) => p.display_name.trim().toLowerCase() === trimmed.toLowerCase()
      );

      // "Shanon" vs "Shannon": ask before creating a second person who would never
      // submit and would block the everyone-has-submitted reveal.
      if (!existing && !override?.forceNew) {
        const similar = participants.find((p) => isSimilarName(p.display_name, trimmed));
        if (similar) {
          setNameSuggestion(similar);
          return;
        }
      }

      let participant = existing ?? null;
      if (!participant && (session.phase === "reveal" || session.phase === "closed")) {
        window.localStorage.setItem(NAME_KEY, trimmed);
        setChosenMe({ id: VIEWER_ID, session_id: session.id, display_name: trimmed, joined_at: "" });
        return;
      }
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
      setChosenMe(participant);
    } catch {
      setError(CONNECTION_ERROR);
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
      setError(CONNECTION_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevealNow() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const { error: revealError } = await supabase
        .from("sessions")
        .update({ phase: "reveal" })
        .eq("id", session.id)
        .eq("phase", "writing");
      if (revealError) setError(CONNECTION_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // Facilitator gives the whole room one more minute (everyone's clock is derived
  // from writing_ends_at, so this reaches every screen at once).
  async function handleAddMinute() {
    if (!session?.writing_ends_at || (secondsLeft !== null && secondsLeft <= 0)) return;
    setError(null);
    const extended = new Date(
      new Date(session.writing_ends_at).getTime() + 60 * 1000
    ).toISOString();
    const { data, error: extendError } = await supabase
      .from("sessions")
      .update({ writing_ends_at: extended })
      .eq("id", session.id)
      .eq("phase", "writing")
      .select()
      .single();
    if (extendError) {
      setError(CONNECTION_ERROR);
      return;
    }
    setSession(data);
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
      setError(CONNECTION_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // Returns whether the save landed, so the form can show "Saved" or an error.
  // It deliberately doesn't touch myUpdate: a slow autosave response arriving after
  // Submit would otherwise flip the page back to the editable form.
  async function handleAutosave(fields: UpdateFields): Promise<boolean> {
    if (!myUpdate) return false;
    const { error: saveError } = await supabase
      .from("updates")
      .update(fields)
      .eq("id", myUpdate.id);
    return !saveError;
  }

  // Submit writes the final field values and the submitted flag in one request.
  async function handleSubmitUpdate(fields: UpdateFields) {
    if (!myUpdate) return;
    setBusy(true);
    setError(null);
    const { data, error: submitError } = await supabase
      .from("updates")
      .update({ ...fields, submitted_at: new Date().toISOString() })
      .eq("id", myUpdate.id)
      .select()
      .single();
    setBusy(false);
    if (submitError || !data) {
      setError("Couldn't submit your update. Your text is still here, so try again.");
      return;
    }
    setMyUpdate(data);
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

  // Facilitator marks a flagged topic as discussed (a ✅ reaction on the same field),
  // which syncs live to everyone like any other reaction.
  async function handleToggleDiscussed(updateId: string, fieldKey: string) {
    if (!me || !session || me.id !== session.facilitator_participant_id) return;

    const existing = reactions.filter(
      (r) =>
        r.target_type === "field" &&
        r.target_update_id === updateId &&
        r.field_key === fieldKey &&
        r.emoji === DISCUSSED_EMOJI
    );

    if (existing.length > 0) {
      const ids = existing.map((r) => r.id);
      const { error: undoError } = await supabase.from("reactions").delete().in("id", ids);
      if (undoError) {
        setError(CONNECTION_ERROR);
        return;
      }
      setReactions((prev) => prev.filter((r) => !ids.includes(r.id)));
      return;
    }

    const { data, error: markError } = await supabase
      .from("reactions")
      .insert({
        session_id: session.id,
        target_type: "field",
        target_update_id: updateId,
        field_key: fieldKey,
        emoji: DISCUSSED_EMOJI,
        participant_id: me.id,
      })
      .select()
      .single();
    if (markError) {
      setError(CONNECTION_ERROR);
      return;
    }
    if (data) setReactions((prev) => [...prev, data]);
  }

  async function handleToggleFlag(updateId: string, fieldKey: string) {
    if (!me || !session || me.id === VIEWER_ID) return;

    const existing = reactions.find(
      (r) =>
        r.target_type === "field" &&
        r.target_update_id === updateId &&
        r.field_key === fieldKey &&
        r.emoji === FLAG_EMOJI &&
        r.participant_id === me.id
    );

    if (existing) {
      const { error: unflagError } = await supabase
        .from("reactions")
        .delete()
        .eq("id", existing.id);
      if (unflagError) {
        setError(CONNECTION_ERROR);
        return;
      }
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      return;
    }

    const { data, error: flagError } = await supabase
      .from("reactions")
      .insert({
        session_id: session.id,
        target_type: "field",
        target_update_id: updateId,
        field_key: fieldKey,
        emoji: FLAG_EMOJI,
        participant_id: me.id,
      })
      .select()
      .single();
    if (flagError) {
      setError(CONNECTION_ERROR);
      return;
    }
    if (data) setReactions((prev) => [...prev, data]);
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-grafite dark:text-marmol/70">Loading…</p>
      </main>
    );
  }

  const isFacilitator = !!me && me.id === session?.facilitator_participant_id;
  const isViewer = me?.id === VIEWER_ID;
  // Strictly submitted people (for the live "who's done" display during writing)...
  const submittedCount = allUpdates.filter((u) => u.submitted_at).length;
  const stillWriting = participants.length - submittedCount;
  const iHaveSubmitted = !!myUpdate?.submitted_at;
  const lastToSubmit = participants.length > 1 && !iHaveSubmitted && stillWriting === 1;
  // ...versus everyone with something to show once the reveal happens (drafts count).
  const updatesInCount = allUpdates.filter(isShown).length;
  const notSubmittedNames = participants
    .filter((p) => !allUpdates.some((u) => u.participant_id === p.id && u.submitted_at))
    .map((p) => p.display_name);
  const everyoneSubmitted = participants.length > 0 && notSubmittedNames.length === 0;
  // The rock rotation is deterministic, so the wrap-up can tease next week's.
  const nextRockName = session
    ? getCurrentRock(new Date(parseWeekOf(session.week_of).getTime() + 7 * 24 * 60 * 60 * 1000)).name
    : "";
  // Time the team actually saved: how much clock was left when the last person submitted.
  const lastSubmittedAt = allUpdates.reduce(
    (latest, u) => (u.submitted_at ? Math.max(latest, new Date(u.submitted_at).getTime()) : latest),
    0
  );
  const spareSeconds =
    everyoneSubmitted && session?.writing_ends_at && lastSubmittedAt
      ? Math.floor((new Date(session.writing_ends_at).getTime() - lastSubmittedAt) / 1000)
      : 0;
  const facilitatorName =
    participants.find((p) => p.id === session?.facilitator_participant_id)?.display_name ??
    "the facilitator";
  const showingResults =
    !!me && (session?.phase === "reveal" || session?.phase === "closed");
  // Counts come from the agenda itself, so items added by "Blocked or struggling" count too.
  const agendaItems = buildAgenda(participants, allUpdates, reactions).flagged;
  const flaggedTopicCount = agendaItems.length;
  const discussedCount = agendaItems.filter((item) => item.discussed).length;
  const leftToDiscuss = flaggedTopicCount - discussedCount;

  const timerRatio =
    secondsLeft === null ? 1 : Math.min(1, Math.max(0, secondsLeft / timerCeiling));
  const timerUrgent = secondsLeft !== null && secondsLeft <= 30;
  const countdownBeat =
    secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 3
      ? Math.ceil(secondsLeft)
      : null;
  const timerAnnouncement =
    secondsLeft === null
      ? ""
      : secondsLeft <= 10
      ? "10 seconds left"
      : secondsLeft <= 30
      ? "30 seconds left"
      : secondsLeft <= 60
      ? "1 minute left"
      : "";

  const nameIsParticipant = participants.some(
    (p) => p.display_name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  const readOnlyJoin =
    !!session &&
    (session.phase === "reveal" || session.phase === "closed") &&
    !nameIsParticipant;

  const joinCopy = !session
    ? ""
    : session.phase === "closed"
    ? "This week's session has ended. Enter your name to see what was shared."
    : session.phase === "reveal"
    ? "This week's updates are already revealed. Enter your name to read them."
    : session.phase === "writing"
    ? "Writing is under way. Join now to add your update before time's up."
    : participants.length === 0
    ? "This week's session is open. Be the first to join."
    : "This week's session is open. Join in.";

  const primaryButton =
    "min-h-11 rounded-lg bg-ember-fill px-4 py-2 font-semibold text-white transition disabled:opacity-50";

  return (
    <main
      className={`mx-auto flex w-full flex-1 flex-col gap-6 px-6 py-10 ${
        showingResults ? "max-w-6xl" : "max-w-md"
      }`}
    >
      <div
        className={`flex w-full flex-col gap-6 ${
          showingResults ? "" : "mx-auto max-w-md"
        }`}
      >
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-3xl font-bold text-ardesia dark:text-marmol">
            Rock Report
          </h1>
          {!(me && session?.phase === "writing") && (
            <Link
              href="/archive"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-ember-ink"
            >
              Past sessions →
            </Link>
          )}
        </div>

        {/* The rock is for the doorway; during the 3-minute timer the form comes first. */}
        {!showingResults && session?.phase !== "writing" && <RockCard />}
      </div>

      {me && !isViewer && (
        <p className="-mt-3 text-sm text-grafite dark:text-marmol/70">
          You&apos;re {me.display_name}.{" "}
          <button
            type="button"
            onClick={() => {
              setChosenMe(null);
              setOptedOut(true);
            }}
            className="inline-flex min-h-8 items-center font-semibold text-ember-ink underline underline-offset-2"
          >
            Not you?
          </button>
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-ember-ink">
          {error}
        </p>
      )}

      {!session && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreateSession();
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-grafite dark:text-marmol/80">
            No session yet this week. Starting one makes you the facilitator: you
            start the timer and control the reveal.
          </p>
          <NameInput name={name} setName={updateName} disabled={busy} />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className={primaryButton}
          >
            Create this week&apos;s session
          </button>
        </form>
      )}

      {session && !me && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleJoin();
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-grafite dark:text-marmol/80">{joinCopy}</p>
          {participants.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => updateName(p.display_name)}
                  className="min-h-9 rounded-full border border-grafite/40 bg-white px-3 py-1 text-sm text-ardesia transition hover:bg-stone dark:border-white/30 dark:bg-white/10 dark:text-marmol dark:hover:bg-white/15"
                >
                  {p.display_name}
                </button>
              ))}
            </div>
          )}
          <NameInput name={name} setName={updateName} disabled={busy} />
          {nameSuggestion && (
            <div
              role="group"
              aria-label="Did you mean someone already here?"
              className="flex flex-col gap-2 rounded-lg border border-grafite/70 p-3 dark:border-white/40"
            >
              <p className="text-sm text-ardesia dark:text-marmol">
                Did you mean <strong>{nameSuggestion.display_name}</strong>? That name
                is already in this session.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setName(nameSuggestion.display_name);
                    void handleJoin({ name: nameSuggestion.display_name });
                  }}
                  className="min-h-11 rounded-lg bg-ember-fill px-3 text-sm font-semibold text-white"
                >
                  Yes, I&apos;m {nameSuggestion.display_name}
                </button>
                <button
                  type="button"
                  onClick={() => void handleJoin({ name: name.trim(), forceNew: true })}
                  className="min-h-11 rounded-lg border border-grafite/50 px-3 text-sm font-semibold text-ardesia dark:border-white/40 dark:text-marmol"
                >
                  No, I&apos;m {name.trim()}
                </button>
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className={primaryButton}
          >
            {readOnlyJoin ? "View updates" : "Join"}
          </button>
        </form>
      )}

      {session && me && session.phase === "lobby" && (
        <div className="flex flex-col gap-4">
          <PresenceList participants={participants} session={session} />
          {isFacilitator ? (
            <>
              <p className="text-sm text-grafite dark:text-marmol/80">
                You&apos;re the facilitator: you start the timer and can reveal
                everyone&apos;s updates early.
              </p>
              <CopyButton
                label="Copy invite link"
                copiedText="Copied. Teammates open it to join."
                getText={() => window.location.origin}
              />
              <button
                type="button"
                onClick={handleStartWriting}
                disabled={busy}
                className={primaryButton}
              >
                Start writing (3:00)
              </button>
            </>
          ) : (
            <p className="text-sm text-grafite dark:text-marmol/80">
              You&apos;re in. Waiting for {facilitatorName} to start writing.
            </p>
          )}
        </div>
      )}

      {session && me && session.phase === "writing" && (
        <div className="flex flex-col gap-5">
          {/* The room, at a glance: the clock and who has finished. Stays in view. */}
          <div className="sticky top-0 z-10 border-b border-grafite/20 bg-background pb-3 pt-3 dark:border-white/15">
            <div className="flex items-end justify-between gap-4">
              <p
                role="timer"
                aria-label="Time left"
                className={`font-heading text-5xl font-bold tabular-nums ${
                  timerUrgent ? "timer-urgent text-ember-ink" : "text-ember"
                }`}
              >
                {secondsLeft !== null ? formatClock(secondsLeft) : "3:00"}
              </p>
              <div className="flex items-center gap-3 pb-1">
                <p className="text-sm text-grafite dark:text-marmol/80">
                  {submittedCount} of {participants.length} submitted
                </p>
                {isFacilitator && (
                  <button
                    type="button"
                    onClick={handleAddMinute}
                    className="min-h-11 rounded-lg border border-grafite/50 px-3 text-sm font-semibold text-ardesia transition hover:border-ember-ink hover:text-ember-ink dark:border-white/40 dark:text-marmol"
                  >
                    +1 min
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-grafite/15 dark:bg-white/15">
              <div
                className="h-full origin-left rounded-full bg-ember-fill transition-transform duration-300 ease-linear"
                style={{ transform: `scaleX(${timerRatio})` }}
              />
            </div>
            <p className="sr-only" role="status" aria-live="polite">
              {timerAnnouncement}
            </p>
            <ul
              aria-label="Who has submitted"
              className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5"
            >
              {participants.map((p) => {
                const done = allUpdates.some(
                  (u) => u.participant_id === p.id && u.submitted_at
                );
                return (
                  <li
                    key={p.id}
                    className={`inline-flex items-center gap-1.5 text-sm ${
                      done
                        ? "font-semibold text-ardesia dark:text-marmol"
                        : "text-grafite dark:text-marmol/70"
                    }`}
                  >
                    {done ? (
                      <CheckIcon className="size-4 text-ember-ink" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full bg-grafite/50 motion-safe:animate-pulse dark:bg-white/40"
                      />
                    )}
                    {p.display_name}
                    <span className="sr-only">{done ? " has submitted" : " is still writing"}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {myUpdate && !myUpdate.submitted_at && (
            <WritingForm
              initialFields={myUpdate}
              onAutosave={handleAutosave}
              onSubmit={handleSubmitUpdate}
              submitting={busy}
              lastToSubmit={lastToSubmit}
            />
          )}

          {myUpdate && myUpdate.submitted_at && (
            <div className="flex flex-col gap-4">
              <p className="flex items-center gap-2 text-base font-semibold text-ardesia dark:text-marmol">
                <CheckIcon className="draw-check size-5 shrink-0 text-ember-ink" />
                <span>
                Submitted.{" "}
                {stillWriting > 0
                  ? `Waiting for ${stillWriting} more…`
                  : "Revealing now…"}
                </span>
              </p>
              <SubmittedSummary fields={myUpdate} />
              <button
                type="button"
                onClick={handleUnsubmit}
                className="min-h-11 self-start rounded-lg border border-grafite/50 px-3 text-sm font-semibold text-ardesia transition dark:border-white/40 dark:text-marmol"
              >
                Edit my answers
              </button>
              <p className="-mt-2 text-sm text-grafite dark:text-marmol/80">
                Editing un-submits you, so submit again when you&apos;re done.
              </p>
              {/* A moment for the wait; the Rock stays out of the way while writing. */}
              <RockCard />
            </div>
          )}

          {isFacilitator && (
            <div className="mt-4 flex flex-col gap-2 border-t border-grafite/20 pt-5 dark:border-white/15">
              <ConfirmButton
                label="End writing and reveal"
                prompt={`${notSubmittedNames.join(", ")} ${
                  notSubmittedNames.length === 1 ? "hasn't" : "haven't"
                } submitted yet. Reveal everyone's updates now?`}
                confirmLabel="Yes, reveal"
                needsConfirm={submittedCount < participants.length}
                onConfirm={handleRevealNow}
                disabled={busy}
                className="min-h-11 self-start rounded-lg border border-ember-ink px-3 text-sm font-semibold text-ember-ink transition disabled:opacity-50"
              />
            </div>
          )}
        </div>
      )}

      {countdownBeat !== null && session?.phase === "writing" && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-20 grid place-items-center"
        >
          <span
            key={countdownBeat}
            className="count-beat font-heading text-8xl font-bold leading-none text-ember"
          >
            {countdownBeat}
          </span>
        </div>
      )}

      {showingResults && session && me && (
        <div className="flex flex-col gap-8">
          <header className="arrive">
            <h2 className="font-heading text-3xl font-bold text-ardesia dark:text-marmol">
              {session.phase === "closed"
                ? "That’s a wrap"
                : everyoneSubmitted
                ? "Everyone’s in"
                : "Updates are in"}
            </h2>
            <p className="mt-1 text-base text-grafite dark:text-marmol/80">
              {session.phase === "closed"
                ? `${updatesInCount} ${updatesInCount === 1 ? "update" : "updates"} shared${
                    discussedCount === 0
                      ? ""
                      : leftToDiscuss === 0
                      ? ` · all ${flaggedTopicCount} flagged ${
                          flaggedTopicCount === 1 ? "topic" : "topics"
                        } discussed`
                      : ` · ${discussedCount} flagged ${
                          discussedCount === 1 ? "topic" : "topics"
                        } discussed`
                  }`
                : `${updatesInCount} ${updatesInCount === 1 ? "update" : "updates"} in${
                    spareSeconds >= 5 ? ` · ${formatClock(spareSeconds)} to spare` : ""
                  }${
                    flaggedTopicCount > 0
                      ? ` · ${flaggedTopicCount} ${
                          flaggedTopicCount === 1 ? "topic" : "topics"
                        } flagged for discussion`
                      : ""
                  } · Facilitator: ${facilitatorName}`}
            </p>
            {session.phase === "closed" && (
              <p className="mt-1 text-sm text-grafite dark:text-marmol/80">
                Read-only now. See you next week. Next up: {nextRockName}.
              </p>
            )}
            {session.phase === "closed" && (
              <div className="mt-4">
                <CopyButton
                  primary
                  label="Copy meeting notes"
                  copiedText="Copied. Paste it into Slack or Notion."
                  getText={() =>
                    buildMeetingNotes({
                      weekLabel: formatWeekOf(session.week_of),
                      participants,
                      updates: allUpdates,
                      reactions,
                    })
                  }
                />
              </div>
            )}
            {isViewer && (
              <p className="mt-1 text-sm text-grafite dark:text-marmol/80">
                You&apos;re viewing this week&apos;s updates read-only. Only people who
                joined before the reveal can flag topics.
              </p>
            )}
          </header>

          <AgendaPanel
            participants={participants}
            updates={allUpdates}
            reactions={reactions}
            canMarkDiscussed={isFacilitator && session.phase === "reveal"}
            canFlag={!isViewer && session.phase === "reveal"}
            closed={session.phase === "closed"}
            onToggleDiscussed={handleToggleDiscussed}
            animate={session.phase === "reveal"}
          />

          <section aria-labelledby="updates-heading" className="flex flex-col gap-4">
            <h2
              id="updates-heading"
              className="font-heading text-2xl font-bold text-ardesia dark:text-marmol"
            >
              Everyone&apos;s updates
            </h2>
            {session.phase === "reveal" && !isViewer && (
              <p className="-mt-2 text-base text-grafite dark:text-marmol/80">
                Click or tap Flag on anything the team should discuss. The more flags, the higher it sits on the agenda.
              </p>
            )}
            <RevealGrid
              participants={participants}
              updates={allUpdates}
              reactions={reactions}
              myParticipantId={me.id}
              onToggleFlag={handleToggleFlag}
              readOnly={session.phase === "closed" || isViewer}
              animate={session.phase === "reveal"}
            />
          </section>

          {session.phase === "closed" ? <RockCard /> : <RockCard compact />}

        </div>
      )}

      {showingResults && session?.phase === "reveal" && isFacilitator && (
        <div className="sticky bottom-0 z-10 -mx-6 -mb-10 border-t border-grafite/20 bg-background px-6 py-3 dark:border-white/15">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-base font-semibold text-ardesia dark:text-marmol">
              {flaggedTopicCount === 0
                ? "No topics flagged yet"
                : leftToDiscuss === 0
                ? "All topics discussed"
                : `${leftToDiscuss} left to discuss`}
            </p>
            <ConfirmButton
              label="Close session"
              prompt={`${
                leftToDiscuss > 0
                  ? `${leftToDiscuss} flagged ${
                      leftToDiscuss === 1 ? "topic hasn't" : "topics haven't"
                    } been discussed. `
                  : ""
              }Close this session for everyone? Updates become read-only.`}
              confirmLabel="Yes, close it"
              onConfirm={handleCloseSession}
              disabled={busy}
              className="min-h-11 rounded-lg bg-ardesia px-4 py-2 font-semibold text-white transition disabled:opacity-50 dark:bg-marmol dark:text-ardesia"
            />
          </div>
        </div>
      )}
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
      <h2 className="text-sm font-semibold text-ardesia dark:text-marmol">
        Who&apos;s here ({participants.length})
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {participants.map((p) => (
          <li
            key={p.id}
            className="settle rounded-full border border-grafite/20 px-3 py-1 text-sm text-ardesia dark:border-white/20 dark:text-marmol"
          >
            {p.display_name}
            {p.id === session.facilitator_participant_id && (
              <span className="ml-1.5 text-xs text-grafite dark:text-marmol/70">
                facilitator
              </span>
            )}
          </li>
        ))}
      </ul>
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
      aria-label="Your name"
      autoComplete="name"
      disabled={disabled}
      className={inputClass}
    />
  );
}
