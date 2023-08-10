# Kiwistand

![Node.js badge](https://github.com/attestate/kiwistand/actions/workflows/node.js.yml/badge.svg)

Kiwistand is a P2P node client for a web3-friendly Hacker News that nobody controls but everybody co-owns.

It stores links and upvotes on the protocol level. Thanks to that, users can create their own UIs and permissionlessly create apps on top of it (see: (awesome-kiwi for the list)[https://github.com/attestate/awesome-kiwinews]).


You can learn the story behind the project in this [4 min video by Tim Daubenschutz](https://www.youtube.com/watch?v=WujtU15yAyk).
## Requirements

#### Basic requirements:
- node >= 16
- RPC nodes on Ethereum Mainnet & Optimism

It's highly-likely that you'll need either a paid Alchemy account to make the node work because it is downloading a lot of block data. You might also try rate-limiting the speed at which the node tries to download event logs. 

Please reach out to us if you don't have access to an Alchemy account and we'll figure something out!


## Getting started


```bash
git clone git@github.com:attestate/kiwistand.git
cp .env-copy .env
npm i
# and then for the frontend
cd src/web && npm i && cd ../..
npm run dev:anon
# might error when trying to create the data dir, that's a bug right now, just run it again
```

If your Ethereum RPC node is behind a reverse proxy with Authorization requirements, consider adding the @attestate/crawler RPC_API_KEY environment variable ([details](https://attestate.com/crawler/main/configuration.html#environment-variables)).

You can also watch the video explaining [how to get started editing the Kiwi News frontend](https://www.loom.com/share/e0e8866450d54c52b161e77907d1ccb9).


## Debugging

Once you're up and running, you might want to submit new links to the network. However, we encourage you to NOT do that on the main net. 

Instead, if you must test submitting new links then run the node in bootstrap mode (no mainnet data) or in the "anon:local" mode that doesn't send data to the p2p network.

```bash
npm run dev:bootstrap

# or

npm run dev:anon:local
```

## How does the protocol work

#### Demos:

- [Loom: Set Reconciliation demo (40 secs)](https://www.loom.com/share/abf43323b00547689bf11520f565f4bc)
- [Loom: Set Reconciliation algorithm explained (9 mins)](https://www.loom.com/share/2a68f5e22d9843ab99edad2deaed9281)
## Node operators

Since [https://news.kiwistand.com](https://news.kiwistand.com ) is now running live as a p2p node, you're invited to run your own nodes and frontends. 

However, please consider to join a chat like the [attestate dev chat](https://t.me/attestate) to stay in touch for eventual upgrade announcements as the protocol is far from being complete.


## Changelog

See changelog.md file.



## License

GPL-3.0-only, see LICENSE file

## Getting in Touch

Our Telegram chat:

- [Kiwi Devs Chat](https://t.me/kiwinewsdevs)

