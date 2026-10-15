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
- [ ] Can Shannon's @carrara.is account create a Google Cloud project on its own? (Often
      yes. A colleague who has done this says to sign in at console.cloud.google.com with
      the @carrara.is account and try. If it is blocked, ask whoever administers Carrara's
      Google Workspace / Google Cloud.)
- [ ] Who administers Carrara's **Notion** (only needed for the optional open-roles table)?
- [ ] Is it OK for the app to hold a Notion key, or is a plain link to the Notion page enough?
      (Right now it is a plain link.)

## Who does what

### Google Cloud setup (Shannon, or an admin if her account is blocked)
- [ ] Sign in at console.cloud.google.com with the @carrara.is account and create a
      Google Cloud project for Rock Report.
- [ ] In **Google Auth Platform**, fill in **Branding** (app name, support email), then
      open **Audience** and choose **Internal**. This is the key step: Google itself then
      refuses anyone outside Carrara. (A project that is not under Carrara's Workspace
      shows "External" instead, which allows anyone with a Google account, so check this.)
- [ ] Under **Clients**, create an **OAuth client ID** (type: Web application).
- [ ] Add the redirect address Supabase gives us (it looks like
      `https://<project>.supabase.co/auth/v1/callback`).
- [ ] Keep the **client ID** and **client secret** private: password manager only, never
      chat, email or git. If an admin created them, they hand them over the same way.

### Shannon (with Claude)
- [ ] Create a private **GitHub** repository and push the code. (There is none yet.)
- [ ] In Supabase: turn on the **Google** sign-in provider and paste in the client ID and
      secret from above.
- [ ] In the Supabase SQL editor, run the small **sign-in column** change (the
      "Sign-in with Google" block at the bottom of `supabase/schema.sql`). It is safe to run
      at any time.
- [ ] Test signing in locally (see "Testing sign-in" below).
- [ ] **Last,** run `supabase/lock-down.sql` in the SQL editor. This locks every table so
      only signed-in @carrara.is people can read or write. Then check that a signed-out
      request is refused.
- [ ] Create a **Vercel** account, import the repository, and add the settings below.
- [ ] Open the live link in a private window and confirm a non-Carrara Google account is
      turned away.

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

## Order

1. Confirm the decisions above.
2. Admin creates the Google sign-in setup.
3. Claude builds sign-in and database rules; Shannon wires Supabase.
4. Test locally with two Carrara accounts and one outside account.
5. Push to GitHub, deploy on Vercel, add the settings.
6. Test the live link, then share it.

Do not share the deployed link with the team before step 4 passes.

## Optional: the Notion open-roles table

The reveal page links to the Notion roles view today. To show the roles inside the app
instead, a Notion admin needs to create an **internal connection** ("API token"), share the
Open Roles and Talent Partner databases with it, and hand the secret to Shannon. A
personal access token also works for demos but carries all of the creator's Notion
access, so use it only on a laptop. The earlier version of this feature is in git
history at commit `aa20353`.

## Questions to ask the helper

- Can the Google sign-in be restricted to our organization (Internal), or do we need a
  domain check only?
- Does Carrara have a standard place for storing shared secrets?
- Should the Vercel project live under a company account instead of a personal one, so it
  does not disappear if one person leaves?
- Who should be notified if the Supabase project pauses? (The free tier pauses after about
  a week of no use and must be restored from the dashboard.)
