import type { UpdateFields } from "@/components/WritingForm";

type ParticipantRow = {
  id: string;
  display_name: string;
};

type UpdateRow = UpdateFields & {
  id: string;
  participant_id: string;
  submitted_at: string | null;
};

export function RevealGrid({
  participants,
  updates,
}: {
  participants: ParticipantRow[];
  updates: UpdateRow[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {participants.map((p) => {
        const update = updates.find((u) => u.participant_id === p.id);
        return <UpdateCard key={p.id} name={p.display_name} update={update} />;
      })}
    </div>
  );
}

function UpdateCard({
  name,
  update,
}: {
  name: string;
  update: UpdateRow | undefined;
}) {
  if (!update || !update.submitted_at) {
    return (
      <div className="rounded-2xl border border-marmol p-5 dark:border-white/15">
        <p className="font-heading text-xl font-bold text-ardesia dark:text-marmol">
          {name}
        </p>
        <p className="mt-2 text-sm text-grafite dark:text-marmol/70">
          Didn&apos;t submit an update this week.
        </p>
      </div>
    );
  }

  const hasOffers = update.offers_made !== null || update.offers_closed !== null;

  return (
    <div className="rounded-2xl border border-marmol bg-marmol/60 p-5 dark:border-white/15 dark:bg-white/8">
      <p className="font-heading text-xl font-bold text-ardesia dark:text-marmol">
        {name}
      </p>

      {hasOffers && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat
            label="Offers made"
            value={update.offers_made}
            note={update.offers_made_note}
          />
          <Stat
            label="Offers closed"
            value={update.offers_closed}
            note={update.offers_closed_note}
          />
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        <Field label="New roles opened" value={update.roles_opened} />
        <Field
          label="💡 Something learned / surprised"
          value={update.learned_or_surprised}
        />
        <Field label="🧠 Where I could use a brain" value={update.need_brain_on} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: number | null;
  note: string | null;
}) {
  if (value === null) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-grafite dark:text-marmol/70">
        {label}
      </p>
      <p className="tabular-nums text-ardesia dark:text-marmol">
        {value}
        {note && <span className="text-grafite dark:text-marmol/80"> · {note}</span>}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-grafite dark:text-marmol/70">
        {label}
      </p>
      <p className="text-ardesia dark:text-marmol">{value}</p>
    </div>
  );
}
