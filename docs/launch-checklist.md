# Rock Report: launch checklist

Goal: put Rock Report online so the Carrara team can use it from their own laptops, and
make sure only people with a Carrara Google account can get in.

Today the app only runs on Shannon's laptop. It has no login, and its database accepts
anyone who has the key that ships inside the page. That is fine locally. It is not fine
for a link the team opens, because updates include client names and hiring details.

## Decisions to confirm first

- [x] Does Carrara use **Google Workspace** for email? Yes (confirmed), so the sign-in
      plan below stands.
- [x] The company email domain is **@carrara.is**. Sign-in is limited to it.
- [x] Can Shannon's @carrara.is account create a Google Cloud project on its own? Yes,
      done. (Often yes. A colleague who has done this says to sign in at console.cloud.google.com with
      the @carrara.is account and try. If it is blocked, ask whoever administers Carrara's
      Google Workspace / Google Cloud.)
- [ ] Who administers Carrara's **Notion** (only needed for the optional open-roles table)?
- [ ] Is it OK for the app to hold a Notion key, or is a plain link to the Notion page enough?
      (Right now it is a plain link.)

## Who does what

### Google Cloud setup (Shannon, or an admin if her account is blocked)
- [x] Sign in at console.cloud.google.com with the @carrara.is account and create a
      Google Cloud project for Rock Report.
- [x] In **Google Auth Platform**, fill in **Branding** (app name, support email), then
      open **Audience** and choose **Internal**. This is the key step: Google itself then
      refuses anyone outside Carrara. (A project that is not under Carrara's Workspace
      shows "External" instead, which allows anyone with a Google account, so check this.)
- [x] Under **Clients**, create an **OAuth client ID** (type: Web application).
- [x] Add the redirect address Supabase gives us (it looks like
      `https://<project>.supabase.co/auth/v1/callback`).
- [ ] Keep the **client ID** and **client secret** private: password manager only, never
      chat, email or git. If an admin created them, they hand them over the same way.

### Shannon (with Claude)
- [x] Create a private **GitHub** repository and push the code (`tooms71/rock-report`).
- [x] In Supabase: turn on the **Google** sign-in provider and paste in the client ID and
      secret from above.
- [x] In the Supabase SQL editor, run the small **sign-in column** change (the
      "Sign-in with Google" block at the bottom of `supabase/schema.sql`). It is safe to run
      at any time.
- [x] Test signing in locally (see "Testing sign-in" below). Works.
- [x] **Last,** run `supabase/lock-down.sql` in the SQL editor (done; signed-out reads return
      nothing and writes are refused). This locks every table so
      only signed-in @carrara.is people can read or write. Then check that a signed-out
      request is refused.
- [x] Create a **Vercel** account, import the repository, and add the settings below
      (project `rock-report` in the Carrara team).
- [x] Open the live link in a private window and confirm a non-Carrara Google account is
      turned away. Passed.

### Claude builds in the app (done, awaiting testing)
- [x] A "Sign in with Google" screen in front of every page, and a second check that the
      email ends in @carrara.is. Google only. We do not build our own email and password
      login, because that means storing and resetting passwords.
- [x] People join with their Google first name (a last initial is added if two people share
      one) instead of typing a name. Opening the page does not add you to the session; you
      click Join, so people who only look do not block the "everyone has submitted" reveal.
- [x] `supabase/lock-down.sql`: database rules for signed-in Carrara people only.

## Testing sign-in

1. Supabase: Google provider on, client ID and secret pasted in, Site URL
   `http://localhost:3000`, redirect URL `http://localhost:3000/**`.
2. Run the sign-in column SQL (above).
3. Open http://localhost:3000, click **Sign in with Google**, choose the @carrara.is account.
4. Expect: back at the app, "Signed in as you@carrara.is. Sign out", and a session you can
   create or join.
5. Try an outside account (for example a personal Gmail): Google should refuse it. If it
   gets through, the app still shows "isn't a Carrara account", but then check that the
   Google audience is **Internal**.
6. Only then run `supabase/lock-down.sql`, reload, and confirm everything still works while
   signed in.

## Settings that live in Vercel (never in the code)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Secrets stay in Vercel, Supabase and `.env.local`. They never go in chat, email, a
document, or git.

## Still to do

- [x] Turn off the Supabase **Email** provider (only Google is on).
- [x] Try a personal Gmail account to confirm Google refuses it.
- [x] Create a private GitHub repository and push the code.
- [x] Create the Vercel project, add the two settings, and deploy.
- [x] Add the live address to Supabase (Site URL and Redirect URLs), then test signing in
      there. Passed. (Google needed no change: its redirect stays the Supabase callback.)
- [ ] Two-window live-update check on the live site (start writing in one, the other flips).
- [ ] Share the link with the team.

## Live site

https://rock-report.vercel.app/ (Vercel, Carrara team). Every push to `main` on GitHub
redeploys it automatically. Local development still works at http://localhost:3000.

## Keeping it healthy

- Supabase's free tier **pauses after about a week without use**. If the app suddenly says
  it can't reach the database, open the Supabase dashboard and click Restore.
- The GitHub token used to push expires on the date chosen when it was made; create a new
  one the same way (Contents: read and write, only this repository).
- Vercel's free "Hobby" plan is meant for personal projects. If the team uses this
  every week, check whether Carrara has a paid Vercel team plan.

## Order

1. Confirm the decisions above.
2. Admin creates the Google sign-in setup.
3. Claude builds sign-in and database rules; Shannon wires Supabase.
4. Test locally with two Carrara accounts and one outside account.
5. Push to GitHub, deploy on Vercel, add the settings.
6. Test the live link, then share it.

Do not share the deployed link with the team before step 4 passes.

## Questions to ask the helper

- Can the Google sign-in be restricted to our organization (Internal), or do we need a
  domain check only?
- Does Carrara have a standard place for storing shared secrets?
- Should the Vercel project live under a company account instead of a personal one, so it
  does not disappear if one person leaves?
- Who should be notified if the Supabase project pauses? (The free tier pauses after about
  a week of no use and must be restored from the dashboard.)

## Your open roles inside the writing form (built)

When someone opens the writing screen they see their own open roles from Notion, with four
buttons per role: On track, Stalled, Offer extended, Offer accepted. The buttons feed the
agenda: Offer extended goes under Offers extended, Offer accepted under Offers accepted, and
Stalled is added to the Hive mind list. Nothing is written back to Notion; the app keeps its
own weekly record in the `role_updates` table (`supabase/add-role-updates.sql`, run once).

How it works: `/api/my-roles` verifies the Supabase sign-in and the @carrara.is email, looks
the person up in the Notion **Team Directory** by Google email, and returns the Open Roles
(Status = Open) whose **Talent Partner** is that person.

**To turn it on in each place the app runs** (the key is never committed):

- Local: `NOTION_TOKEN` in `.env.local`.
- Live: Vercel, Project Settings, Environment Variables, add `NOTION_TOKEN`, then redeploy.
  Until it is set the roles section simply stays hidden.
- The Notion connection needs read access only, and must be shared with the Open Roles and
  Team Directory databases.

**Data to keep tidy in Notion:** everyone needs their Carrara email in the Team Directory, and
every open role needs a Talent Partner, or it shows up for nobody. People missing from the
directory see a short "couldn't find you" note and cannot report offers.
