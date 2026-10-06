// @format
import test from "ava";

import { isGenericImage } from "../src/parser.mjs";

test("a tweet's author avatar is not a preview image", (t) => {
  t.true(
    isGenericImage(
      "https://pbs.twimg.com/profile_images/2008885383287758848/pHulV4GI_400x400.jpg",
    ),
  );
});

test("a tweet's attached media is a preview image", (t) => {
  t.false(isGenericImage("https://pbs.twimg.com/media/GxYz123AbC.jpg"));
});
