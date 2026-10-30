# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A small, trusted internal team at Carrara that runs a weekly team-update ritual. Their updates are about hiring (offers out, offers closed, new roles opened), which suggests a recruiting or talent team (inferred from the fields, not stated by the owner).

Each person uses it on their own screen, mostly on a laptop. It also has to read well when someone screen-shares it during the discussion. They join by typing a name; there are no accounts.

## Product Purpose

Rock Report replaces a status meeting's round-robin with a short written update. Everyone writes any time before the meeting; when the facilitator starts the meeting, all updates are revealed together. The reveal becomes the meeting agenda: offers closed and new roles opened are listed automatically, and anything a teammate flags is collected as "flagged for discussion". Past weeks are kept in an archive so someone who was away can catch up by reading.

Success: the team finishes updates quickly, the discussion goes straight to what actually needs talking about, and nobody who missed a week is lost.

## Positioning

Written in advance, read together. The simultaneous reveal at the start of the meeting is what makes it a team moment, and the output is an agenda rather than a pile of posts. A generic survey or standup bot would not do the "everyone writes, then everyone sees at once" moment.

## Operating Context

- Weekly. The session for each Monday meeting opens on the Thursday before (the first visit creates it); people write whenever they like until the meeting. Bec is always the facilitator (matched by sign-in email, list in src/lib/facilitators.ts) and controls Start the meeting, Build the agenda and Close.
- No scheduling or reminders in the app.
- Data is stored in Supabase (free tier, which pauses after about a week of inactivity and must be restored from the dashboard). Hosting on Vercel is planned but not yet done.

## Capabilities and Constraints

- Entries, in order: offers out, offers closed (each with an optional note), new roles opened, top priorities of the week (hint: no more than 3, not enforced), and "Anything else?" (with suggestions: something learned, something surprising, where you could use another brain, something interesting about the week).
- Flagging: new roles opened, offers out, top priorities, and anything else can each be flagged for discussion.
- Phases: lobby, writing (timer), reveal, closed (read-only). Phase changes sync live across everyone.
- Identity is a typed name, remembered in the browser. No authentication; database access is open to the public key. Acceptable for a small trusted team, to be revisited if the audience grows.
- Not decided: whether to deploy publicly; whether to enforce the 3-priority limit; whether the live timer and simultaneous reveal stay as they are.

## Brand Commitments

- The owner leans toward keeping the existing Carrara look (warm charcoal, ember orange used sparingly, PT Serif headings, Manrope body, a marble-style Rock of the Week card) but is explicitly not committed to it if something better emerges.
- The owner likes the live timer plus simultaneous reveal because it timeboxes the ritual so it finishes quickly, but is open to a more delightful experience.
- Dark mode must always remain available.
- The Rock of the Week (a rotating rock fact card) keeps the ritual light.

## Evidence on Hand

- SPEC.md describes the original intent and data model.
- No real usage data, testimonials, or metrics exist. Past sessions in the database were all test data and have been deleted. Do not fabricate usage claims.

## Product Principles

1. Fast to finish: the whole write-and-reveal loop is timeboxed, and nothing should slow people down.
2. The reveal is a shared moment: everyone sees everything at once, together.
3. Output is an agenda, not a feed: design should surface what needs discussion first.
4. Zero friction to join: a name is enough; no accounts, setup, or roster upkeep.
5. Light, not goofy: the ritual should feel warm and a little playful without getting in the way of the work.

## Accessibility & Inclusion

- Dark mode must always be available and fully readable (contrast was a real problem earlier in this project).
- Text and cards must stay legible when screen-shared.
- Primarily a laptop experience; phone layouts should still work but are secondary.

## Since 2026-10-26 (after the first whole-team round)

- Phases: writing (opens the Thursday before the meeting, no timer) -> reveal (read, upvote, react) -> agenda -> closed.
- The facilitator has a box for her own agenda topics (one per line); they sit between New roles opened and the hive mind.
- Stalled roles join the hive mind only if their owner taps "Discuss with the group".
- "Anomalies and trends" is a new box; like "Worth sharing", it reaches the agenda only once upvoted.
- Wins can get emoji reactions and a collapsed comment thread; both are in the copied meeting notes.
- Not built yet: upvoting early once everyone has submitted (needs the full team list).
