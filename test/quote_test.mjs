import test from "ava";

import {
  splitQuote,
  splitReply,
  isDeletedTweet,
  tweetHandle,
} from "../src/quote.mjs";

test("a quote tweet loses the bare quoted URL and keeps the quote", (t) => {
  const description =
    "Could be what I'm investigating.\n\nhttps://x.com/Ledger_Support/status/2108551100613714002\n\nQuoting Ledger Support (@Ledger_Support) \n\nLedger is investigating.\n\nReach out: https://support.ledger.com/";
  t.deepEqual(splitQuote(description), {
    text: "Could be what I'm investigating.",
    quote: {
      author: "Ledger Support (@Ledger_Support)",
      text: "Ledger is investigating.\n\nReach out: https://support.ledger.com/",
    },
  });
});

test("other links stay, and the quote's own trailing post link goes", (t) => {
  const description =
    "This is insane!\n\nhttps://arkm.com/explorer/entity/usg\nhttps://x.com/lookonchain/status/2107998407206084701\n\nQuoting Lookonchain (@lookonchain) \n\nThe U.S. government continues.\nhttps://x.com/lookonchain/status/2107634269359411368";
  const { text, quote } = splitQuote(description);
  t.is(text, "This is insane!\n\nhttps://arkm.com/explorer/entity/usg");
  t.is(quote.text, "The U.S. government continues.");
});

test("a tweet that isn't a quote is left alone", (t) => {
  const description = "Read this https://x.com/a/status/1";
  t.deepEqual(splitQuote(description), { text: description, quote: null });
});

test("a deleted post is recognized from fxtwitter's text", (t) => {
  t.true(isDeletedTweet({ ogDescription: "Sorry, that post doesn't exist :(" }));
  t.false(isDeletedTweet({ ogDescription: "gm" }));
  t.false(isDeletedTweet(undefined));
});

test("the handle comes from the story title", (t) => {
  t.is(tweetHandle("@DeanEigenmann: Justin Drake calls for bunker mode"), "@DeanEigenmann");
  t.is(tweetHandle("X-Ray: tool to track your Morpho exposure"), null);
});

test("a reply loses fxtwitter's header and the mention X hides", (t) => {
  const description =
    "↩ @RothRottweiler\n@RothRottweiler vulnzero. the scaling laws will have driven cyber capabilities into small, cheap models.";
  t.deepEqual(splitReply(description), {
    replyTo: ["@RothRottweiler"],
    text: "vulnzero. the scaling laws will have driven cyber capabilities into small, cheap models.",
  });
});

test("a reply to several people loses all leading mentions", (t) => {
  const { replyTo, text } = splitReply("↩ @alice @bob_2\n@alice @bob_2 @carol agreed");
  t.deepEqual(replyTo, ["@alice", "@bob_2"]);
  t.is(text, "agreed");
});

test("a reply that is only mentions has no text left", (t) => {
  t.deepEqual(splitReply("↩ @alice\n@alice"), { replyTo: ["@alice"], text: "" });
});

test("a mention inside the text stays", (t) => {
  const { text } = splitReply("↩ @alice\n@alice thanks to @bob for this");
  t.is(text, "thanks to @bob for this");
});

test("a tweet that starts with a mention but isn't a reply is left alone", (t) => {
  const description = "@alice look at this";
  t.deepEqual(splitReply(description), { replyTo: null, text: description });
});

test("a reply that quotes a tweet still splits the quote", (t) => {
  const { replyTo, text } = splitReply(
    "↩ @alice\n@alice see\n\nhttps://x.com/bob/status/1\n\nQuoting Bob (@bob) \n\nhello",
  );
  t.deepEqual(replyTo, ["@alice"]);
  t.deepEqual(splitQuote(text), {
    text: "see",
    quote: { author: "Bob (@bob)", text: "hello" },
  });
});
