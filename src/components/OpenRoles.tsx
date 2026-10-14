// Where every open role lives. The reveal is the one time the whole team looks at the
// list together, so the link sits at the bottom of that page. The Notion page itself
// needs a Carrara login, so the link is safe to show.
const OPEN_ROLES_URL =
  "https://app.notion.com/p/carrara/28c6b1a6e6e780a987bff0430f8bf140?v=28c6b1a6e6e780bba6ad000cecb11b94";

export function OpenRoles() {
  return (
    <section aria-labelledby="roles-heading" className="flex flex-col gap-3">
      <h2
        id="roles-heading"
        className="font-heading text-2xl font-bold text-ardesia dark:text-marmol"
      >
        Open roles
      </h2>
      <p className="text-base text-grafite dark:text-marmol/80">
        Every open role, with talent partner, location and job description, is in Notion.
      </p>
      <a
        href={OPEN_ROLES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center self-start rounded-lg border border-grafite/50 px-4 text-sm font-semibold text-ardesia transition hover:border-ember-ink hover:text-ember-ink dark:border-white/40 dark:text-marmol"
      >
        Open the roles list in Notion
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </section>
  );
}
