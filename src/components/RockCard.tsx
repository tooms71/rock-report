import { getCurrentRock } from "@/lib/rocks";

export function RockCard() {
  const rock = getCurrentRock();

  return (
    <div className="rounded-2xl border border-marmol bg-marmol/60 p-5 dark:border-white/10 dark:bg-white/5">
      <p className="text-xs font-semibold uppercase tracking-wide text-grafite dark:text-nuvola">
        Rock of the Week
      </p>
      <p className="mt-1 font-heading text-2xl font-bold text-ardesia dark:text-marmol">
        {rock.emoji} {rock.name}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-grafite dark:text-nuvola">
        {rock.facts.map((fact) => (
          <li key={fact} className="flex gap-2">
            <span className="text-nuvola dark:text-grafite">•</span>
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
