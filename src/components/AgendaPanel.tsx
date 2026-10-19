import type { CSSProperties, ReactNode } from "react";
import type { ReactionRow } from "@/components/RevealGrid";
import { AlertIcon, CheckIcon, FlagIcon, OffersIcon, RolesIcon } from "@/components/Icons";
import { ClampedText } from "@/components/ClampedText";
import {
  buildAgenda,
  type AgendaInfoItem,
  type AgendaParticipant,
  type AgendaUpdate,
  type FlaggedItem,
} from "@/lib/agenda";

const BLOCKED_KEY = "need_brain_on";

// The meeting's agenda, in the order the team works through it: what was flagged for
// discussion (most flags first), then anything blocked or struggling, then what closed
// and what opened. This is the reason the reveal exists, so it leads the page, sets in
// larger type for a shared screen, and sits on its own raised surface.
export function AgendaPanel({
  participants,
  updates,
  reactions,
  canMarkDiscussed = false,
  closed = false,
  onToggleDiscussed,
  animate = false,
}: {
  participants: AgendaParticipant[];
  updates: AgendaUpdate[];
  reactions: ReactionRow[];
  canMarkDiscussed?: boolean;
  closed?: boolean;
  onToggleDiscussed?: (updateId: string, fieldKey: string) => void;
  animate?: boolean;
}) {
  const { offersClosed, offersClosedTotal, rolesOpened, flagged } = buildAgenda(
    participants,
    updates,
    reactions
  );

  // Blocked items are their own section; both lists keep the most-flagged-first order.
  const flaggedItems = flagged.filter((item) => item.fieldKey !== BLOCKED_KEY);
  const blockedItems = flagged.filter((item) => item.fieldKey === BLOCKED_KEY);
  const hasInfo = offersClosed.length > 0 || rolesOpened.length > 0;

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

      <div
        className={`mt-6 grid gap-10 ${hasInfo ? "md:grid-cols-[1.5fr_1fr] md:gap-14" : ""}`}
      >
        <div className="flex flex-col gap-10">
          <DiscussionSection
            title="Flagged for discussion"
            icon={<FlagIcon filled className="size-6" />}
            items={flaggedItems}
            emptyText="Nothing was flagged for discussion."
            canMarkDiscussed={canMarkDiscussed}
            closed={closed}
            onToggleDiscussed={onToggleDiscussed}
          />
          <DiscussionSection
            title="Blocked or struggling"
            icon={<AlertIcon className="size-6" />}
            items={blockedItems}
            emptyText="Nobody is blocked or struggling."
            canMarkDiscussed={canMarkDiscussed}
            closed={closed}
            onToggleDiscussed={onToggleDiscussed}
          />
        </div>

        {hasInfo && (
          <div className="flex flex-col gap-8">
            <AgendaGroup
              title="Offers closed"
              icon={<OffersIcon className="size-5" />}
              items={offersClosed}
              // With one person the total just repeats their number.
              total={offersClosed.length >= 2 ? offersClosedTotal : undefined}
            />
            <AgendaGroup
              title="New roles opened"
              icon={<RolesIcon className="size-5" />}
              items={rolesOpened}
            />
          </div>
        )}
      </div>
    </section>
  );
}

// One numbered list of topics to work through, with how many are left.
function DiscussionSection({
  title,
  icon,
  items,
  emptyText,
  canMarkDiscussed,
  closed,
  onToggleDiscussed,
}: {
  title: string;
  icon: ReactNode;
  items: FlaggedItem[];
  emptyText: string;
  canMarkDiscussed: boolean;
  closed: boolean;
  onToggleDiscussed?: (updateId: string, fieldKey: string) => void;
}) {
  const remaining = items.filter((item) => !item.discussed).length;

  return (
    <div>
      <h3 className="flex items-center gap-2 font-heading text-2xl font-bold text-ember-ink">
        {icon}
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-1 text-base text-grafite dark:text-marmol/80">{emptyText}</p>
      ) : (
        <>
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
                All discussed. No stone left unturned.
              </>
            ) : (
              `${remaining} ${closed ? "not discussed" : "left to discuss"}`
            )}
          </p>
          <ol className="mt-5 flex flex-col gap-6">
            {items.map((item, index) => (
              <DiscussionItem
                key={item.itemKey}
                item={item}
                index={index}
                canMarkDiscussed={canMarkDiscussed}
                onToggleDiscussed={onToggleDiscussed}
              />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function DiscussionItem({
  item,
  index,
  canMarkDiscussed,
  onToggleDiscussed,
}: {
  item: FlaggedItem;
  index: number;
  canMarkDiscussed: boolean;
  onToggleDiscussed?: (updateId: string, fieldKey: string) => void;
}) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden="true"
        className="w-8 shrink-0 text-right font-heading text-2xl font-bold tabular-nums text-grafite dark:text-marmol/60"
      >
        {index + 1}.
      </span>
      <div className="min-w-0 flex-1">
        {item.discussed ? (
          // Done topics fold to one dimmed line; the text is one tap away.
          <details className="group">
            <summary className="flex min-h-9 cursor-pointer list-none flex-wrap items-center gap-x-2 text-base font-semibold text-grafite dark:text-marmol/75 [&::-webkit-details-marker]:hidden">
              <CheckIcon className="size-4 shrink-0" />
              <span>
                {item.name} · {item.label}
                <span className="sr-only">, discussed</span>
              </span>
              <span className="text-sm font-normal text-ember-ink underline underline-offset-2">
                <span className="group-open:hidden">Show</span>
                <span className="hidden group-open:inline">Hide</span>
              </span>
            </summary>
            <p className="whitespace-pre-line text-base [overflow-wrap:anywhere] text-grafite dark:text-marmol/75">
              {item.value}
            </p>
          </details>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-ardesia dark:text-marmol">
              <span>
                {item.name} · {item.label}
              </span>
              <FlagCount count={item.flagCount} />
            </p>
            <ClampedText
              lines={5}
              label={`${item.name}’s “${item.label}”`}
              className="whitespace-pre-line text-lg [overflow-wrap:anywhere] text-ardesia sm:text-xl dark:text-marmol"
            >
              {item.value}
            </ClampedText>
          </>
        )}
        {canMarkDiscussed && onToggleDiscussed && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => onToggleDiscussed(item.updateId, item.fieldKey)}
              aria-pressed={item.discussed}
              aria-label={`${item.discussed ? "Undo discussed:" : "Mark discussed:"} ${item.name}’s “${item.label}”`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-grafite/50 px-3 text-sm font-semibold text-grafite transition hover:border-ember-ink hover:text-ember-ink max-sm:min-h-11 dark:border-white/40 dark:text-marmol/80"
            >
              <CheckIcon className="size-4" />
              {item.discussed ? "Discussed. Undo" : "Mark discussed"}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// How many people flagged this item; each list is ranked by it.
function FlagCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ember-ink/50 px-2 py-0.5 text-sm font-semibold tabular-nums text-ember-ink">
      <FlagIcon filled className="size-3.5" />
      {count}
      <span className="sr-only"> {count === 1 ? "flag" : "flags"}</span>
    </span>
  );
}

function AgendaGroup({
  title,
  icon,
  items,
  total,
}: {
  title: string;
  icon: ReactNode;
  items: AgendaInfoItem[];
  total?: number;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-ardesia dark:text-marmol">
        <span className="text-ember-ink">{icon}</span>
        {title}
        {total !== undefined && (
          <span className="font-sans text-base font-semibold tabular-nums text-ember-ink">
            · {total} this week
          </span>
        )}
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <ClampedText
              lines={3}
              label={`${item.name}’s ${title}`}
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
