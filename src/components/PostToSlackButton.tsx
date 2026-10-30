"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ConfirmButton } from "@/components/ConfirmButton";

type PostState = "idle" | "posting" | "posted" | "error" | "not_configured";

export const SLACK_CHANNEL = "#f-talent-general";

// Facilitator-only: posts the meeting notes to the team's Slack channel, after one
// "are you sure?" because a post can't be taken back from here.
export function PostToSlackButton({
  sessionId,
  getNotes,
}: {
  sessionId: string;
  getNotes: () => string;
}) {
  const [state, setState] = useState<PostState>("idle");

  async function post() {
    setState("posting");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("no session");
      const res = await fetch("/api/slack-notes", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ notes: getNotes(), sessionId }),
      });
      const body = await res.json();
      if (res.ok && body.status === "ok") setState("posted");
      else setState(body.status === "not_configured" ? "not_configured" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ConfirmButton
        label="Post to Slack"
        prompt={`Post the meeting notes to ${SLACK_CHANNEL}?`}
        confirmLabel="Post"
        onConfirm={() => void post()}
        disabled={state === "posting"}
        className="min-h-11 rounded-lg border border-grafite/50 px-4 text-sm font-semibold text-ardesia transition hover:border-ember-ink hover:text-ember-ink disabled:opacity-50 dark:border-white/40 dark:text-marmol"
      />
      <span
        role="status"
        aria-live="polite"
        className={`text-sm ${
          state === "error" || state === "not_configured"
            ? "font-semibold text-ember-ink"
            : "text-grafite dark:text-marmol/80"
        }`}
      >
        {state === "posting" && "Posting…"}
        {state === "posted" && `Posted to ${SLACK_CHANNEL}.`}
        {state === "error" && "Couldn’t post to Slack. Try again, or copy the notes instead."}
        {state === "not_configured" && "Slack isn’t connected yet."}
      </span>
    </div>
  );
}
