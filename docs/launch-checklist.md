# Rock Report: launch checklist

Goal: put Rock Report online so the Carrara team can use it from their own laptops, and
make sure only people with a Carrara Google account can get in.

Today the app only runs on Shannon's laptop. It has no login, and its database accepts
anyone who has the key that ships inside the page. That is fine locally. It is not fine
for a link the team opens, because updates include client names and hiring details.

## Decisions to confirm first

- [x] Does Carrara use **Google Workspace** for email? Yes (confirmed), so the sign-in
      plan below stands.
- [ ] Who administers Carrara's **Google Workspace / Google Cloud**?
- [ ] Who administers Carrara's **Notion** (only needed for the optional open-roles table)?
- [ ] Is it OK for the app to hold a Notion key, or is a plain link to the Notion page enough?
      (Right now it is a plain link.)

## Who does what

### Someone with Google Cloud / Workspace admin access
- [ ] Create a Google Cloud project for Rock Report.
- [ ] Set up the **OAuth consent screen** with user type **Internal**. This is the key
      step: Google itself then refuses anyone outside Carrara.
- [ ] Create an **OAuth client ID** (type: Web application).
- [ ] Add the redirect address Supabase gives us (it looks like
      `https://<project>.supabase.co/auth/v1/callback`).
- [ ] Hand the **client ID** and **client secret** to Shannon through a secure channel
      (a password manager, not chat or email).

### Shannon (with Claude)
- [ ] Create a private **GitHub** repository and push the code. (There is none yet.)
- [ ] In Supabase: turn on the **Google** sign-in provider and paste in the client ID and
      secret from above.
- [ ] Run the database change that **locks the tables** so only signed-in people can read or
      write (Claude prepares this SQL; Shannon runs it in the Supabase SQL editor).
- [ ] Create a **Vercel** account, import the repository, and add the settings below.
- [ ] Open the live link in a private window and confirm a non-Carrara Google account is
      turned away.

### Claude builds in the app
- [ ] A "Sign in with Google" screen, and a second check that the email ends in the
      Carrara domain.
- [ ] People join with their Google name instead of typing one.
- [ ] Database rules tying every read and write to the signed-in person.

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
