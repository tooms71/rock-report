# Rock Report — Product Spec

> Working title: **Rock Report** (placeholder — swap freely; "Bedrock", "Strata", and "The Weekly Quarry" also fit the Carrara theme).
>
> A weekly, live team-update ritual. Everyone fills out a short form during a shared 3-minute timer, then all updates reveal at once for reading, reacting, and flagging things for discussion. There's a silly "Rock of the Week" to keep it light.

This document is written to be handed directly to Claude Code as the source of truth for building v1. It states the decisions, the data model, the exact behavior of each phase, and a step-by-step build order. Where something is deliberately out of scope for v1, it says so.

---

## 1. The core idea, in one paragraph

Once a week the team gathers (in a call or just online at the same time). One person opens that week's session. Everyone joins by picking their name. A **Rock of the Week** card sits at the top for flavor. The facilitator starts a **3-minute writing timer** that counts down the same for everyone. During those 3 minutes, each person fills out a five-field update. When the timer ends (or everyone submits early), the app flips to the **reveal**: all updates appear together, and people read, drop emoji **reactions**, and — critically — can hit a **🚩 red-flag** reaction on anything that needs group discussion. A "Flagged for discussion" panel collects every red flag so the team knows exactly what to talk through. Then the session closes and is archived.

---

## 2. Decisions already made (do not re-litigate in v1)

| Decision | Choice | Why |
|---|---|---|
| Timing model | **Live synchronous room** | The reveal-together moment is the whole point of the ritual. |
| Identity | **Lightweight — type your name** | Trusted internal team. No passwords, no email flow. You type your name to join; it's remembered in `localStorage` so next week it's pre-filled. Names already in this session show as quick-pick chips. No pre-configured roster to maintain. |
| Stack | **Next.js (App Router) + Supabase + Tailwind**, deployed on **Vercel** | Least code for a first app: Supabase Realtime handles all live sync so no websocket server is hand-written. Both have generous free tiers. Claude Code has deep familiarity with all of these. |
| v1 scope | **Full ritual loop + Rock of the Week + red-flag flagging.** Comments deferred to v1.1. | Reactions, red flags, and the rock are cheap and central to the fun. Threaded comments are the one real complexity worth deferring. |

---

## 3. Recommended stack (and why each piece)

- **Next.js (App Router, TypeScript).** One deployable app — UI and a few server routes in the same project. No separate backend to host.
- **Supabase.** Managed Postgres for storage **plus Supabase Realtime**, which pushes database changes to every connected browser over websockets *without you writing any socket code*. This is what makes "the reveal happens for everyone at once" and "reactions appear live" work. Also gives you a table editor UI for free, which is great while learning.
- **Tailwind CSS.** Fast, consistent styling without wrestling CSS files. Good for a playful, card-based UI.
- **Vercel.** Push the repo, connect it, done. Auto-deploys on every git push. Free tier is plenty for a team tool.

**Why not a hand-rolled websocket server?** For a first app, running your own realtime server is the part most likely to eat your time and break in production. Supabase Realtime removes that entire category of work. The upgrade path (real auth, more history) is also clean.

**Cost:** Supabase free tier + Vercel free tier = $0 for a team of this size. No credit card needed to start.

---

## 4. The five form fields

Each person's weekly update has exactly these fields. Keep labels friendly.

1. **Offers made** — how many offers went out this week. *(number, optional short note)*
2. **Offers closed** — how many closed. *(number, optional short note)*
3. **New roles opened** — roles that opened up this week. *(short text — can be empty)*
4. **Something I learned or that surprised me** — work or not. *(text — this is the fun one, encourage it)*
5. **Where I could use a brain** — where you're stuck / want help. *(text — anything flagged here is a natural discussion candidate)*

