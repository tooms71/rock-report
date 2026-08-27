import { getCurrentRock } from "@/lib/rocks";

export function RockCard() {
  const rock = getCurrentRock();

  return (
    <div className="rounded-2xl border border-marmol bg-marmol/40 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-grafite">
        Rock of the Week
      </p>
      <p className="mt-1 font-heading text-2xl font-bold text-ardesia">
        {rock.emoji} {rock.name}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-grafite">
        {rock.facts.map((fact) => (
          <li key={fact} className="flex gap-2">
            <span className="text-nuvola">•</span>
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
