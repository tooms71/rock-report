import { getCurrentRock } from "@/lib/rocks";
import { RockIcon } from "@/components/Icons";

// The Rock of the Week, on the first screens (sign-in and lobby) only: the rock's name,
// its fun facts and a marble-veined card. It stays out of the meeting screens on purpose.
export function RockCard() {
  const rock = getCurrentRock();

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
      <ul className="mt-3 space-y-1.5 text-sm text-ardesia/80 dark:text-marmol/80">
        {rock.facts.map((fact) => (
          <li key={fact} className="flex gap-2">
            <span aria-hidden="true" className="text-grafite/60 dark:text-marmol/50">
              •
            </span>
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
