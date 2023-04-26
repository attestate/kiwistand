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

- [ ] Send proof along with sending leaves and understand what qualities
  proving roots brings.
- [x] For each new root, gossip it to the network to encourage synchronization
  - [x] But only gossip periodically and not upon every receival of a new
    message (as this is what the gossipsub topics are for)
- [ ] Consider just exposing one RPC endpoint for submitting messages instead
  of having one endpoint for accepting leaves and another for user-facing
  applications.
- [x] Sanitize endpoints that ingest data and make sure they are resilient.
- [x] For gossip-received messages, reject them when they're too far in the
  future.
- [ ] Add "key delegation" message
- [x] Consider that users can currently amplify a story twice and find a
  solution
- [x] Make the "Submit Story" button only visible in debug mode
- [x] Find better approach for frontend
- [ ] Separate frontend from node
- [x] Send leave messages through pagination.
- [ ] Add basic documentation
- [x] Implement an on-chain allow list tracker

## license

GPL-3.0-only, see LICENSE file
