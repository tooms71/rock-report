import type { CSSProperties, ReactNode } from "react";
import type { ReactionRow } from "@/components/RevealGrid";
import { CheckIcon, FlagIcon, OffersIcon, RolesIcon } from "@/components/Icons";
import { ClampedText } from "@/components/ClampedText";
import {
  buildAgenda,
  type AgendaInfoItem,
  type AgendaParticipant,
  type AgendaUpdate,
} from "@/lib/agenda";

// The meeting's agenda: what closed, what opened, and what the team flagged. This is
// the reason the reveal exists, so it leads the page, sets in larger type for a
// shared screen, and sits on its own raised surface. Until something is flagged the
// numbers lead, so the first screen the room sees is never an empty state.
export function AgendaPanel({
  participants,
  updates,
  reactions,
  canMarkDiscussed = false,
  canFlag = false,
  closed = false,
  onToggleDiscussed,
  animate = false,
}: {
  participants: AgendaParticipant[];
  updates: AgendaUpdate[];
  reactions: ReactionRow[];
  canMarkDiscussed?: boolean;
  canFlag?: boolean;
  closed?: boolean;
  onToggleDiscussed?: (updateId: string, fieldKey: string) => void;
  animate?: boolean;
}) {
  const { offersClosed, rolesOpened, flagged } = buildAgenda(participants, updates, reactions);

  const remaining = flagged.filter((f) => !f.discussed).length;
  const hasInfo = offersClosed.length > 0 || rolesOpened.length > 0;

  const infoGroups = (
    <>
      <AgendaGroup title="Offers closed" icon={<OffersIcon className="size-5" />} items={offersClosed} />
      <AgendaGroup title="New roles opened" icon={<RolesIcon className="size-5" />} items={rolesOpened} />
    </>
  );

  return (
    <section
      aria-labelledby="agenda-heading"
      className={`rounded-3xl border border-grafite/20 bg-white p-6 shadow-[0_1px_2px_rgba(46,43,43,0.08),0_16px_40px_-16px_rgba(46,43,43,0.25)] sm:p-8 dark:border-white/25 dark:bg-white/[0.12] dark:shadow-none ${
        animate ? "arrive" : ""
      }`}
      style={animate ? ({ "--arrive-delay": "140ms" } as CSSProperties) : undefined}
    >
      <h2
        id="agenda-heading"
        className="font-heading text-4xl font-bold text-ardesia dark:text-marmol"
      >
        Agenda
      </h2>

      {flagged.length === 0 ? (
        <>
          {hasInfo && (
            <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-14">{infoGroups}</div>
          )}
          <div
            className={
              hasInfo
                ? "mt-8 border-t border-grafite/20 pt-5 dark:border-white/20"
                : "mt-6"
            }
          >
            <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-ember-ink">
              <FlagIcon filled className="size-5" />
              Flagged for discussion
            </h3>
            <p className="mt-1 text-base text-grafite dark:text-marmol/80">
              {canFlag
                ? "Nothing yet. Tap Flag on any card below to add a topic here."
                : "Nothing was flagged for discussion."}
            </p>
          </div>
        </>
      ) : (
        <div
          className={`mt-6 grid gap-10 ${
            hasInfo ? "md:grid-cols-[1.5fr_1fr] md:gap-14" : ""
          }`}
        >
          <div>
            <h3 className="flex items-center gap-2 font-heading text-2xl font-bold text-ember-ink">
              <FlagIcon filled className="size-6" />
              Flagged for discussion
            </h3>
            <p
              className={`mt-1 flex items-center gap-1.5 text-base ${
                remaining === 0
                  ? "font-semibold text-ember-ink"
                  : "text-grafite dark:text-marmol/80"
              }`}
            >
              {remaining === 0 ? (
                <>
                  <CheckIcon className="size-5" />
                  All discussed. Nice work.
                </>
              ) : (
                `${remaining} ${closed ? "not discussed" : "left to discuss"}`
              )}
            </p>
            <ol className="mt-5 flex flex-col gap-6">
              {flagged.map((item, index) => (
                <li key={item.itemKey} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="w-8 shrink-0 text-right font-heading text-2xl font-bold tabular-nums text-grafite dark:text-marmol/60"
                  >
                    {index + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`flex flex-wrap items-center gap-x-2 text-base font-semibold ${
                        item.discussed
                          ? "text-grafite dark:text-marmol/75"
                          : "text-ardesia dark:text-marmol"
                      }`}
                    >
                      {item.name} · {item.label}
                    </p>
                    <ClampedText
                      lines={5}
                      className={`whitespace-pre-line text-lg [overflow-wrap:anywhere] sm:text-xl ${
                        item.discussed
                          ? "text-grafite line-through decoration-1 dark:text-marmol/75"
                          : "text-ardesia dark:text-marmol"
                      }`}
                    >
                      {item.value}
                    </ClampedText>
                    {(canMarkDiscussed || item.discussed) && (
                      <div className="mt-2">
                        {canMarkDiscussed && onToggleDiscussed ? (
                          <button
                            type="button"
                            onClick={() => onToggleDiscussed(item.updateId, item.fieldKey)}
                            aria-pressed={item.discussed}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-grafite/50 px-3 text-sm font-semibold text-grafite transition hover:border-ember-ink hover:text-ember-ink max-sm:min-h-11 dark:border-white/40 dark:text-marmol/80"
                          >
                            <CheckIcon className="size-4" />
                            {item.discussed ? "Discussed. Undo" : "Mark discussed"}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-grafite dark:text-marmol/70">
                            <CheckIcon className="size-4" />
                            Discussed
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {hasInfo && <div className="flex flex-col gap-8">{infoGroups}</div>}
        </div>
      )}
    </section>
  );
}

function AgendaGroup({
  title,
  icon,
  items,
}: {
  title: string;
  icon: ReactNode;
  items: AgendaInfoItem[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-ardesia dark:text-marmol">
        <span className="text-ember-ink">{icon}</span>
        {title}
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <ClampedText
              lines={3}
              className="whitespace-pre-line text-base [overflow-wrap:anywhere] text-ardesia dark:text-marmol"
            >
              <span className="font-semibold">{item.name}</span>
              <span className="text-grafite dark:text-marmol/70"> · </span>
              {item.text}
            </ClampedText>
          </li>
        ))}
      </ul>
    </div>
  );
}