Notes for the build:
- All fields optional to *submit* (people shouldn't be blocked), but the UI should gently encourage filling them.
- Offers made / closed: a number input with an optional one-line note beside it.
- Fields 3–5 are multiline text.
- Autosave the draft as the person types (so a refresh mid-timer doesn't lose work).

---

## 5. The session lifecycle (the heart of the app)

A **session** is one week's instance of the ritual. It moves through four phases. All clients stay in sync via Supabase Realtime subscribed to the session row.

### Phase: `lobby`
- Someone opens the app and either **creates this week's session** or joins the one that exists.
- Everyone joins by **typing their name** (pre-filled from `localStorage` if they've joined before; names already in this session show as one-tap quick-pick chips). This creates a `participant` row.
- The lobby shows: who's joined so far (live), the **Rock of the Week** card, and — **only for the session creator** — a **"Start writing (3:00)"** button.
- **Facilitator = whoever created the session.** Store `facilitator_participant_id` when the session is made. Only the facilitator sees Start and, later, "Reveal now." Everyone else just waits. This keeps control unambiguous and the UI simpler.

### Phase: `writing`
- Triggered by the facilitator pressing Start. The server sets `writing_ends_at = now() + 3 minutes` on the session row.
- **Every client computes its countdown from `writing_ends_at`**, not from a local timer. This is the trick that keeps all timers in agreement even if people joined at slightly different moments.
- Each person sees the five-field form and fills it in. Drafts autosave.
- A person can **submit early**; once submitted they see a calm "waiting for the reveal" state (and can un-submit to edit while the timer still runs).
- **Transition to reveal happens when either:** (a) the countdown reaches zero, or (b) everyone present has submitted. Guard the flip so it happens exactly once (see §8 on the timer race).

### Phase: `reveal`
- All submitted updates appear together as a grid/stack of cards, one per person.
- Anyone can add **emoji reactions** to any update (and, nice-to-have, to an individual field). Reactions appear live for everyone.
- The reaction set includes a distinct **🚩 red flag**. Red-flagging an update (or field) marks it "flagged for group discussion."
- A **"🚩 Flagged for discussion (N)"** panel — pinned at the top or side — lists every flagged item with who it belongs to, so the team has an instant agenda.
- The rock card stays visible for continuity.

### Phase: `closed`
- Facilitator ends the session (or it auto-closes after some idle time — optional).
- The session and all its data persist so it can be reopened read-only later. A minimal "past weeks" list is a v1.1 nicety; v1 just needs the data to survive.

---

## 6. Data model

Postgres tables in Supabase. IDs are uuids; timestamps are `timestamptz`.

**`sessions`**
- `id`
- `week_of` (date — the Monday of that week)
- `phase` (enum/text: `lobby` | `writing` | `reveal` | `closed`)
- `writing_ends_at` (nullable — set when writing starts)
- `facilitator_participant_id` (nullable)
- `created_at`

**`participants`**
- `id`
- `session_id` → sessions
- `display_name`
- `joined_at`
- (v1 identity is just the name; no auth row)

**`updates`** — one per participant per session
- `id`
- `session_id`, `participant_id`
- `offers_made` (int, nullable), `offers_made_note` (text, nullable)
- `offers_closed` (int, nullable), `offers_closed_note` (text, nullable)
- `roles_opened` (text, nullable)
- `learned_or_surprised` (text, nullable)
- `need_brain_on` (text, nullable)
- `submitted_at` (nullable — null = still a draft)
- unique on (`session_id`, `participant_id`)

**`reactions`**
- `id`
- `session_id`
- `target_type` (`update` | `field`)
- `target_update_id` → updates
- `field_key` (nullable text — e.g. `need_brain_on`, only when target_type = field)
- `emoji` (text — includes `🚩`)
- `participant_id`
- `created_at`
- A red flag is simply a reaction with `emoji = '🚩'`. The Flagged panel is a query for those.

**`comments`** — **v1.1, not v1.** Include the table shape now so the schema doesn't need reworking later:
- `id`, `session_id`, `target_type`, `target_update_id`, `field_key` (nullable), `participant_id`, `body`, `created_at`.

**Rocks** live in code, not the DB — see §7.

---

## 7. Rock of the Week

A rotating card of a real rock/mineral with 2–3 fun facts, chosen deterministically by ISO week number so it's stable all week and cycles through the list. Keep it as a static array in the codebase (`lib/rocks.ts`) — no DB needed. Pick with `rocks[isoWeekNumber % rocks.length]`.

Seed content to start with (expand freely):

```ts
export const rocks = [
  { name: "Pumice",     emoji: "🪨", facts: ["It's the only rock that floats — it's full of gas bubbles.", "Formed when frothy lava cools almost instantly.", "People have kept the same bar of pumice in their shower for a decade."] },
  { name: "Obsidian",   emoji: "⚫", facts: ["Volcanic glass, not a crystal — it cooled too fast to form one.", "Can be knapped sharper than a surgical scalpel.", "Fractures in smooth curves called conchoidal fractures."] },
  { name: "Geode",      emoji: "🔮", facts: ["A boring rock on the outside, a crystal cave on the inside.", "You genuinely can't tell what's inside until you crack it open.", "They form over millions of years from mineral-rich water."] },
  { name: "Carrara Marble", emoji: "🏛️", facts: ["Michelangelo's David is carved from it.", "It's been quarried from the same Italian mountains for 2,000+ years.", "It's just limestone that got squeezed and heated for eons."] },
  { name: "Flint",      emoji: "🔥", facts: ["Strike it right and it throws sparks — the original lighter.", "Stone Age toolmakers' favorite material.", "It's a form of quartz that grew inside chalk."] },
  { name: "Magnetite",  emoji: "🧲", facts: ["It's naturally magnetic — 'lodestone' was the first compass.", "Some bacteria grow tiny magnetite crystals to navigate.", "It's one of the most magnetic natural minerals on Earth."] },
  { name: "Kidney Ore (Hematite)", emoji: "🩸", facts: ["Its streak is blood-red even when the rock looks silver.", "Named from the Greek for 'blood'.", "It's the main ore we get iron from."] },
  { name: "Fulgurite",  emoji: "⚡", facts: ["It's a rock made by a lightning strike hitting sand.", "Basically frozen lightning — a hollow glass tube.", "Collectors dig them up on beaches after storms."] },
];
```

---

## 8. Things to get right (the tricky bits)

**The timer race.** When the countdown hits zero, *every* client might try to flip the phase to `reveal` at the same instant. Flip it with a guarded update: `update sessions set phase='reveal' where id=? and phase='writing'` — only the first one wins, the rest are no-ops. The facilitator can also flip early with a **"Reveal now"** button (facilitator-only), and the phase flips automatically once all present participants have submitted.

**Timer sync.** Never trust each browser's own stopwatch. Store `writing_ends_at` on the session and compute `secondsLeft = writing_ends_at - now` on each client. Everyone lands on zero together regardless of when they joined.

**Draft safety.** Autosave the update row as the person types (debounced). A refresh mid-writing should restore their draft. `submitted_at = null` means draft; setting it means submitted.

**Rejoining.** Name in `localStorage` → if a participant with that name already exists in this session, reuse it rather than creating a duplicate.

**Realtime subscriptions.** Subscribe clients to: the `sessions` row (phase + timer changes), `participants` (lobby presence), `updates` (so the reveal populates live), and `reactions` (so reactions and flags appear instantly).

---

## 9. What's explicitly OUT of v1

- **Comments / threaded discussion.** Reactions + red flags cover the "react and surface for discussion" need in v1. Comments are v1.1 (table shape is already reserved in §6).
- **Real authentication.** Name-picking only. Magic-link/SSO is a later upgrade.
- **A polished archive/history browser.** Data persists; a nice "past weeks" view comes later.
- **Editing an update after the reveal.** Once revealed, updates are read-only.
- **Multiple teams / workspaces.** One team in v1 (roster is a config constant).
- **Notifications / reminders to fill it out.** (A weekly Slack ping could be a fun later add.)

---

## 10. Definition of done for v1

The ritual works end to end with a few people in different browsers:

- [ ] A person can open the app, see the Rock of the Week, and join by picking a name.
- [ ] The lobby shows everyone who has joined, updating live.
- [ ] The facilitator starts a 3:00 timer and it counts down in agreement across all browsers.
- [ ] Each person fills the five fields; drafts survive a refresh; submitting early works.
- [ ] When the timer ends (or all submit), every browser flips to the reveal together.
- [ ] All updates are visible; emoji reactions appear live for everyone.
- [ ] A 🚩 red flag on any update surfaces it in a "Flagged for discussion" panel.
- [ ] The session can be closed, and its data survives (visible in the Supabase table editor at minimum).
- [ ] Deployed to a Vercel URL a teammate can actually open.

---

## 10a. Branding — use Carrara's design system

The app should look like Carrara, using the same palette and type as the `quarry-create` deck/doc system. Identity rule to honor everywhere: **warm charcoal + orange, not rainbow.** Ember is the accent and appears on *one* anchor element per screen — the primary action, or a flag — never scattered.

**Palette**

| Token | Hex | Role |
|---|---|---|
| Ardesia | `#2E2B2B` | Primary text; dark surfaces in dark mode |
| Ember | `#EB4C18` | The one accent — primary buttons + 🚩 flags |
| Ember light | `#FDDED4` | Ember fills (flag panel background, active pills) |
| Grafite | `#595959` | Secondary text |
| Nuvola (warm) | `#9A938E` | Muted labels, captions |
| Marmol | `#EEEEEE` | Marble surface/neutral fills |
| White | `#FFFFFF` | Base surface (light mode) |

Map these to CSS variables (e.g. Tailwind theme colors: `ember`, `ardesia`, `grafite`, `marmol`). In this app Ember lands on: the facilitator's **Start / Reveal** buttons, the **writing timer's** progress, and every **🚩 flag** (flagged card rail + the Flagged-for-discussion panel). Everything else is charcoal + marble. The Rock-of-the-Week card is a **marble/stone card** (neutral), not an orange one — keeps Ember scarce and leans into the quarry theme.

**Type** — both are on Google Fonts, so a single `<link>` covers them:

- **PT Serif** (bold) — app name, headings, the big timer number, person names on cards. Editorial, matches Carrara doc titles.
- **Manrope** — everything else: body, labels, buttons, metrics. Use `font-variant-numeric: tabular-nums` for the timer and the offers counts so digits align.

A working reference implementation of this exact palette + type in both light and dark themes is the wireframe artifact — Claude Code can open it to copy the token values and font links rather than re-deriving them.

## 11. Suggested build order (for Claude Code)

Build in vertical slices so you always have something runnable. Roughly:

1. **Scaffold.** Next.js + TypeScript + Tailwind app. Deploy the empty app to Vercel once, early, so hosting is proven before there's logic to debug.
2. **Supabase + schema.** Create the project, run the SQL for the tables in §6, wire the Supabase client into the app.
3. **Join + lobby.** Name-pick screen, participant creation, live presence list, Rock of the Week card. (First taste of Realtime.)
4. **Writing phase.** Facilitator Start button → `writing_ends_at` → synced countdown → the five-field form with autosave and early submit.
5. **Reveal.** Guarded phase flip → the grid of update cards.
6. **Reactions + red flags.** Emoji reactions live via Realtime; the Flagged-for-discussion panel.
7. **Close + persistence.** End the session; confirm data survives.
8. **Polish.** Empty states, the "waiting for reveal" screen, mobile layout, a little playful styling.

Then, only after v1 feels good: **v1.1 comments**, then real auth and a history view.

---

## 12. A good first prompt to give Claude Code

> "Read SPEC.md. Let's build Rock Report step by step following the build order in §11. Start with step 1 only: scaffold a Next.js App Router app with TypeScript and Tailwind, get it running locally, and set it up so I can deploy it to Vercel. Explain what you're doing as you go — this is my first app and I want to understand the structure. Stop after step 1 so I can deploy and confirm it works before we continue."

Working one numbered step at a time, deploying early, and asking it to explain as it goes will make this a much better first-app experience than asking for everything at once.

---

## 13. Settled decisions (previously open — now decided)

- **Team roster:** No pre-configured roster. Join by typing your name; it's remembered in `localStorage` for next week, and names already in the current session appear as quick-pick chips.
- **Facilitator rules:** Only the **session creator** can Start writing and Reveal. Everyone else joins and waits.
- **Scheduling:** The app does **not** schedule anything. Someone opens it at the team's meeting time and creates the session. No timezones, no reminders in v1.
- **The rock list:** Ship with the eight starter rocks in §7 as-is. (Easy to add more to the array anytime.)

Guiding principle for the whole build: **when in doubt, choose the simpler option.** This is a first app and a small trusted team — favor fewer screens, fewer settings, and fewer edge cases over completeness.
