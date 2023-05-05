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
npm i -g pm2
pm2 start
# might error when trying to create the data dir, that's a bug right now, just run it again
```

If your Ethereum RPC node is behind a reverse proxy with Authorization
requirements, consider adding the `@attestate/crawler` `RPC_API_KEY`
environment variable
([details](https://attestate.com/crawler/main/configuration.html#environment-variables)).

## node operators

Since https://news.kiwistand.com is now running live as a p2p node, you're
invited to run your own nodes and frontends. However, please consider to join a
chat like the [attestate dev chat](https://t.me/attestate) to stay in touch for
eventual upgrade announcements as the protocol is far from being complete.

## Roadmap

Here is the [Roadmap file](https://hackmd.io/GtcGsKrlS_-vIFjhxQVw8w) we try to
keep updated weekly. If not message @timdaub (e.g. on Telegram).

## license

GPL-3.0-only, see LICENSE file
