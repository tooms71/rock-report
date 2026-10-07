import { getCurrentRock } from "@/lib/rocks";
import { RockIcon } from "@/components/Icons";

// Full card for the lobby/join screens; `compact` folds the facts away once the
// meeting content (the agenda) should take the stage.
export function RockCard({
  date,
  compact = false,
}: { date?: Date; compact?: boolean } = {}) {
  const rock = getCurrentRock(date);

  const facts = (
    <ul className="space-y-1.5 text-sm text-ardesia/80 dark:text-marmol/80">
      {rock.facts.map((fact) => (
        <li key={fact} className="flex gap-2">
          <span aria-hidden="true" className="text-grafite/60 dark:text-marmol/50">
            •
          </span>
          <span>{fact}</span>
        </li>
      ))}
    </ul>
  );

  if (compact) {
    return (
      <details className="rounded-xl border border-grafite/20 bg-stone px-4 dark:border-white/15 dark:bg-white/[0.08]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 font-heading text-lg font-bold text-ardesia dark:text-marmol">
            <RockIcon className="size-5 shrink-0 text-ember-ink" />
            {rock.name}
          </span>
          <span className="text-sm text-grafite dark:text-marmol/70">
            Rock of the Week
          </span>
        </summary>
        <div className="pb-4 pt-1">{facts}</div>
      </details>
    );
  }

  return (
    <div className="marble rounded-2xl border border-grafite/20 p-5 dark:border-white/15">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-2.5 font-heading text-3xl font-bold text-ardesia dark:text-marmol">
          <RockIcon className="size-7 shrink-0 translate-y-0.5 text-ember-ink" />
          {rock.name}
        </p>
        <p className="shrink-0 text-sm text-grafite dark:text-marmol/70">
          Rock of the Week
        </p>
      </div>
      <div className="mt-3">{facts}</div>
    </div>
  );
}
