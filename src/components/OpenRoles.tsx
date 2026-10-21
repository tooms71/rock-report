// Where every open role lives. The reveal is the one time the whole team looks at the
// list together, so the link sits at the bottom of that page. The Notion page itself
// needs a Carrara login, so the link is safe to show.
const OPEN_ROLES_URL =
  "https://app.notion.com/p/carrara/28c6b1a6e6e780a987bff0430f8bf140?v=28c6b1a6e6e780bba6ad000cecb11b94";

export function OpenRoles() {
  return (
    <a
      href={OPEN_ROLES_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-ardesia underline decoration-grafite/40 underline-offset-4 transition hover:text-ember-ink hover:decoration-ember-ink dark:text-marmol dark:decoration-white/40"
    >
      See every open role in Notion
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
