import { createClient } from "@supabase/supabase-js";
import { isAllowedEmail } from "@/lib/auth";
import { clientNames, findPersonId, rolesFor, type MyRole, type NotionPage } from "@/lib/notionRoles";

// Returns the signed-in person's own open roles from Notion. Role names include client
// names, so this checks the caller's sign-in on the server before returning anything, and
// the Notion key never leaves the server. Read-only: nothing is ever written to Notion.

const NOTION_VERSION = "2022-06-28";
const OPEN_ROLES_DB = process.env.NOTION_OPEN_ROLES_DATABASE_ID ?? "28c6b1a6-e6e7-80a9-87bf-f0430f8bf140";
const TEAM_DIRECTORY_DB = process.env.NOTION_TEAM_DIRECTORY_DATABASE_ID ?? "7f643c27-ebd4-4e1b-88c3-293a6ef7c41d";
const CLIENTS_DB = process.env.NOTION_CLIENTS_DATABASE_ID ?? "0b91e8eb-26ae-4485-ba78-44ee280dbe59";
const MAX_PAGES = 5; // 100 rows per page
const DIRECTORY_CACHE_MS = 10 * 60 * 1000;
const ROLES_CACHE_MS = 2 * 60 * 1000;

type Body =
  | { status: "ok"; matched: boolean; roles: MyRole[] }
  | { status: "not_configured" }
  | { status: "unauthorized" }
  | { status: "error" };

let directoryCache: { at: number; pages: NotionPage[] } | null = null;
let clientsCache: { at: number; names: Map<string, string> } | null = null;
let rolesCache: { at: number; pages: NotionPage[] } | null = null;

async function queryAll(databaseId: string, token: string, filter?: unknown): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100, start_cursor: cursor, filter }),
    });
    if (!res.ok) throw new Error(`Notion ${res.status}`);
    const data = (await res.json()) as {
      results: NotionPage[];
      has_more: boolean;
      next_cursor: string | null;
    };
    pages.push(...data.results);
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return pages;
}

const json = (body: Body, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) return json({ status: "not_configured" });

  // Who is asking? Ask Supabase to verify the sign-in token the browser sent.
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

  // For testing on a laptop only: look up someone else's roles. Never active in production.
  const lookupEmail =
    process.env.NODE_ENV !== "production" && process.env.ROLES_TEST_EMAIL
      ? process.env.ROLES_TEST_EMAIL
      : data.user.email!;

  try {
    const now = Date.now();
    if (!directoryCache || now - directoryCache.at > DIRECTORY_CACHE_MS) {
      directoryCache = { at: now, pages: await queryAll(TEAM_DIRECTORY_DB, notionToken) };
    }
    if (!rolesCache || now - rolesCache.at > ROLES_CACHE_MS) {
      rolesCache = {
        at: now,
        pages: await queryAll(OPEN_ROLES_DB, notionToken, {
          property: "Status",
          select: { equals: "Open" },
        }),
      };
    }

    // Client names are a nice-to-have: if they can't be read, roles still show without them.
    if (!clientsCache || now - clientsCache.at > DIRECTORY_CACHE_MS) {
      try {
        clientsCache = { at: now, names: clientNames(await queryAll(CLIENTS_DB, notionToken)) };
      } catch {
        clientsCache = { at: now - DIRECTORY_CACHE_MS + 60 * 1000, names: new Map() };
      }
    }

    const personId = findPersonId(directoryCache.pages, lookupEmail);
    if (!personId) return json({ status: "ok", matched: false, roles: [] });
    return json({ status: "ok", matched: true, roles: rolesFor(rolesCache.pages, personId, clientsCache.names) });
  } catch {
    return json({ status: "error" }, 502);
  }
}
