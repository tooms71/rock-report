"use client";

import type { Social } from "@/components/Reactions";
import type { CommentRow } from "@/lib/social";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { AgendaPanel } from "@/components/AgendaPanel";
import { RevealGrid, type ReactionRow } from "@/components/RevealGrid";
import { formatWeekOf } from "@/lib/date";
import { CopyButton } from "@/components/CopyButton";
import { PostToSlackButton } from "@/components/PostToSlackButton";
import { useCurrentUser } from "@/components/AuthGate";
import { isFacilitatorEmail } from "@/lib/facilitators";
import { buildMeetingNotes } from "@/lib/summary";
import { formatSessionSummary, summarizeSession } from "@/lib/agenda";
import type { RoleUpdateRow } from "@/lib/roleStatus";
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
  const user = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [roleUpdates, setRoleUpdates] = useState<RoleUpdateRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);

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
        { data: roleUpdatesData },
        { data: commentsData },
      ] = await Promise.all([
        supabase
          .from("participants")
          .select("id, display_name")
          .eq("session_id", sessionId)
          .order("joined_at", { ascending: true }),
        supabase.from("updates").select("*").eq("session_id", sessionId),
        supabase.from("reactions").select("*").eq("session_id", sessionId),
        supabase.from("role_updates").select("*").eq("session_id", sessionId),
        supabase.from("comments").select("*").eq("session_id", sessionId),
      ]);

      if (!active) return;
      setParticipants(participantsData ?? []);
      setUpdates(updatesData ?? []);
      setReactions(reactionsData ?? []);
      setRoleUpdates((roleUpdatesData ?? []) as RoleUpdateRow[]);
      setComments((commentsData ?? []) as CommentRow[]);
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

  const notesText = ({ withComments = true } = {}) =>
    buildMeetingNotes({
      weekLabel: formatWeekOf(session.week_of),
      participants,
      updates,
      reactions,
      roleUpdates,
      comments: withComments ? comments : [],
    });

  // Past sessions are read-only: reactions and comments show, but can't be added.
  const social: Social = {
    comments,
    nameOf: (participantId) =>
      participants.find((p) => p.id === participantId)?.display_name ?? "Someone",
    myParticipantId: "",
    canReact: false,
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-ardesia dark:text-marmol">
              Week of {formatWeekOf(session.week_of)}
            </h1>
            <p className="text-sm text-grafite dark:text-marmol/80">
              {session.phase === "closed" ? "Closed" : "Revealed"} ·{" "}
              {formatSessionSummary(summarizeSession(updates, reactions, roleUpdates))}
            </p>
          </div>
          <Link href="/archive" className="text-sm font-semibold text-ember-ink">
            ← Archive
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <CopyButton
          primary
          label="Copy meeting notes"
          copiedText="Copied. Paste it into Slack or Notion."
          getText={() => notesText()}
        />
        {isFacilitatorEmail(user.email) && session.phase === "closed" && (
          <PostToSlackButton sessionId={session.id} getNotes={() => notesText({ withComments: false })} />
        )}
      </div>
      <AgendaPanel participants={participants} updates={updates} reactions={reactions} roleUpdates={roleUpdates} social={social} closed={session.phase === "closed"} />
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
            updates={updates}
            reactions={reactions}
            roleUpdates={roleUpdates}
            social={social}
            myParticipantId=""
            onToggleFlag={() => {}}
            readOnly
          />
        </div>
      </details>
    </main>
  );
}
