import type { UpdateFields } from "@/components/WritingForm";
import { RoleStatusBadge } from "@/components/RoleStatusBadge";
import type { RoleUpdateRow } from "@/lib/roleStatus";

// What you just handed in, shown back while the rest of the team finishes, so the
// wait has something to read and you can check your own words before the reveal.
export function SubmittedSummary({
  fields,
  roles = [],
}: {
  fields: UpdateFields;
  roles?: RoleUpdateRow[];
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Wins", value: fields.wins },
    { label: "New roles opened", value: fields.roles_opened },
    { label: "Hive mind", value: fields.need_brain_on },
    { label: "Cool or valuable to share", value: fields.anything_else },
  ].filter((row): row is { label: string; value: string } => !!row.value);

  return (
    <div className="rounded-xl border border-grafite/20 bg-stone p-5 dark:border-white/15 dark:bg-white/[0.08]">
      <h2 className="font-heading text-lg font-bold text-ardesia dark:text-marmol">
        Your update
      </h2>
      {rows.length === 0 && roles.length === 0 ? (
        <p className="mt-2 text-base text-grafite dark:text-marmol/80">
          You submitted without writing anything.
        </p>
      ) : (
        <dl className="mt-3 flex flex-col gap-3">
          {roles.length > 0 && (
            <div>
              <dt className="text-sm font-semibold text-grafite dark:text-marmol/80">Open roles</dt>
              {roles.map((role) => (
                <dd key={role.id} className="text-base text-ardesia dark:text-marmol">
                  <span className="[overflow-wrap:anywhere]">{role.role_title}</span>{" "}
                  <RoleStatusBadge status={role.status} />
                </dd>
              ))}
            </div>
          )}
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-sm font-semibold text-grafite dark:text-marmol/80">
                {row.label}
              </dt>
              <dd className="whitespace-pre-line text-base [overflow-wrap:anywhere] text-ardesia dark:text-marmol">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
