// Matches a signed-in person to their open roles in Notion. Pure functions, kept free of
// network calls so they can be checked with sample data.

export type NotionProperty = { type: string; [key: string]: unknown };
export type NotionPage = {
  id: string;
  url?: string;
  properties: Record<string, NotionProperty>;
};

export type MyRole = { id: string; title: string; url: string | null };

// Property names in this database carry stray spaces ("Talent Partner "), so match loosely.
function findProperty(page: NotionPage, name: string): NotionProperty | undefined {
  const wanted = name.trim().toLowerCase();
  return Object.entries(page.properties).find(([key]) => key.trim().toLowerCase() === wanted)?.[1];
}

const plainText = (rich: unknown): string =>
  Array.isArray(rich)
    ? rich.map((t: { plain_text?: string }) => t.plain_text ?? "").join("").trim()
    : "";

export function emailOf(page: NotionPage): string {
  const email = findProperty(page, "Email")?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// The Team Directory row whose Email matches the signed-in person.
export function findPersonId(directory: NotionPage[], email: string): string | null {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return null;
  return directory.find((page) => emailOf(page) === wanted)?.id ?? null;
}

// Client page id -> client name, from the Clients database.
export function clientNames(clients: NotionPage[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const page of clients) {
    const titleProperty = Object.values(page.properties).find((p) => p.type === "title");
    const name = plainText(titleProperty?.title);
    if (name) names.set(page.id, name);
  }
  return names;
}

// "Senior Engineer" at client "Acme" reads "Senior Engineer (Acme)". Someone with three
// engineer roles for different clients needs the client to tell them apart. Titles that
// already name the client are left alone.
export function withClient(title: string, clients: string[]): string {
  const named = (client: string) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${client.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu").test(title);
  const missing = clients.filter((c) => !named(c));
  return missing.length > 0 ? `${title} (${missing.join(", ")})` : title;
}

// Open roles where this person is one of the talent partners.
export function rolesFor(
  openRoles: NotionPage[],
  personId: string,
  clients: Map<string, string> = new Map()
): MyRole[] {
  return openRoles
    .filter((page) => {
      const relation = findProperty(page, "Talent Partner")?.relation;
      return Array.isArray(relation) && relation.some((r: { id: string }) => r.id === personId);
    })
    .map((page) => {
      const titleProperty = Object.values(page.properties).find((p) => p.type === "title");
      const clientRelation = findProperty(page, "Client")?.relation;
      const clientList = Array.isArray(clientRelation)
        ? clientRelation.flatMap((r: { id: string }) => clients.get(r.id) ?? [])
        : [];
      return {
        id: page.id,
        title: withClient(plainText(titleProperty?.title) || "Untitled role", clientList),
        // Only ever link to real web addresses.
        url: typeof page.url === "string" && /^https:\/\//i.test(page.url) ? page.url : null,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
