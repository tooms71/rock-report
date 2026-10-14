"use client";

import { useEffect, useState } from "react";
import type { OpenRole } from "@/lib/notionRoles";

type State =
  | { kind: "loading" }
  | { kind: "ready"; roles: OpenRole[] }
  | { kind: "unavailable" }
  | { kind: "not_configured" };

const COLUMNS =
  "md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_4.5rem] md:gap-4";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// YYYY-MM-DD to "Sep 3", without the timezone shift new Date() would add.
function formatOpened(isoDate: string | null): string {
  if (!isoDate) return "";
  const [, month, day] = isoDate.split("-").map(Number);
  return month && day ? `${MONTHS[month - 1]} ${day}` : "";
}

// Every open role, read-only. The reveal is the one time the whole team looks at this
// list together, so it sits at the bottom of that page.
export function OpenRoles() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    fetch("/api/open-roles")
      .then(async (res) => ({ ok: res.ok, body: await res.json() }))
      .then(({ ok, body }) => {
        if (!active) return;
        if (body.status === "not_configured") setState({ kind: "not_configured" });
        else if (ok && body.status === "ok") setState({ kind: "ready", roles: body.roles });
        else setState({ kind: "unavailable" });
      })
      .catch(() => {
        if (active) setState({ kind: "unavailable" });
      });
    return () => {
      active = false;
    };
  }, []);

  // Until the Notion token is added, stay out of the team's way (but tell the developer).
  if (state.kind === "not_configured" && process.env.NODE_ENV !== "development") return null;

  const roles = state.kind === "ready" ? state.roles : [];
  const groups = new Map<string, OpenRole[]>();
  for (const role of roles) groups.set(role.partner, [...(groups.get(role.partner) ?? []), role]);

  return (
    <section aria-labelledby="roles-heading" className="flex flex-col gap-4">
      <div>
        <h2
          id="roles-heading"
          className="font-heading text-2xl font-bold text-ardesia dark:text-marmol"
        >
          Open roles
        </h2>
        <p className="mt-1 text-base text-grafite dark:text-marmol/80" role="status">
          {state.kind === "loading" && "Loading open roles…"}
          {state.kind === "unavailable" && "Couldn’t load open roles right now. Reload to try again."}
          {state.kind === "not_configured" &&
            "Open roles aren’t connected yet. Add NOTION_TOKEN to .env.local and restart."}
          {state.kind === "ready" &&
            (roles.length === 0
              ? "No open roles right now."
              : `${roles.length} open ${roles.length === 1 ? "role" : "roles"} across ${groups.size} talent ${
                  groups.size === 1 ? "partner" : "partners"
                }. From the Open Roles database in Notion.`)}
        </p>
      </div>

      {roles.length > 0 && (
        <div className="flex flex-col gap-6">
          {/* Column names, once, for wide screens. */}
          <div
            aria-hidden="true"
            className={`${COLUMNS} hidden border-b border-grafite/30 pb-2 text-sm font-semibold text-grafite dark:border-white/25 dark:text-marmol/80`}
          >
            <span>Role</span>
            <span>Location</span>
            <span>Function</span>
            <span>Search</span>
            <span>Opened</span>
          </div>
          {[...groups].map(([partner, partnerRoles]) => (
            <div key={partner}>
              <h3 className="font-heading text-lg font-bold text-ardesia dark:text-marmol">
                {partner}{" "}
                <span className="font-sans text-base font-normal tabular-nums text-grafite dark:text-marmol/80">
                  · {partnerRoles.length}
                </span>
              </h3>
              <ul className="divide-y divide-grafite/15 dark:divide-white/15">
                {partnerRoles.map((role) => (
                  <li key={role.id} className={`${COLUMNS} py-3 md:items-baseline`}>
                    <span className="block text-base font-semibold text-ardesia [overflow-wrap:anywhere] dark:text-marmol">
                      {role.jdUrl ? (
                        <a
                          href={role.jdUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-grafite/40 underline-offset-2 transition hover:text-ember-ink hover:decoration-ember-ink dark:decoration-white/40"
                        >
                          {role.title}
                          <span className="sr-only"> (opens the job description)</span>
                        </a>
                      ) : (
                        role.title
                      )}
                    </span>
                    {/* On phones these run together under the title; on wide screens
                        they become the columns. */}
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-grafite md:contents md:text-base dark:text-marmol/80">
                      <Cell label="Location" value={role.location.join(", ")} />
                      <Cell label="Function" value={role.jobFunction.join(", ")} />
                      <Cell label="Search" value={role.searchType ?? ""} />
                      <Cell label="Opened" value={formatOpened(role.openedOn)} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <span className={value ? undefined : "max-md:hidden"}>
      <span className="sr-only">{label}: </span>
      {value || "—"}
    </span>
  );
}
