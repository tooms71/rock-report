import { createClient } from "@supabase/supabase-js";
import { isAllowedEmail } from "@/lib/auth";
import { isFacilitatorEmail } from "@/lib/facilitators";
import { notesToSlack } from "@/lib/slackFormat";

// Posts the meeting notes to the team's Slack channel. Only a facilitator signed in with a
// Carrara account can do it, checked here on the server. The Slack webhook address is a
// secret that decides which channel gets the post, so it stays in SLACK_WEBHOOK_URL on the
// server and never reaches the browser.

const MAX_NOTES_LENGTH = 30000;

type Body =
  | { status: "ok" }
  | { status: "not_configured" | "unauthorized" | "forbidden" | "bad_request" | "error" };

const json = (body: Body, status = 200) => Response.json(body, { status });

export async function POST(request: Request) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return json({ status: "not_configured" });

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
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: notesToSlack(notes, link), mrkdwn: true }),
    });
    return res.ok ? json({ status: "ok" }) : json({ status: "error" }, 502);
  } catch {
    return json({ status: "error" }, 502);
  }
}
