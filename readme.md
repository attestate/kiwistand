# rugpulld

[![Node.js CI](https://github.com/rugpullindex/rugpulld/actions/workflows/node.js.yml/badge.svg)](https://github.com/rugpullindex/rugpulld/actions/workflows/node.js.yml)

### rugpulld is a peer2peer network using Ethereum's layer 2 to enable signal and data trading.

## why?

At rugpullindex.com, we want to decentralize our crawler infrastructure. We have, hence, called for building a "[Community Crawler](https://rugpullindex.com/blog/2021-12-19/community-crawler)". rugpulld is a peer2peer network using Ethereum's layer 2 to enable
signal and data trading. It implements a continuously-running data bounty market using libp2p and zksync. The project is under construction.

## installation

It is required to have installed:

- node >= v16

```bash
git clone git@github.com:rugpullindex/rugpulld.git
cp .env-copy .env
npm run dev
```

## setup on Ubuntu

```
apt-get update
sudo apt-get install build-essential
make setup
make run
```

## license

GPL-3.0-only, see LICENSE file
