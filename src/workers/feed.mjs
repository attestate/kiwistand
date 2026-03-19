import feed from "../views/feed.mjs";
import theme from "../theme.mjs";

export default async function ({ page, domain, variant }) {
  return await feed(null, theme, page || 0, domain || null, undefined, undefined, variant);
}
