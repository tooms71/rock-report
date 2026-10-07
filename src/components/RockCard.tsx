import { getCurrentRock } from "@/lib/rocks";

// Full card for the lobby/join screens; `compact` folds the facts away once the
// meeting content (the agenda) should take the stage.
export function RockCard({
  date,
  compact = false,
}: { date?: Date; compact?: boolean } = {}) {
  const rock = getCurrentRock(date);

  const facts = (
    <ul className="space-y-1.5 text-sm text-grafite dark:text-marmol/80">
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
      <details className="rounded-xl border border-marmol px-4 py-3 dark:border-white/15">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span className="font-heading text-lg font-bold text-ardesia dark:text-marmol">
            {rock.emoji} {rock.name}
          </span>
          <span className="text-sm text-grafite dark:text-marmol/70">
            Rock of the Week
          </span>
        </summary>
        <div className="mt-3">{facts}</div>
      </details>
    );
  }

  return (
    <div className="rounded-2xl border border-marmol bg-marmol/60 p-5 dark:border-white/15 dark:bg-white/8">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-heading text-2xl font-bold text-ardesia dark:text-marmol">
          {rock.emoji} {rock.name}
        </p>
        <p className="text-sm text-grafite dark:text-marmol/70">Rock of the Week</p>
      </div>
      <div className="mt-3">{facts}</div>
    </div>
  );
}
