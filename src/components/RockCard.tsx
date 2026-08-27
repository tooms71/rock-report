import { getCurrentRock } from "@/lib/rocks";

export function RockCard({ date }: { date?: Date } = {}) {
  const rock = getCurrentRock(date);

  return (
    <div className="rounded-2xl border border-marmol bg-marmol/60 p-5 dark:border-white/15 dark:bg-white/8">
      <p className="text-xs font-semibold uppercase tracking-wide text-grafite dark:text-marmol/70">
        Rock of the Week
      </p>
      <p className="mt-1 font-heading text-2xl font-bold text-ardesia dark:text-marmol">
        {rock.emoji} {rock.name}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-grafite dark:text-marmol/80">
        {rock.facts.map((fact) => (
          <li key={fact} className="flex gap-2">
            <span className="text-nuvola dark:text-marmol/40">•</span>
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
