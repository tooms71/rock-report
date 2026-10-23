"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MyRole } from "@/lib/notionRoles";
import {
  ROLE_STATUSES,
  type RoleStatus,
  type RoleUpdateRow,
} from "@/lib/roleStatus";

type Loaded =
  | { kind: "loading" }
  | { kind: "ready"; matched: boolean; roles: MyRole[] }
  | { kind: "hidden" }
  | { kind: "error" };

const STATUS_STYLE: Record<RoleStatus, string> = {
  on_track: "border-moss-ink bg-moss-ink/15 text-moss-ink",
  stalled: "border-ember-ink bg-ember-ink/10 text-ember-ink",
  offer_extended:
    "border-ardesia bg-ardesia/10 text-ardesia dark:border-marmol dark:bg-white/15 dark:text-marmol",
  offer_accepted: "border-ember-fill bg-ember-fill text-white",
};

// The signed-in person's own open roles from Notion, each with four status buttons. A tap
// saves straight away; tapping the chosen status again clears it. Nothing is written back
// to Notion. If the roles can't be loaded the rest of the form works as normal.
export function RoleUpdates({
  sessionId,
  participantId,
  roleUpdates,
  onSaved,
  onCleared,
}: {
  sessionId: string;
  participantId: string;
  roleUpdates: RoleUpdateRow[];
  onSaved: (row: RoleUpdateRow) => void;
  onCleared: (id: string) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("no session");
        const res = await fetch("/api/my-roles", { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json();
        if (!active) return;
        if (body.status === "not_configured") setLoaded({ kind: "hidden" });
        else if (res.ok && body.status === "ok") {
          setLoaded({ kind: "ready", matched: body.matched, roles: body.roles });
        } else setLoaded({ kind: "error" });
      } catch {
        if (active) setLoaded({ kind: "error" });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const mine = roleUpdates.filter((r) => r.participant_id === participantId);

  async function choose(role: MyRole, status: RoleStatus) {
    setSaveError(false);
    const existing = mine.find((r) => r.notion_page_id === role.id);
    if (existing?.status === status) {
      const { error } = await supabase.from("role_updates").delete().eq("id", existing.id);
      if (error) setSaveError(true);
      else onCleared(existing.id);
      return;
    }
    const { data, error } = await supabase
      .from("role_updates")
      .upsert(
        {
          session_id: sessionId,
          participant_id: participantId,
          notion_page_id: role.id,
          role_title: role.title,
          role_url: role.url,
          status,
          note: existing?.note ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "participant_id,notion_page_id" }
      )
      .select()
      .single();
    if (error || !data) setSaveError(true);
    else onSaved(data as RoleUpdateRow);
  }

  async function saveNote(existing: RoleUpdateRow, note: string) {
    const value = note.trim() || null;
    if (value === existing.note) return;
    const { data, error } = await supabase
      .from("role_updates")
      .update({ note: value, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error || !data) setSaveError(true);
    else onSaved(data as RoleUpdateRow);
  }

  if (loaded.kind === "hidden") return null;

  return (
    <section aria-labelledby="my-roles-heading" className="flex flex-col gap-3">
      <div>
        <h2
          id="my-roles-heading"
          className="font-heading text-xl font-bold text-ardesia dark:text-marmol"
        >
          Your open roles
        </h2>
        <p className="mt-1 text-sm text-grafite dark:text-marmol/80" role="status">
          {loaded.kind === "loading" && "Loading your roles from Notion…"}
          {loaded.kind === "error" &&
            "Couldn't load your roles right now. The rest of the form still works."}
          {loaded.kind === "ready" && !loaded.matched &&
            "We couldn't find you in the Team Directory. Ask for your email to be added there."}
          {loaded.kind === "ready" && loaded.matched && loaded.roles.length === 0 &&
            "You have no open roles in Notion."}
          {loaded.kind === "ready" && loaded.roles.length > 0 &&
            "Tap one for each role. Skip any with nothing to say."}
        </p>
      </div>

      {loaded.kind === "ready" && loaded.roles.length > 0 && (
        <ul className="flex flex-col divide-y divide-grafite/15 dark:divide-white/15">
          {loaded.roles.map((role) => {
            const current = mine.find((r) => r.notion_page_id === role.id);
            return (
              <li key={role.id} className="flex flex-col gap-2 py-3 first:pt-0">
                <p className="text-base font-semibold text-ardesia [overflow-wrap:anywhere] dark:text-marmol">
                  {role.url ? (
                    <a
                      href={role.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-grafite/40 underline-offset-2 hover:text-ember-ink dark:decoration-white/40"
                    >
                      {role.title}
                      <span className="sr-only"> (opens in Notion)</span>
                    </a>
                  ) : (
                    role.title
                  )}
                </p>
                <div
                  role="group"
                  aria-label={`Status for ${role.title}`}
                  className="grid grid-cols-4 gap-2"
                >
                  {ROLE_STATUSES.map(({ value, label, short, emoji }) => {
                    const selected = STATUS_STYLE[value];
                    const on = current?.status === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={on}
                        aria-label={label}
                        onClick={() => void choose(role, value)}
                        className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border px-1 text-sm font-semibold transition max-sm:flex-col max-sm:gap-0 max-sm:py-1 ${
                          on
                            ? selected
                            : "border-grafite/40 text-ardesia hover:border-ember-ink hover:text-ember-ink dark:border-white/30 dark:text-marmol"
                        }`}
                      >
                        <span aria-hidden="true">{emoji}</span>
                        {short}
                      </button>
                    );
                  })}
                </div>
                {current && (
                  <input
                    type="text"
                    aria-label={`Note for ${role.title}`}
                    placeholder="Add a note (optional)"
                    defaultValue={current.note ?? ""}
                    onBlur={(e) => void saveNote(current, e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-grafite/40 bg-transparent px-3 text-base text-ardesia placeholder:text-grafite/70 dark:border-white/30 dark:text-marmol"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {saveError && (
        <p role="alert" className="text-sm font-semibold text-ember-ink">
          Couldn&apos;t save that just now. Tap it again.
        </p>
      )}
    </section>
  );
}
