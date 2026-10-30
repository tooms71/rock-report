"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getMondayOfWeek, formatWeekOf, parseWeekOf } from "@/lib/date";
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
import { OpenRoles } from "@/components/OpenRoles";
import { SubmittedSummary } from "@/components/SubmittedSummary";
import { RoleUpdates } from "@/components/RoleUpdates";
import type { Social } from "@/components/Reactions";
import type { CommentRow } from "@/lib/social";
import type { RoleUpdateRow } from "@/lib/roleStatus";
import { buildMeetingNotes } from "@/lib/summary";
import { buildAgenda } from "@/lib/agenda";
import { isShown } from "@/lib/updates";
import { displayNameFor } from "@/lib/names";
import { FACILITATOR_NAME, isFacilitatorEmail } from "@/lib/facilitators";
import { signOut, useCurrentUser } from "@/components/AuthGate";
import { CheckIcon } from "@/components/Icons";

// Someone who opens a session that's already revealed or closed just reads it;
// they aren't added as a participant (that would create an empty card for them).
const VIEWER_ID = "viewer";

// Live updates arrive over a websocket, but one missed message must never leave a screen
// out of date, so every screen also re-reads the session every few seconds.
const POLL_MS = 3000;
const PHASE_ORDER = ["lobby", "writing", "reveal", "agenda", "closed"];
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const CONNECTION_ERROR =
  "Couldn't reach the database. Check your connection (or whether Supabase is paused), then try again.";

type SessionRow = {
  id: string;
  week_of: string;
  phase: string;
};

type ParticipantRow = {
  id: string;
  session_id: string;
  user_id: string | null;
  display_name: string;
  joined_at: string;
};

