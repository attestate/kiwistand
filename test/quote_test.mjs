import test from "ava";

import { splitQuote } from "../src/quote.mjs";

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
