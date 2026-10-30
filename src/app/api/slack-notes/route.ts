import { createClient } from "@supabase/supabase-js";
import { isAllowedEmail } from "@/lib/auth";
import { isFacilitatorEmail } from "@/lib/facilitators";
import { notesToSlack } from "@/lib/slackFormat";

// Posts the meeting notes to the team's Slack channel: a short title message, then the
// notes as a reply in its thread. Only a facilitator signed in with a Carrara account can
// do it, checked here on the server. The Slack bot token is a secret, so it stays in
// SLACK_BOT_TOKEN on the server and never reaches the browser. SLACK_CHANNEL_ID says where
// to post.

const MAX_NOTES_LENGTH = 30000;

type Body =
  | { status: "ok" }
  | { status: "not_configured" | "unauthorized" | "forbidden" | "bad_request" }
  | { status: "error"; detail?: string };

const json = (body: Body, status = 200) => Response.json(body, { status });

async function slack(method: string, token: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as { ok: boolean; ts?: string; error?: string };
}

export async function POST(request: Request) {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token || !channel) return json({ status: "not_configured" });

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ status: "unauthorized" }, 401);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await supabase.auth.getUser(bearer);
  if (error || !data.user || !isAllowedEmail(data.user.email)) {
    return json({ status: "unauthorized" }, 401);
  }
  if (!isFacilitatorEmail(data.user.email)) return json({ status: "forbidden" }, 403);

  let notes: unknown;
  let sessionId: unknown;
  try {
    ({ notes, sessionId } = await request.json());
  } catch {
    return json({ status: "bad_request" }, 400);
  }
  if (
    typeof notes !== "string" ||
    !notes.trim() ||
    notes.length > MAX_NOTES_LENGTH ||
    typeof sessionId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(sessionId)
  ) {
    return json({ status: "bad_request" }, 400);
  }

  const link = `${new URL(request.url).origin}/session/${sessionId}`;
  const { title, body } = notesToSlack(notes, link);
  try {
    const parent = await slack("chat.postMessage", token, { channel, text: title });
    if (!parent.ok || !parent.ts) return json({ status: "error", detail: parent.error }, 502);
    const reply = await slack("chat.postMessage", token, {
      channel,
      thread_ts: parent.ts,
      text: body,
      unfurl_links: false,
    });
    if (!reply.ok) {
      // Don't leave a title with nothing under it, so a retry doesn't double-post.
      await slack("chat.delete", token, { channel, ts: parent.ts }).catch(() => undefined);
      return json({ status: "error", detail: reply.error }, 502);
    }
    return json({ status: "ok" });
  } catch {
    return json({ status: "error" }, 502);
  }
}
