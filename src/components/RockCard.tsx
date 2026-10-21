import { getCurrentRock } from "@/lib/rocks";
import { RockIcon } from "@/components/Icons";

// The Rock of the Week: one line at the doorway (sign-in and lobby), with the facts a
// tap away. It stays out of the meeting screens on purpose.
export function RockCard() {
  const rock = getCurrentRock();

  return (
    <details className="rounded-xl border border-grafite/20 bg-stone px-4 dark:border-white/15 dark:bg-white/[0.08]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-heading text-lg font-bold text-ardesia dark:text-marmol">
          <RockIcon className="size-5 shrink-0 text-ember-ink" />
          {rock.name}
        </span>
        <span className="text-sm text-grafite dark:text-marmol/70">Rock of the Week</span>
      </summary>
      <ul className="space-y-1.5 pb-4 pt-1 text-sm text-ardesia/80 dark:text-marmol/80">
        {rock.facts.map((fact) => (
          <li key={fact} className="flex gap-2">
            <span aria-hidden="true" className="text-grafite/60 dark:text-marmol/50">
              •
            </span>
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
