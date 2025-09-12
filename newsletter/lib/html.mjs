export function extractBody(html = "") {
  if (typeof html !== "string" || html.length === 0) return html;

  const bodyOpen = html.search(/<body\b[^>]*>/i);
  const bodyClose = html.search(/<\/body>/i);

  if (bodyOpen !== -1 && bodyClose !== -1 && bodyClose > bodyOpen) {
    const afterOpenTag = html.indexOf(">", bodyOpen) + 1;
    if (afterOpenTag > 0) {
      const inner = html.slice(afterOpenTag, bodyClose).trim();
      if (inner.length > 0) return inner;
    }
  }

  // No <body> wrapper detected; return as-is
  return html;
}

