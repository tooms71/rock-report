import type { CSSProperties, ReactNode } from "react";
import type { ReactionRow } from "@/components/RevealGrid";
import {
  CheckIcon,
  HiveIcon,
  OffersIcon,
  RolesIcon,
  SparkIcon,
  TopicsIcon,
  UpvoteIcon,
} from "@/components/Icons";
import { WINS_KEY } from "@/lib/social";
import { ClampedText } from "@/components/ClampedText";
import {
  buildAgenda,
  type AgendaInfoItem,
  type AgendaParticipant,
  type AgendaUpdate,
  type DiscussionItem,
} from "@/lib/agenda";
import type { RoleUpdateRow } from "@/lib/roleStatus";
import { Reactions, type Social } from "@/components/Reactions";

// The meeting's agenda, in the order the room works through it: celebrate (wins and
// offers), read out the new roles, the topics the facilitator added, then the lists the
// team votes on: the hive mind and what is worth sharing. It leads the page, sets in larger type for a shared screen, and sits
// on its own raised surface.
export function AgendaPanel({
  participants,
  updates,
  reactions,
  canMarkDiscussed = false,
  closed = false,
  onToggleDiscussed,
  animate = false,
  roleUpdates = [],
  social,
}: {
  participants: AgendaParticipant[];
  updates: AgendaUpdate[];
  reactions: ReactionRow[];
  roleUpdates?: RoleUpdateRow[];
  social?: Social;
  canMarkDiscussed?: boolean;
  closed?: boolean;
  onToggleDiscussed?: (updateId: string, fieldKey: string) => void;
  animate?: boolean;
}) {
  const agenda = buildAgenda(participants, updates, reactions, roleUpdates);
  const topicAuthors = [...new Set(agenda.facilitatorTopics.map((t) => t.name))];
  const celebrating =
    agenda.wins.length + agenda.offersAccepted.length + agenda.offersExtended.length > 0;

  return (
    <section
      aria-labelledby="agenda-heading"
      className={`rounded-3xl border border-grafite/20 bg-white p-6 shadow-[0_1px_2px_rgba(46,43,43,0.08),0_16px_40px_-16px_rgba(46,43,43,0.25)] sm:p-8 dark:border-white/25 dark:bg-white/[0.12] dark:shadow-none ${
        animate ? "arrive" : ""
      }`}
      style={animate ? ({ "--arrive-delay": "140ms" } as CSSProperties) : undefined}
    >
      {/* The page already says "Agenda"; this names the region for screen readers. */}
      <h2 id="agenda-heading" className="sr-only">
        Agenda
      </h2>

      <div className="grid gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <SectionHeading icon={<OffersIcon className="size-6" />}>Wins and offers</SectionHeading>
          {celebrating ? (
            <div className="mt-3 flex flex-col gap-5">
              <InfoGroup
                title="Wins"
                items={agenda.wins}
                extra={
                  social
                    ? (item) => (
                        <Reactions
                          updateId={item.updateId ?? item.id}
                          fieldKey={item.fieldKey ?? WINS_KEY}
                          reactions={reactions}
                          social={social}
                          emoji
                          comments
                        />
                      )
                    : undefined
                }
              />
              <InfoGroup
                title="Offers accepted"
                items={agenda.offersAccepted}
                // With one person the total just repeats their number.
                total={agenda.offersAccepted.length >= 2 ? agenda.offersAcceptedTotal : undefined}
                extra={
                  social
                    ? (item) =>
                        item.updateId && item.fieldKey ? (
                          <Reactions
                            updateId={item.updateId}
                            fieldKey={item.fieldKey}
                            reactions={reactions}
                            social={social}
                            emoji
                            comments
                          />
                        ) : null
                    : undefined
                }
              />
              <InfoGroup
                title="Offers extended"
                items={agenda.offersExtended}
                total={agenda.offersExtended.length >= 2 ? agenda.offersExtendedTotal : undefined}
                extra={
                  social
                    ? (item) =>
                        item.updateId && item.fieldKey ? (
                          <Reactions
                            updateId={item.updateId}
                            fieldKey={item.fieldKey}
                            reactions={reactions}
                            social={social}
                            emoji
                            comments
                          />
                        ) : null
                    : undefined
                }
              />
            </div>
          ) : (
            <p className="mt-1 text-base text-grafite dark:text-marmol/80">
              No wins or offers this week.
            </p>
          )}
        </div>

        <div>
          <SectionHeading icon={<RolesIcon className="size-6" />}>New roles opened</SectionHeading>
          {agenda.rolesOpened.length > 0 ? (
            <InfoList items={agenda.rolesOpened} label="New roles opened" />
          ) : (
            <p className="mt-1 text-base text-grafite dark:text-marmol/80">
              No new roles this week.
            </p>
          )}
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-12">
        {agenda.facilitatorTopics.length > 0 && (
          <DiscussionSection
            title={`Topics from ${topicAuthors.join(" and ")}`}
            icon={<TopicsIcon className="size-6" />}
            items={agenda.facilitatorTopics}
            emptyText=""
            canMarkDiscussed={canMarkDiscussed}
            closed={closed}
            onToggleDiscussed={onToggleDiscussed}
          />
        )}
        <DiscussionSection
          title="Hive mind"
          icon={<HiveIcon className="size-6" />}
          items={agenda.hiveMind}
          emptyText="Nobody has asked the hive mind for anything."
          canMarkDiscussed={canMarkDiscussed}
          closed={closed}
          onToggleDiscussed={onToggleDiscussed}
          social={social}
          reactions={reactions}
        />
        <DiscussionSection
          title="Worth sharing"
          icon={<SparkIcon className="size-6" />}
          items={agenda.cool}
          emptyText="Nothing here has been upvoted yet."
          canMarkDiscussed={canMarkDiscussed}
          closed={closed}
          onToggleDiscussed={onToggleDiscussed}
          social={social}
          reactions={reactions}
        />
      </div>
    </section>
  );
}

function SectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 font-heading text-2xl font-bold text-ardesia dark:text-marmol">
      <span className="text-ember-ink">{icon}</span>
      {children}
    </h3>
  );
}

// One numbered list of topics to work through, ranked by upvotes.
function DiscussionSection({
  title,
  icon,
  items,
  emptyText,
  canMarkDiscussed,
  closed,
  onToggleDiscussed,
  social,
  reactions,
}: {
  title: string;
  icon: ReactNode;
  items: DiscussionItem[];
  emptyText: string;
  // Given when people can comment on these topics (not the facilitator's own).
  social?: Social;
  reactions?: ReactionRow[];
  canMarkDiscussed: boolean;
  closed: boolean;
  onToggleDiscussed?: (updateId: string, fieldKey: string) => void;
}) {
  const remaining = items.filter((item) => !item.discussed).length;

  return (
    <div>
      <SectionHeading icon={icon}>{title}</SectionHeading>
      {items.length === 0 ? (
        <p className="mt-1 text-base text-grafite dark:text-marmol/80">{emptyText}</p>
      ) : (
        <>
          {/* The footer already counts what is left; here only the good news (and, once
              closed, what was not reached). */}
          {remaining === 0 ? (
            <p className="mt-1 flex items-center gap-1.5 text-base text-grafite dark:text-marmol/80">
              <CheckIcon className="size-5" />
              All discussed. No stone left unturned.
            </p>
          ) : (
            closed && (
              <p className="mt-1 text-base text-grafite dark:text-marmol/80">
                {remaining} not discussed
              </p>
            )
          )}
          <ol className="mt-5 flex flex-col gap-6">
            {items.map((item, index) => (
              <TopicItem
                key={item.itemKey}
                item={item}
                index={index}
                canMarkDiscussed={canMarkDiscussed}
                onToggleDiscussed={onToggleDiscussed}
                social={social}
                reactions={reactions}
              />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function TopicItem({
  item,
  index,
  canMarkDiscussed,
  onToggleDiscussed,
  social,
  reactions,
}: {
  item: DiscussionItem;
  index: number;
  social?: Social;
  reactions?: ReactionRow[];
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
        {/* A discussed topic stays in place with its text; it just reads as done. */}
        <p
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold ${
            item.discussed ? "text-grafite dark:text-marmol/75" : "text-ardesia dark:text-marmol"
          }`}
        >
          <span>{item.name}</span>
          {item.voteCount > 0 && <VoteCount count={item.voteCount} />}
          {item.discussed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-moss-ink/15 px-2 py-0.5 text-sm font-semibold text-moss-ink">
              <CheckIcon className="size-3.5" />
              Discussed
            </span>
          )}
        </p>
        <ClampedText
          lines={5}
          label={`${item.name}’s ${item.label}`}
          className={`whitespace-pre-line text-lg [overflow-wrap:anywhere] sm:text-xl ${
            item.discussed ? "text-grafite dark:text-marmol/75" : "text-ardesia dark:text-marmol"
          }`}
        >
          {item.value}
        </ClampedText>
        {social && reactions && (
          <Reactions
            updateId={item.updateId}
            fieldKey={item.fieldKey}
            reactions={reactions}
            social={social}
            comments
          />
        )}
        {canMarkDiscussed && onToggleDiscussed && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => onToggleDiscussed(item.updateId, item.fieldKey)}
              aria-pressed={item.discussed}
              aria-label={`${item.discussed ? "Undo discussed:" : "Mark discussed:"} ${item.name}’s ${item.label}`}
              className="-ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-grafite transition hover:text-ember-ink max-sm:min-h-11 dark:text-marmol/80"
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

// How many people upvoted this topic; each list is ranked by it.
function VoteCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ember-ink/50 px-2 py-0.5 text-sm font-semibold tabular-nums text-ember-ink">
      <UpvoteIcon filled className="size-3.5" />
      {count}
      <span className="sr-only"> {count === 1 ? "upvote" : "upvotes"}</span>
    </span>
  );
}

function InfoList({
  items,
  label,
  extra,
}: {
  items: AgendaInfoItem[];
  label: string;
  extra?: (item: AgendaInfoItem) => ReactNode;
}) {
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <ClampedText
            lines={3}
            label={`${item.name}’s ${label}`}
            className="whitespace-pre-line text-base [overflow-wrap:anywhere] text-ardesia dark:text-marmol"
          >
            <span className="font-semibold">{item.name}</span>
            <span className="text-grafite dark:text-marmol/70"> · </span>
            {item.text}
          </ClampedText>
          {extra?.(item)}
        </li>
      ))}
    </ul>
  );
}

// A small labelled list inside the "Wins and offers" block.
function InfoGroup({
  title,
  items,
  total,
  extra,
}: {
  title: string;
  items: AgendaInfoItem[];
  total?: number;
  extra?: (item: AgendaInfoItem) => ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-base font-semibold text-grafite dark:text-marmol/80">
        {title}
        {total !== undefined && (
          <span className="tabular-nums text-ember-ink"> · {total} this week</span>
        )}
      </h4>
      <InfoList items={items} label={title} extra={extra} />
    </div>
  );
}
