// Shapes Notion's raw "Open Roles" database rows into what the page needs. Kept free
// of network calls so it can be checked with plain sample data.

export type OpenRole = {
  id: string;
  title: string;
  partner: string;
  location: string[];
  jobFunction: string[];
  searchType: string | null;
  openedOn: string | null; // YYYY-MM-DD
  jdUrl: string | null;
};

export type NotionProperty = { type: string; [key: string]: unknown };
export type NotionPage = { id: string; properties: Record<string, NotionProperty> };

const plainText = (rich: unknown): string =>
  Array.isArray(rich)
    ? rich.map((t: { plain_text?: string }) => t.plain_text ?? "").join("").trim()
    : "";

// Property names in this database carry stray spaces ("Talent Partner "), so match
// loosely rather than break if someone tidies them.
function findProperty(page: NotionPage, name: string): NotionProperty | undefined {
  const wanted = name.trim().toLowerCase();
  return Object.entries(page.properties).find(([key]) => key.trim().toLowerCase() === wanted)?.[1];
}

const names = (property: NotionProperty | undefined, key: "multi_select"): string[] => {
  const items = property?.[key];
  return Array.isArray(items) ? items.map((i: { name?: string }) => i.name ?? "").filter(Boolean) : [];
};

export function partnerIdsOf(page: NotionPage): string[] {
  const relation = findProperty(page, "Talent Partner")?.relation;
  return Array.isArray(relation) ? relation.map((r: { id: string }) => r.id) : [];
}

// A page's title is whichever property has the "title" type, whatever it is called.
export function titleOf(page: NotionPage): string {
  const titleProperty = Object.values(page.properties).find((p) => p.type === "title");
  return plainText(titleProperty?.title);
}

export function shapeOpenRoles(
  pages: NotionPage[],
  partnerNames: Record<string, string>
): OpenRole[] {
  const roles = pages.map((page): OpenRole => {
    const ids = partnerIdsOf(page);
    const resolved = ids.map((id) => partnerNames[id]).filter(Boolean);
    const url = findProperty(page, "Link to JD")?.url;
    const date = (findProperty(page, "Role open date")?.date as { start?: string } | null)?.start;
    const searchType = (findProperty(page, "Search Type")?.select as { name?: string } | null)?.name;

    return {
      id: page.id,
      title: titleOf(page) || "Untitled role",
      partner: ids.length === 0 ? "Unassigned" : resolved.join(", ") || "Unknown",
      location: names(findProperty(page, "Location"), "multi_select"),
      jobFunction: names(findProperty(page, "Job function"), "multi_select"),
      searchType: searchType ?? null,
      openedOn: date ? date.slice(0, 10) : null,
      // Only ever link to real web addresses.
      jdUrl: typeof url === "string" && /^https?:\/\//i.test(url) ? url : null,
    };
  });

  // By talent partner (Unassigned last), then role name.
  return roles.sort((a, b) => {
    if (a.partner === "Unassigned" !== (b.partner === "Unassigned")) {
      return a.partner === "Unassigned" ? 1 : -1;
    }
    return a.partner.localeCompare(b.partner) || a.title.localeCompare(b.title);
  });
}
