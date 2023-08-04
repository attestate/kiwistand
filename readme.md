# attestate/kiwistand

[![Node.js CI](https://github.com/attestate/kiwistand/actions/workflows/node.js.yml/badge.svg)](https://github.com/attestate/kiwistand/actions/workflows/node.js.yml)

### kiwistand is a p2p node client for a web3 writer friendly Hacker News that nobody controls but everybody co-owns

## installation

It is required to have installed:

- node >= v16

```bash
git clone git@github.com:attestate/kiwistand.git
cp .env-copy .env
npm i
# and then for the frontend
cd src/web && npm i &&& cd ../..
npm run dev:anon
# might error when trying to create the data dir, that's a bug right now, just run it again
```

If your Ethereum RPC node is behind a reverse proxy with Authorization
requirements, consider adding the `@attestate/crawler` `RPC_API_KEY`
environment variable
([details](https://attestate.com/crawler/main/configuration.html#environment-variables)).

It's highly-likely that you'll need either a paid Alchemy account to make the
node work as it is downloading a lot of block data, or you'll have to
rate-limit the speed at which the node tries to download event logs. Please
reach out to us if you don't have access to an Alchemy account and we'll figure
something out!

## debugging

Once you're up and running, you might want to submit new links to the network.
However, we encourage you to NOT do that on the main net. Instead, if you must
test submitting new links then run the node in bootstrap mode (no mainnet data)
or in the "anon:local" mode that doesn't send data to the p2p network.

```
npm run dev:bootstrap

# or

npm run dev:anon:local
```

## docs

We document the code base in Sphinx, see ./docs. We host the documentation at
[attestate.com/kiwistand/main](https://attestate.com/kiwistand/main/).
Generally speaking, the code base isn't well documented at this point. Please
don't be discouraged by that. We work as a tightly-knit team and so asking
others for help is highly encouraged when you work on code. We're more than
happy to get your stuff merged without much gate-keeping - please just reach
out and we'll get you started.

## tech stack details

- [Youtube: Kiwistand - a decentralized Hacker News | Tim Daubenschütz (4mins)](https://www.youtube.com/watch?v=WujtU15yAyk)
- [Loom: Set Reconciliation demo (40 secs)](https://www.loom.com/share/abf43323b00547689bf11520f565f4bc)
- [Loom: Set Reconciliation algorithm explained (9mins)](https://www.loom.com/share/2a68f5e22d9843ab99edad2deaed9281)
- [Loom: How to get started editing the Kiwi News frontend](https://www.loom.com/share/e0e8866450d54c52b161e77907d1ccb9)

## node operators

Since https://news.kiwistand.com is now running live as a p2p node, you're
invited to run your own nodes and frontends. However, please consider to join a
chat like the [attestate dev chat](https://t.me/attestate) to stay in touch for
eventual upgrade announcements as the protocol is far from being complete.

## changelog

See changelog.md file.

## license

GPL-3.0-only, see LICENSE file
