import { generateDigestData } from '../src/digest.mjs';
import 'dotenv/config';
import * as store from '../src/store.mjs';
import * as cache from '../src/cache.mjs';
import * as registry from '../src/chainstate/registry.mjs';
import log from '../src/logger.mjs';

(async () => {
  try {
    const trie = await store.create();

    cache.initializeLtCache();

    const from = null;
    const amount = null;
    const startDatetime = null;
    const parser = JSON.parse;
    const accounts = await registry.accounts();
    const delegations = await registry.delegations();
    const href = null;

    let upvotes = [], comments = [];
    await Promise.allSettled([
        store.posts(
            trie, from, amount, parser, startDatetime, accounts, delegations, href, "amplify"
        ).then(result => upvotes = result).catch(err => log("Error fetching upvotes:", err)),
        store.posts(
            trie, from, amount, parser, startDatetime, accounts, delegations, href, "comment"
        ).then(result => comments = result).catch(err => log("Error fetching comments:", err))
    ]);

    cache.initialize([...upvotes, ...comments]);
    await store.cache(upvotes, comments)

    await generateDigestData(trie);
    log('Digest data generated successfully.');
    process.exit(0);
  } catch (error) {
    log('Failed to generate digest data:', error);
    process.exit(1);
  }
})();