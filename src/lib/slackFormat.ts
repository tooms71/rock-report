// Turns the plain-text meeting notes (see summary.ts) into Slack's own formatting: bold
// section titles, real bullets, and the characters Slack treats as markup escaped.
const escapeSlack = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function notesToSlack(notes: string, link?: string): string {
  const blocks = escapeSlack(notes)
    .split("\n\n")
    .map((block) => {
      const [heading, ...lines] = block.split("\n");
      const body = lines.map((line) =>
        line.replace(/^ {2}- /, "      ◦ ").replace(/^- /, "• ")
      );
      return [`*${heading}*`, ...body].join("\n");
    });
  if (link) blocks.push(`<${link}|Open the full notes in Rock Report>`);
  return blocks.join("\n\n");
}
