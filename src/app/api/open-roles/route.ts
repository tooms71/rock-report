import {
  partnerIdsOf,
  shapeOpenRoles,
  titleOf,
  type NotionPage,
  type OpenRole,
} from "@/lib/notionRoles";

// Reads the "Open Roles" database from Notion on the server, so the Notion token never
// reaches the browser. Returns only the few fields the page shows.

const NOTION_VERSION = "2022-06-28";
// Overridable so the route can be tested against a stand-in for Notion.
const NOTION_API = process.env.NOTION_API_BASE ?? "https://api.notion.com/v1";
// The database id from the Notion link; override with NOTION_OPEN_ROLES_DATABASE_ID.
const DEFAULT_DATABASE_ID = "28c6b1a6-e6e7-80a9-87bf-f0430f8bf140";
const MAX_PAGES = 5; // 100 roles per page
const CACHE_MS = 5 * 60 * 1000;

type Body =
  | { status: "ok"; roles: OpenRole[] }
  | { status: "not_configured" }
  | { status: "error"; reason: "unauthorized" | "not_found" | "unavailable" };

let cache: { at: number; body: Body } | null = null;

async function notionFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${NOTION_API}/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  });
}

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  if (!token) return Response.json({ status: "not_configured" } satisfies Body);

  if (cache && Date.now() - cache.at < CACHE_MS) return Response.json(cache.body);

  const databaseId = process.env.NOTION_OPEN_ROLES_DATABASE_ID ?? DEFAULT_DATABASE_ID;

  try {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
      const res = await notionFetch(`databases/${databaseId}/query`, token, {
        method: "POST",
        body: JSON.stringify({
          page_size: 100,
          start_cursor: cursor,
          filter: { property: "Status", select: { equals: "Open" } },
        }),
      });
      if (!res.ok) {
        const reason = res.status === 401 ? "unauthorized" : res.status === 404 ? "not_found" : "unavailable";
        return Response.json({ status: "error", reason } satisfies Body, { status: 502 });
      }
      const data = (await res.json()) as {
        results: NotionPage[];
        has_more: boolean;
        next_cursor: string | null;
      };
      pages.push(...data.results);
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }

    // Relations only carry ids, so look up each talent partner's name once.
    const partnerIds = [...new Set(pages.flatMap(partnerIdsOf))];
    const partnerNames: Record<string, string> = {};
    await Promise.all(
      partnerIds.map(async (id) => {
        const res = await notionFetch(`pages/${id}`, token);
        if (!res.ok) return; // not shared with the integration: shown as "Unknown"
        partnerNames[id] = titleOf((await res.json()) as NotionPage);
      })
    );

    const body: Body = { status: "ok", roles: shapeOpenRoles(pages, partnerNames) };
    cache = { at: Date.now(), body };
    return Response.json(body);
  } catch {
    return Response.json({ status: "error", reason: "unavailable" } satisfies Body, { status: 502 });
  }
}
