import test from "ava";

import { isModerated } from "../src/views/moderation.mjs";

const config = {
  titles: {},
  hrefs: {},
  addresses: ["0xbanned"],
  links: ["https://banned.example/post"],
  labels: {},
};

test("isModerated hides banned submitters and banned links", (t) => {
  t.true(
    isModerated({ href: "https://ok.example/a", identity: "0xBANNED" }, config),
  );
  t.true(
    isModerated(
      { href: "https://www.banned.example/post/", identity: "0xok" },
      config,
    ),
  );
  t.false(isModerated({ href: "https://ok.example/a", identity: "0xok" }, config));
});

test("isModerated matches text posts as-is", (t) => {
  const href = "data:text/plain,hello";
  const banned = { ...config, links: [href] };
  t.true(isModerated({ href, identity: "0xok" }, banned));
  t.false(isModerated({ href, identity: "0xok" }, config));
});
