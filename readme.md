# attestate/kiwistand

[![Node.js CI](https://github.com/attestate/replica/actions/workflows/node.js.yml/badge.svg)](https://github.com/attestate/replica/actions/workflows/node.js.yml)

### kiwistand is a p2p node client for a web3 writer friendly Hacker News that nobody controls but everybody co-owns

## installation

It is required to have installed:

- node >= v16

```bash
git clone git@github.com:attestate/kiwistand.git
cp .env-copy .env
npm run dev
```

## Roadmap

- [ ] Send proof along with sending leaves and understand what qualities
  proving roots brings.
- [x] For each new root, gossip it to the network to encourage synchronization
  - [x] But only gossip periodically and not upon every receival of a new
    message (as this is what the gossipsub topics are for)
- [ ] Consider just exposing one RPC endpoint for submitting messages instead
  of having one endpoint for accepting leaves and another for user-facing
  applications.
- [ ] For gossip-received messages, reject them if they're too old
- [ ] Make the "Submit Story" button only visible in debug mode
- [ ] Find better approach for frontend and potentially separate it from node
  software

## license

GPL-3.0-only, see LICENSE file