type UpdateRow = UpdateFields & {
  id: string;
  session_id: string;
  participant_id: string;
  submitted_at: string | null;
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const user = useCurrentUser();
  // Bec runs the meeting every week (see src/lib/facilitators.ts), whoever opens the app first.
  const isFacilitator = isFacilitatorEmail(user.email);
  // Who I am in this session comes from my Google sign-in, not a typed name.
  const myParticipant = participants.find((p) => p.user_id === user.id) ?? null;
  const myDisplayName =
    myParticipant?.display_name ??
    displayNameFor(user, participants.map((p) => p.display_name));
  // Opening a session that's already revealed or closed just reads it; the person isn't
  // added as a participant (that would create an empty card for them).
  const viewerMe: ParticipantRow | null =
    !myParticipant && session && (session.phase === "reveal" || session.phase === "agenda" || session.phase === "closed")
      ? { id: VIEWER_ID, session_id: session.id, user_id: user.id, display_name: myDisplayName, joined_at: "" }
      : null;
  const me = myParticipant ?? viewerMe;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allUpdates, setAllUpdates] = useState<UpdateRow[]>([]);
  const [myUpdate, setMyUpdate] = useState<UpdateRow | null>(null);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  // What people tapped for their open roles this week (offers extended or accepted,
  // stalled, on track).
  const [roleUpdates, setRoleUpdates] = useState<RoleUpdateRow[]>([]);
  // Comments people leave on each other's wins.
  const [comments, setComments] = useState<CommentRow[]>([]);
  // Bumped whenever I change something, so a refresh that was already in flight can't
  // overwrite my change with older data.
  const mutationVersion = useRef(0);
  const bump = () => {
    mutationVersion.current += 1;
  };

  // Load this week's session (if any) and its participants.
  useEffect(() => {
    let active = true;

    async function load() {
      const weekOf = getMondayOfWeek(new Date());
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("*")
        .eq("week_of", weekOf)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      // A session left over from the old flow, still waiting in the lobby, opens for writing.
      if (sessionData?.phase === "lobby") {
        await supabase.from("sessions").update({ phase: "writing" }).eq("id", sessionData.id);
        sessionData.phase = "writing";
      }

      // Load who is in the session before showing it. Otherwise a returning visitor looks
      // like a stranger for a moment and the app tries to add them a second time.
      let participantsData: ParticipantRow[] = [];
      if (sessionData) {
        const { data } = await supabase
          .from("participants")
          .select("*")
          .eq("session_id", sessionData.id)
          .order("joined_at", { ascending: true });
        participantsData = data ?? [];
      }

      if (!active) return;
      setParticipants(participantsData);
      setSession(sessionData);
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

  // Load this week's role updates, then keep them live.
  useEffect(() => {
    if (!session) return;
    const sessionId = session.id;
    let active = true;
    supabase
      .from("role_updates")
      .select("*")
      .eq("session_id", sessionId)
      .then(({ data }) => {
        if (active && data) setRoleUpdates(data as RoleUpdateRow[]);
      });
    const channel = supabase
      .channel(`role-updates-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "role_updates", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id: string };
            setRoleUpdates((prev) => prev.filter((r) => r.id !== oldRow.id));
          } else {
            const row = payload.new as RoleUpdateRow;
            setRoleUpdates((prev) =>
              prev.some((r) => r.id === row.id) ? prev.map((r) => (r.id === row.id ? row : r)) : [...prev, row]
            );
          }
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // Load this week's comments on wins, then keep them live.
  useEffect(() => {
    if (!session) return;
    const sessionId = session.id;
    let active = true;
    supabase
      .from("comments")
      .select("*")
      .eq("session_id", sessionId)
      .then(({ data }) => {
        if (active && data) setComments(data as CommentRow[]);
      });
    const channel = supabase
      .channel(`comments-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as CommentRow;
          setComments((prev) => (prev.some((c) => c.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // Load this session's reactions (upvotes, discussed marks and emoji), then keep them live.
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

  // Nobody clicks "create" or "join": opening the app opens the week's session and puts
  // you in it, so you can go straight to writing.
  const creatingRef = useRef(false);
  const joiningRef = useRef(false);
  useEffect(() => {
    if (loading || session || creatingRef.current) return;
    creatingRef.current = true;
    void handleCreateSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);
  useEffect(() => {
    if (!session || session.phase !== "writing" || myParticipant || joiningRef.current) return;
    joiningRef.current = true;
    void handleJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.phase, myParticipant]);

  // The moment I'm in the session, make sure I have a draft row to autosave into.
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

  // Keep this screen in step with the database even if a live message is missed.
  const sessionClosed = session?.phase === "closed";
  useEffect(() => {
    if (!session?.id || sessionClosed) return;
    const sessionId = session.id;
    let active = true;

    async function refresh() {
      if (document.hidden) return;
      const version = mutationVersion.current;
      const [s, p, u, r, ro, co] = await Promise.all([
        supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
        supabase
          .from("participants")
          .select("*")
          .eq("session_id", sessionId)
          .order("joined_at", { ascending: true }),
        supabase.from("updates").select("*").eq("session_id", sessionId),
        supabase.from("reactions").select("*").eq("session_id", sessionId),
        supabase.from("role_updates").select("*").eq("session_id", sessionId),
        supabase.from("comments").select("*").eq("session_id", sessionId),
      ]);
      // If I changed something while this was in flight, my change is newer than this data.
      if (!active || version !== mutationVersion.current) return;

      const fresh = s.data as SessionRow | null;
      if (fresh) {
        // A session only moves forward, so an older answer never wins.
        setSession((prev) =>
          prev && PHASE_ORDER.indexOf(fresh.phase) < PHASE_ORDER.indexOf(prev.phase)
            ? prev
            : sameJson(prev, fresh)
            ? prev
            : fresh
        );
      }
      if (p.data) {
        // People only ever join, so keep anyone already known and add anyone new.
        const found = p.data as ParticipantRow[];
        setParticipants((prev) => {
          const known = new Set(prev.map((x) => x.id));
          const added = found.filter((x) => !known.has(x.id));
          return added.length === 0 ? prev : [...prev, ...added];
        });
      }
      if (u.data) setAllUpdates((prev) => (sameJson(prev, u.data) ? prev : (u.data as UpdateRow[])));
      if (r.data) setReactions((prev) => (sameJson(prev, r.data) ? prev : (r.data as ReactionRow[])));
      if (ro.data) {
        setRoleUpdates((prev) => (sameJson(prev, ro.data) ? prev : (ro.data as RoleUpdateRow[])));
      }
      if (co.data) setComments((prev) => (sameJson(prev, co.data) ? prev : (co.data as CommentRow[])));
    }

    const interval = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [session?.id, sessionClosed]);

  // Arrive at the top of the reveal, not wherever the writing form was scrolled to.
  useEffect(() => {
    if (session?.phase === "reveal" || session?.phase === "agenda") window.scrollTo({ top: 0 });
  }, [session?.phase]);

  // The week's session opens by itself the first time anyone visits, and everyone writes
  // into it any time before the meeting. If two people open the app at the same moment and
  // both create one, the earlier session wins and the later one is removed.
  async function handleCreateSession() {
    setBusy(true);
    setError(null);
    try {
      const weekOf = getMondayOfWeek(new Date());

      const { data: created, error: sessionError } = await supabase
        .from("sessions")
        .insert({ week_of: weekOf, phase: "writing" })
        .select()
        .single();
      if (sessionError) throw sessionError;

      const { data: earliest } = await supabase
        .from("sessions")
        .select("*")
        .eq("week_of", weekOf)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      let target: SessionRow = created;
      if (earliest && earliest.id !== created.id) {
        await supabase.from("sessions").delete().eq("id", created.id);
        target = earliest;
      }

      const { data: already } = await supabase
        .from("participants")
        .select("id")
        .eq("session_id", target.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!already) {
        const { error: participantError } = await supabase.from("participants").insert({
          session_id: target.id,
          user_id: user.id,
          display_name: displayNameFor(user, []),
        });
        if (participantError) throw participantError;
      }

      const { data: everyone } = await supabase
        .from("participants")
        .select("*")
        .eq("session_id", target.id)
        .order("joined_at", { ascending: true });
      setSession(target);
      setParticipants(everyone ?? []);
    } catch {
      creatingRef.current = false;
      setError(CONNECTION_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    bump();
    if (!session || myParticipant) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from("participants")
        .insert({ session_id: session.id, user_id: user.id, display_name: myDisplayName })
        .select()
        .single();
      // Already in this session (a second tab, or a join that crossed with a reload)? That is
      // fine: use the existing row instead of showing an error.
      if (insertError?.code === "23505") {
        const { data: existing } = await supabase
          .from("participants")
          .select("*")
          .eq("session_id", session.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing) {
          setParticipants((prev) => (prev.some((p) => p.id === existing.id) ? prev : [...prev, existing]));
          return;
        }
      }
      if (insertError) throw insertError;
      setParticipants((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
    } catch {
      setError(CONNECTION_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // Facilitator starts the meeting: everyone's updates are revealed for reading and upvoting.
  async function handleStartMeeting() {
    bump();
    if (!session || !isFacilitator) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: revealError } = await supabase
        .from("sessions")
        .update({ phase: "reveal" })
        .eq("id", session.id)
        .eq("phase", "writing")
        .select()
        .single();
      if (revealError) throw revealError;
      setSession(data);
    } catch {
      setError(CONNECTION_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // Facilitator moves the room from reading and flagging to the meeting agenda.
  async function handleStartAgenda() {
    bump();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: agendaError } = await supabase
        .from("sessions")
        .update({ phase: "agenda" })
        .eq("id", session.id)
        .eq("phase", "reveal")
        .select()
        .single();
      if (agendaError) throw agendaError;
      setSession(data);
    } catch {
      setError(CONNECTION_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseSession() {
    bump();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: closeError } = await supabase
        .from("sessions")
        .update({ phase: "closed" })
        .eq("id", session.id)
        .in("phase", ["reveal", "agenda"])
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
    bump();
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
    bump();
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
    bump();
    if (!me || !session || !isFacilitator) return;

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

  // Adds my reaction of this kind to a field, or takes it back if I already gave it. Upvotes
  // and emoji on wins are both reactions; only the emoji differs.
  async function toggleReaction(updateId: string, fieldKey: string, emoji: string) {
    bump();
    if (!me || !session || me.id === VIEWER_ID) return;

    const existing = reactions.find(
      (r) =>
        r.target_type === "field" &&
        r.target_update_id === updateId &&
        r.field_key === fieldKey &&
        r.emoji === emoji &&
        r.participant_id === me.id
    );

    if (existing) {
      const { error: removeError } = await supabase
        .from("reactions")
        .delete()
        .eq("id", existing.id);
      if (removeError) {
        setError(CONNECTION_ERROR);
        return;
      }
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      return;
    }

    const { data, error: addError } = await supabase
      .from("reactions")
      .insert({
        session_id: session.id,
        target_type: "field",
        target_update_id: updateId,
        field_key: fieldKey,
        emoji,
        participant_id: me.id,
      })
      .select()
      .single();
    if (addError) {
      setError(CONNECTION_ERROR);
      return;
    }
    if (data) setReactions((prev) => [...prev, data]);
  }

  const handleToggleFlag = (updateId: string, fieldKey: string) =>
    toggleReaction(updateId, fieldKey, FLAG_EMOJI);

  async function handleAddComment(updateId: string, fieldKey: string, body: string): Promise<boolean> {
    bump();
    if (!me || !session || me.id === VIEWER_ID) return false;
    const { data, error: commentError } = await supabase
      .from("comments")
      .insert({
        session_id: session.id,
        target_type: "field",
        target_update_id: updateId,
        field_key: fieldKey,
        participant_id: me.id,
        body,
      })
      .select()
      .single();
    if (commentError || !data) {
      setError(CONNECTION_ERROR);
      return false;
    }
    setComments((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data as CommentRow]));
    return true;
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-grafite dark:text-marmol/70">Loading…</p>
      </main>
    );
  }

  const isViewer = me?.id === VIEWER_ID;
  // Strictly submitted people (for the "who's done" display while writing)...
  const submittedCount = allUpdates.filter((u) => u.submitted_at).length;
  // ...versus everyone with something to show once the reveal happens (drafts count).
  const updatesInCount = allUpdates.filter((u) =>
    isShown(u, roleUpdates.some((r) => r.participant_id === u.participant_id))
  ).length;
  const myRoleUpdates = roleUpdates.filter((r) => r.participant_id === me?.id);
  const notSubmittedNames = participants
    .filter((p) => !allUpdates.some((u) => u.participant_id === p.id && u.submitted_at))
    .map((p) => p.display_name);
  const everyoneSubmitted = participants.length > 0 && notSubmittedNames.length === 0;
  // The rock rotation is deterministic, so the wrap-up can tease next week's.
  const nextRockName = session
    ? getCurrentRock(new Date(parseWeekOf(session.week_of).getTime() + 7 * 24 * 60 * 60 * 1000)).name
    : "";
  const showingResults =
    !!me &&
    (session?.phase === "reveal" || session?.phase === "agenda" || session?.phase === "closed");
  const inReveal = session?.phase === "reveal";
  const inAgenda = session?.phase === "agenda";
  const isClosed = session?.phase === "closed";
  // Counts come from the agenda itself, so they match what the room sees.
  const agendaItems = buildAgenda(participants, allUpdates, reactions, roleUpdates).discussion;
  const flaggedTopicCount = agendaItems.length;
  const discussedCount = agendaItems.filter((item) => item.discussed).length;
  const leftToDiscuss = flaggedTopicCount - discussedCount;

  const facilitatorName = FACILITATOR_NAME;
  // Emoji and comments on what people wrote: open while reading and in the meeting, read-only once closed.
  const social: Social = {
    comments,
    nameOf: (participantId) =>
      participants.find((p) => p.id === participantId)?.display_name ?? "Someone",
    myParticipantId: me?.id ?? "",
    canReact: !!me && !isViewer && !isClosed,
    onToggleEmoji: (updateId, fieldKey, emoji) => void toggleReaction(updateId, fieldKey, emoji),
    onAddComment: handleAddComment,
  };

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
          <Link
            href="/archive"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ember-ink"
          >
            Past sessions →
          </Link>
        </div>

        {/* The rock is for the doorway: shown until the meeting starts. */}
        {!showingResults && <RockCard />}
      </div>

      <p className="-mt-3 text-sm text-grafite dark:text-marmol/70">
        {me && !isViewer ? `You're ${me.display_name}.` : `Signed in as ${user.email}.`}{" "}
        <button
          type="button"
          onClick={signOut}
          className="inline-flex min-h-8 items-center font-semibold text-ember-ink underline underline-offset-2"
        >
          Sign out
        </button>
      </p>

      {error && (
        <p role="alert" className="text-sm font-semibold text-ember-ink">
          {error}
        </p>
      )}

      {!session && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-grafite dark:text-marmol/80" role="status">
            {error ? "This week's session couldn't be opened." : "Opening this week's session…"}
          </p>
          {error && (
            <button
              type="button"
              onClick={() => void handleCreateSession()}
              disabled={busy}
              className={primaryButton}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {session && !me && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-grafite dark:text-marmol/80" role="status">
            {busy ? "Joining…" : "Join this week's session to write your update."}
          </p>
          {!busy && (
            <button
              type="button"
              onClick={() => void handleJoin()}
              className={primaryButton}
            >
              Join as {myDisplayName}
            </button>
          )}
        </div>
      )}

      {session && me && session.phase === "writing" && (
        <div className="flex flex-col gap-5">
          {/* The room, at a glance: who has finished. Stays in view. */}
          <div className="sticky top-0 z-10 border-b border-grafite/20 bg-background pb-3 pt-3 dark:border-white/15">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-base font-semibold text-ardesia dark:text-marmol">
                {submittedCount} of {participants.length} submitted
              </p>
              {isFacilitator && (
                <ConfirmButton
                  label="Start the meeting"
                  prompt={`${notSubmittedNames.join(", ")} ${
                    notSubmittedNames.length === 1 ? "hasn't" : "haven't"
                  } submitted yet. Start the meeting and reveal everyone's updates now?`}
                  confirmLabel="Yes, start"
                  needsConfirm={submittedCount < participants.length}
                  onConfirm={handleStartMeeting}
                  disabled={busy}
                  className="min-h-11 rounded-lg bg-ember-fill px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                />
              )}
            </div>
            <ul
              aria-label="Who has submitted"
              className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5"
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

          <p className="text-base text-grafite dark:text-marmol/80">
            Write your update any time before the meeting. It saves as you go
            {isFacilitator
              ? ", and nobody sees it until you start the meeting."
              : `, and nobody sees it until ${facilitatorName} starts the meeting.`}
          </p>

          {myUpdate && !myUpdate.submitted_at && me && (
            <RoleUpdates
              sessionId={session.id}
              participantId={me.id}
              roleUpdates={roleUpdates}
              onSaved={(row) => {
                bump();
                setRoleUpdates((prev) =>
                  prev.some((r) => r.id === row.id)
                    ? prev.map((r) => (r.id === row.id ? row : r))
                    : [...prev.filter((r) => r.notion_page_id !== row.notion_page_id || r.participant_id !== row.participant_id), row]
                );
              }}
              onCleared={(id) => {
                bump();
                setRoleUpdates((prev) => prev.filter((r) => r.id !== id));
              }}
            />
          )}

          {myUpdate && !myUpdate.submitted_at && (
            <WritingForm
              initialFields={myUpdate}
              onAutosave={handleAutosave}
              onSubmit={handleSubmitUpdate}
              submitting={busy}
              isFacilitator={isFacilitator}
              hasRoleUpdates={myRoleUpdates.length > 0}
            />
          )}

          {myUpdate && myUpdate.submitted_at && (
            <div className="flex flex-col gap-4">
              <p className="flex items-center gap-2 text-base font-semibold text-ardesia dark:text-marmol">
                <CheckIcon className="draw-check size-5 shrink-0 text-ember-ink" />
                <span>Submitted. You can still edit until the meeting starts.</span>
              </p>
              <SubmittedSummary fields={myUpdate} roles={myRoleUpdates} />
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
            </div>
          )}

        </div>
      )}

      {showingResults && session && me && (
        <div className="flex flex-col gap-8">
          {!inReveal && (
            <header className="arrive">
              <h2 className="font-heading text-3xl font-bold text-ardesia dark:text-marmol">
                {isClosed ? "That’s a wrap" : "Today’s agenda"}
              </h2>
              <p className="mt-1 text-base text-grafite dark:text-marmol/80">
                {isClosed
                  ? `${updatesInCount} ${updatesInCount === 1 ? "update" : "updates"} shared${
                      discussedCount === 0
                        ? ""
                        : leftToDiscuss === 0
                        ? ` · all ${flaggedTopicCount} ${
                            flaggedTopicCount === 1 ? "topic" : "topics"
                          } discussed`
                        : ` · ${discussedCount} ${
                            discussedCount === 1 ? "topic" : "topics"
                          } discussed`
                    }`
                  : `${flaggedTopicCount} ${
                      flaggedTopicCount === 1 ? "topic" : "topics"
                    } to discuss`}
              </p>
              {isClosed && (
                <p className="mt-1 text-sm text-grafite dark:text-marmol/80">
                  Read-only now. See you next week. Next up: {nextRockName}.
                </p>
              )}
              {isClosed && (
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
                        roleUpdates,
                        comments,
                      })
                    }
                  />
                </div>
              )}
              {isViewer && (
                <p className="mt-1 text-sm text-grafite dark:text-marmol/80">
                  You&apos;re viewing this week&apos;s updates read-only.
                </p>
              )}
            </header>
          )}

          {!inReveal && (
            <AgendaPanel
              participants={participants}
              updates={allUpdates}
              reactions={reactions}
              roleUpdates={roleUpdates}
              social={social}
              canMarkDiscussed={isFacilitator && inAgenda}
              closed={isClosed}
              onToggleDiscussed={handleToggleDiscussed}
              animate={inAgenda}
            />
          )}

          {inReveal ? (
            <section aria-labelledby="updates-heading" className="flex flex-col gap-4">
              <h2
                id="updates-heading"
                className="font-heading text-2xl font-bold text-ardesia dark:text-marmol"
              >
                Everyone&apos;s updates
              </h2>
              {/* Did everyone make it? Said once, here, instead of in a second headline. */}
              <p className="-mt-2 text-base text-grafite dark:text-marmol/80">
                {everyoneSubmitted
                  ? `${updatesInCount} ${updatesInCount === 1 ? "update" : "updates"} in`
                  : `${submittedCount} of ${participants.length} submitted. Drafts are marked.`}
              </p>
              {isViewer && (
                <p className="-mt-2 text-sm text-grafite dark:text-marmol/80">
                  You&apos;re viewing this week&apos;s updates read-only. Only people who joined
                  before the reveal can upvote.
                </p>
              )}
              {!isViewer && (
                <p className="-mt-2 text-base text-grafite dark:text-marmol/80">
                  Read, then upvote what the team should talk about. Hive mind requests are
                  always on the agenda; anything worth sharing joins it once it has an upvote.
                  {!isFacilitator && ` ${facilitatorName} builds the agenda when everyone is ready.`}
                </p>
              )}
              <RevealGrid
                participants={participants}
                updates={allUpdates}
                reactions={reactions}
                roleUpdates={roleUpdates}
                social={social}
                myParticipantId={me.id}
                onToggleFlag={handleToggleFlag}
                readOnly={isViewer}
                animate
              />
            </section>
          ) : (
            // The agenda already lists what matters, so the full cards are one click away.
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 font-heading text-2xl font-bold text-ardesia dark:text-marmol [&::-webkit-details-marker]:hidden">
                Everyone&apos;s updates
                <span className="font-sans text-sm font-normal text-ember-ink underline underline-offset-2">
                  <span className="group-open:hidden">Show</span>
                  <span className="hidden group-open:inline">Hide</span>
                </span>
              </summary>
              <div className="mt-4">
                <RevealGrid
                  participants={participants}
                  updates={allUpdates}
                  reactions={reactions}
                  roleUpdates={roleUpdates}
                  social={social}
                  myParticipantId={me.id}
                  onToggleFlag={handleToggleFlag}
                  readOnly
                />
              </div>
            </details>
          )}

          {!inReveal && <OpenRoles />}
        </div>
      )}

      {showingResults && inReveal && isFacilitator && (
        <div className="sticky bottom-0 z-10 -mx-6 -mb-10 border-t border-grafite/20 bg-background px-6 py-3 dark:border-white/15">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-base font-semibold text-ardesia dark:text-marmol">
              {flaggedTopicCount === 0
                ? "Nothing to discuss yet"
                : `${flaggedTopicCount} ${
                    flaggedTopicCount === 1 ? "topic" : "topics"
                  } to discuss so far`}
            </p>
            <ConfirmButton
              label="Build the agenda"
              prompt="Move everyone on to the agenda? Upvoting locks once it starts."
              confirmLabel="Yes, build it"
              onConfirm={handleStartAgenda}
              disabled={busy}
              className="min-h-11 rounded-lg bg-ember-fill px-4 py-2 font-semibold text-white transition disabled:opacity-50"
            />
          </div>
        </div>
      )}

      {showingResults && inAgenda && isFacilitator && (
        <div className="sticky bottom-0 z-10 -mx-6 -mb-10 border-t border-grafite/20 bg-background px-6 py-3 dark:border-white/15">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-base font-semibold text-ardesia dark:text-marmol">
              {flaggedTopicCount === 0
                ? "No topics to discuss"
                : leftToDiscuss === 0
                ? "All topics discussed"
                : `${leftToDiscuss} left to discuss`}
            </p>
            <ConfirmButton
              label="Close session"
              prompt={`${
                leftToDiscuss > 0
                  ? `${leftToDiscuss} ${
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
