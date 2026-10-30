// Turns the plain-text meeting notes (see summary.ts) into Slack's own formatting. The post
// is two messages: a short code-styled title, then the notes as a reply in its thread, so
// the channel stays tidy. Slack markup characters in people's text are escaped.
const escapeSlack = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function notesToSlack(notes: string, link?: string): { title: string; body: string } {
  const [titleBlock, ...sections] = escapeSlack(notes).split("\n\n");
  const body = sections.map((block) => {
    const [heading, ...lines] = block.split("\n");
    return [`*${heading}*`, ...lines.map((line) => line.replace(/^- /, "• "))].join("\n");
  });
  if (link) body.push(`<${link}|Open the full notes in Rock Report>`);
  return { title: `\`${titleBlock.replace(/`/g, "'")}\``, body: body.join("\n\n") };
}
