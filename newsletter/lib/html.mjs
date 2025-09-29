export function extractBody(html = "") {
  if (typeof html !== "string" || html.length === 0) return html;

  const bodyOpen = html.search(/<body\b[^>]*>/i);
  if (bodyOpen === -1) return html;

  const afterOpenTag = html.indexOf(">", bodyOpen) + 1;
  if (afterOpenTag === 0) return html;

  const bodyClose = html.indexOf("</body>", afterOpenTag);
  if (bodyClose === -1) return html;

  const inner = html.slice(afterOpenTag, bodyClose).trim();
  if (inner.length > 0) return inner;

  // No <body> wrapper detected; return as-is
  return html;
}

