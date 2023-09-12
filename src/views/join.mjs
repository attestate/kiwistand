//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as ens from "../ens.mjs";

async function getENSAvatars(addresses) {
  const avatarData = [];

  for (const address of addresses) {
    const ensData = await ens.resolve(address);
    let avatarUrl = ensData.avatar;
    if (avatarUrl && !avatarUrl.startsWith("https")) {
      avatarUrl = ensData.avatar_url;
    }

    avatarData.push({
      address,
      avatarUrl,
    });
  }

  return avatarData;
}

const addresses = [
  "dwr.eth",
  "fredwilson.eth",
  "pedrouid.eth",
  "levy.eth",
  "ccarella.eth",
  "pugson.eth",
]; // Replace with the actual Ethereum addresses
const avatarData = await getENSAvatars(addresses);

const html = htm.bind(vhtml);

export default function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
        <style>
          .flex-container {
            display: flex;
            align-items: flex-start; /* Align the top edges of the child elements */
          }

          .text-left,
          .text-right {
            width: 50%;
            flex: 0 0 50%; /* This ensures the flex items don't grow or shrink, and take up 50% of the width */
          }

          .image {
            margin: 0 15px;
            width: 100%;
          }

          .circular-image {
            border-radius: 50%;
          }

          .avatar-container {
            text-align: center;
            margin: 10px;
          }

          .avatar-row {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
          }

          .parent-container {
            width: 100%; /* or any specific width you want */
          }

          .full-width-container {
            width: 100%;
          }

          /* Mobile styles */
          @media (max-width: 768px) {
            .flex-container {
              flex-direction: column;
            }

            .avatar-row {
              flex-direction: row;
              flex-wrap: wrap;
              justify-content: space-around;
            }

            .avatar-container {
              flex: 0 0 auto;
              width: 50px;
              margin: 30px;
            }

            .text-right button {
              text-align: center;
              margin-left: auto;
              margin-right: auto;
              display: block;
            }

            .flex-image-left .image,
            .flex-image-right .image,
            .text-left,
            .text-right {
              text-align: center; /* Aligns text and buttons to the center */
              margin: 15px 0;
              width: 100%; /* Set width to 100% on smaller screens */
            }

            .flex-image-left .image,
            .flex-image-right .image {
              order: 0; /* Place the image first */
            }

            .flex-image-left .text-right,
            .flex-image-right .text-left {
              order: 1; /* Place the text after the image */
            }
          }

          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
          }
          .inner-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .header h1 {
            font-size: 1.5rem;
            margin-bottom: 10px;
          }
          .image-and-text {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            align-items: stretch;
          }
          .image-container,
          .text-container {
            flex: 1;
            width: 100%;
          }

          @media (min-width: 768px) {
            .image-container,
            .text-container {
              padding: 0 20px 20px 20px;
            }
            .text-content {
              font-size: 1rem;
            }
          }
          .text-content {
            display: flex;
            flex-direction: column;
            width: 100%;
            font-size: 1rem;
          }
          .text-row {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #000;
            padding: 15px 5px 15px 5px;
          }
          .text-content button {
            width: 100%;
            margin-top: 15px;
          }
          .kiwi-nft {
            max-width: 100%;
            height: auto;
            border-radius: 3px;
          }
          .image-meta {
            font-size: 0.9rem;
            margin-top: 5px;
            text-align: center;
          }
          .selling-points {
            font-size: 0.9rem;
            margin-bottom: 20px;
          }
          .list-unstyled {
            list-style-type: none;
            padding: 10px;
          }
          .bullet-point {
            margin-bottom: 10px;
            padding-right: 10px;
          }
          .bullet-point strong {
            color: ${theme.color};
          }
          .buy-button {
            background-color: black;
            border: none;
            color: white;
            padding: 10px 20px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 0.9rem;
            cursor: pointer;
            border-radius: 3px;
            font-family: "Helvetica", "Arial", sans-serif;
          }

          .buy-button:disabled {
            background-color: grey;
            cursor: not-allowed;
          }

          @media screen and (max-width: 768px) {
            .image-and-text {
              flex-direction: column;
            }
            .list-unstyled {
              padding: 0 10px 0 10px;
            }
          }
        </style>
        <meta property="eth:nft:collection" content="Kiwi News Mint Pass" />
        <meta
          property="eth:nft:contract_address"
          content="0xebb15487787cbf8ae2ffe1a6cca5a50e63003786"
        />
        <meta
          property="eth:nft:creator_address"
          content="0xee324c588cef1bf1c1360883e4318834af66366d"
        />
        <meta property="eth:nft:schema" content="erc721" />
        <meta
          property="eth:nft:media_url"
          content="https://news.kiwistand.com/animation.gif"
        />
        <meta property="eth:nft:mint_status" content="live" />
        <meta property="eth:nft:chain" content="ethereum" />
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${Header(theme)}
              </tr>
              <tr>
                <td style="padding: 1rem; color: black;">
                  <div class="parent-container">
                    <div class="flex-container flex-image-right">
                      <div class="text-left">
                        <h1>
                          Handpicked, noise-free content for crypto builders.
                        </h1>
                        <h3>
                          Kiwi News is a community-curated media where crypto
                          veterans pick & upvote web3-related stories for
                          reading, listening, and watching.
                        </h3>
                        <a href="#mint-dialogue">
                          <button
                            id="button-onboarding"
                            style="margin-right: 0;"
                          >
                            Join the community by minting Kiwi NFT
                          </button>
                        </a>
                      </div>
                      <div class="image-right">
                        <img src="LP_links.png" />
                      </div>
                    </div>
                    <div class="full-width-container">
                      <p>Already minted by:</p>
                      <div class="avatar-row">
                        ${avatarData.map(
                          (data) => html`
                            <div class="avatar-container">
                              <img
                                class="circular-image"
                                src="${data.avatarUrl}"
                                alt="${data.address}"
                                style="width: 35px; height: 35px;"
                              />
                              <div style="font-size: 12px;">
                                ${data.address}
                              </div>
                            </div>
                          `,
                        )}
                        <div>
                          <a
                            style="text-decoration: underline;"
                            href="/community"
                            target="_blank"
                          >
                            & 150+ more
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <br />
                  <br />
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-left">
                    <div class="image-left">
                      <img src="LP_sources.png" alt="Kiwi Submit" />
                    </div>
                    <div class="text-right">
                      <h2>All content in one place</h2>
                      <p>
                        Our community reads hundreds of sources per month. Some
                        of them are big news and mainstream Vitalik essays. But
                        some of them are fresh, niche essays found at the edges
                        of the Internet. 
                        <br />
                        <br />
                        So you don't need to scroll Twitter for hours, hoping
                        you'd find some valuable content. If it really matters,
                        you can find it on Kiwi.
                      </p>
                      <a style="display: block;" href="/submit" target="_blank">
                        <button
                          class="button-secondary"
                          id="button-onboarding"
                          style="margin-right: 0;"
                        >
                          Check our feed
                        </button>
                      </a>
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>Truly interdisciplinary perspective</h2>
                      <p>
                        “Kiwi is a feed for the builder’s mind” as Les Greys
                        once said.
                        <br />
                        <br />
                        So we cover all crypto-adjacent subjects that a smart
                        curious engineer might find interesting - from tech,
                        through economics, game theory, and sociology, up to
                        culture and growth.
                      </p>
                      <a href="/guidelines" target="_blank">
                        <button
                          class="button-secondary"
                          id="button-onboarding"
                          style="margin-left: 0; width: 40%;"
                        >
                          Read our content guidelines
                        </button>
                      </a>
                    </div>
                    <div class="image-right">
                      <img src="LP_inter.png" />
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-left">
                    <div class="image-left">
                      <img src="LP_community.png" alt="Kiwi signless" />
                    </div>
                    <div class="text-right">
                      <h2>Positive-sum games community</h2>
                      <p>
                        We are people building the decentralized future -
                        primarily web3 founders, developers, and creators.
                        <br />
                        <br />
                        We believe in a constructive dialogue and co-creation -
                        whether it’s doing a Pull Request to a project we like
                        or sharing an honest feedback with its founder.
                      </p>
                      <a
                        href="https://warpcast.com/~/channel/kiwi-news"
                        target="_blank"
                      >
                        <button
                          class="button-secondary"
                          id="button-onboarding"
                          style="color: #7c65c1; border: 1px solid #7c65c1; margin-right: 0;"
                        >
                          Check our channel on Farcaster!
                        </button>
                      </a>
                    </div>
                  </div>

                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>Decentralized & Open Source from Day 1</h2>
                      <p>
                        Kiwi has been built on a Kiwi P2P Protocol. It means
                        that everyone can run a node and permissionlessly create
                        their own Kiwi app.
                        <br />
                        <br />
                        We already seen that happening with freeatnet’s
                        <span> </span>
                        <a
                          style="text-decoration: underline; "
                          href="https://kiwinews.lol"
                          target="_blank"
                        >
                          kiwinews.lol
                        </a>
                        <span> and matallo's </span>
                        <a
                          style="text-decoration: underline; "
                          href="https://kiwinews.phyles.app/search"
                          target="_blank"
                        >
                          Kiwi Search
                        </a>
                        <span> </span>
                        We also share parts of our treasury to the most active
                        contributors - in the last round we distributed over 3.5
                        ETH.
                      </p>
                      <a
                        href="https://github.com/attestate/kiwistand"
                        target="_blank"
                      >
                        <button
                          class="button-secondary"
                          id="button-onboarding"
                          style="margin-left: 0;"
                        >
                          Check our GitHub
                        </button>
                      </a>
                    </div>
                    <div class="image-right">
                      <img src="LP_Decentralized.png" alt="Kiwi Upvote" />
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  <br />
                  <section>
                    <h2
                      id="mint-dialogue"
                      style="text-align: center; margin-bottom: 1rem;"
                    >
                      Mint our NFT to join the Kiwi curators!
                    </h2>
                    <div class="image-and-text">
                      <div class="image-container">
                        <img
                          src="animation.gif"
                          alt="Kiwi News NFT"
                          class="kiwi-nft"
                        />
                      </div>
                      <div
                        class="text-container"
                        style="display: flex; flex-direction: column; justify-content:end;"
                      >
                        <div class="text-content">
                          <div class="text-row">
                            <div>1 NFT</div>
                            <div>
                              <nft-price />
                              <span> ETH</span>
                            </div>
                          </div>
                          <div class="text-row">
                            <div><b>ZORA</b> mint fee</div>
                            <div>0.000777 ETH</div>
                          </div>
                          <div class="text-row">
                            <div>Total</div>
                            <div>
                              <nft-price data-fee="0.000777" />
                              <span> ETH</span>
                            </div>
                          </div>
                          <div id="buy-button-container">
                            <button class="buy-button" disabled>
                              Loading...
                            </button>
                          </div>
                        </div>
                        <br />
                        <span style="margin-top: 5px;"
                          >Want to buy another NFT to support us? Buy it
                          directly on
                          <span> </span>
                          <u
                            ><a
                              target="_blank"
                              href="https://zora.co/collect/eth:0xebb15487787cbf8ae2ffe1a6cca5a50e63003786"
                              >ZORA.co</a
                            ></u
                          ></span
                        >
                      </div>
                    </div>
                  </section>
                  <div
                    style="display: flex; flex-direction: column; align-items: center;"
                  >
                    <h2 style="margin-bottom: 1rem;">
                      What people say about Kiwi:
                    </h2>
                    <div class="image" style="margin-bottom: 1rem;">
                      <img src="LP_referrals.png" alt="Kiwi Referrals" />
                    </div>
                  </div>
                  <br />
                  <div style="max-width: 70%; margin: auto;">
                    <h2 style="text-align: center;">FAQ</h2>
                    <b>Why Kiwi?</b>
                    <p>
                      It's a long story that started with a meme on Farcaster.
                      You can learn more about it on
                      <span> </span>
                      <u
                        ><a href="https://howtoeat.kiwi" target="_blank"
                          >howtoeat.kiwi</a
                        ></u
                      >
                      <span> </span>
                      and mint a free Kiwi NFT.
                    </p>

                    <b>Who is picking these links?</b>
                    <p>
                      We are a community of 140+ crypto-savvy people who submit
                      and upvote links to create a newsfeed we all want to use.
                      You can learn more about the community here.
                    </p>

                    <b>Why do you build this?</b>
                    <p>
                      We want to create a space where crypto content can thrive.
                      Where creators can reach new audiences and readers can
                      find inspiring texts, podcasts and videos. You can read
                      more about our vision here.
                    </p>

                    <b>What is your current roadmap?</b>

                    <p>
                      We are working to make the web app experience more
                      seamless. We also plan to ship the mobile app. You can
                      read more about our plans here.
                    </p>

                    <b>Where can I share my feature requests?</b>
                    <p>
                      If you’re our NFT holder, you can reach out to @timdaub or
                      @macbudkowski to get added to the holders-only Telegram
                      Chat. If you don’t hold our NFT, you can always add your
                      requests here.
                    </p>
                  </div>
                  <br />
                  <br />
                  <a
                    href="#mint-dialogue"
                    style="margin-bottom: 1rem; display: flex; justify-content: center;"
                  >
                    <button id="button-onboarding">
                      Join the community by minting Kiwi NFT
                    </button>
                  </a>
                  <br />
                  <br />
                  <br />
                  <h2 style="text-align: center;">Note from founders</h2>
                  <p style="max-width: 70%; margin: auto;">
                    We know how it all started. Satoshi created Bitcoin because
                    people were being screwed by the financial system. And the
                    Bitcoin community wanted to create a more fair financial
                    system where people - not the FED - are in power. It seemed
                    like a crazy idea back then.
                    <br />
                    <br />
                    Few people believed it, many ridiculed it. But thanks to
                    those who had enough intellectual courage to rethink the
                    world they live in, the world has changed. Years have gone
                    by and in the meantime, crypto helped to make many people
                    rich. Big money brought many scammers and the last few years
                    were dominated by exploits, stolen money, and scams.
                    <br />
                    <br />
                    But as we started learning more about tokens, some people
                    also learned that crypto might be a tool to create a fairer
                    version of many other areas of our life. We could rethink
                    not only finance but also art markets, gaming, and social
                    media. But just like Bitcoin's creators, these crypto-native
                    entrepreneurs are ridiculed too. And it's a fair point:
                    rebuilding whole industries is hard and unlikely to succeed.
                    <br />
                    <br />To have any chance of succeeding, we need a space
                    where builders can exchange their ideas. A place where
                    thoughts can clash: from game theory and economics, through
                    psychology and arts up to governance and tech. But this
                    content is hard to find. Distribution is centralized among a
                    few big Twitter accounts and newsletters.
                    <br />
                    <br />
                    And although we can find many great ideas in those
                    centralized communities, the freshest insights can usually
                    be found at the edges, among people who are less popular
                    since they spend their days doing research and coding - not
                    dedicating every minute to grow their audience. So the idea
                    behind Kiwi is to go back to the roots. Promote content
                    close to the crypto values that make us rethink the world we
                    live in. And create an arena where this content can compete
                    and the best ideas can win.
                    <br />
                    <br />In web2, we once had a tool for that. But as years
                    went by HackerNews transformed into a pessimistic and
                    progress-skeptical space. So we want to rebuild it from
                    scratch. Just like Uniswap rethought Coinbase and Farcaster
                    rethinks Twitter, Kiwi rethinks HackerNews and content
                    distribution in general. We believe you shouldn’t doom
                    scroll Twitter for 3 hours to find good content.
                    <br />
                    <br />You should be able stumble upon content
                    serendipitously, without bringing your dopamine levels out
                    of balance. That’s why it's time to rethink news aggregation
                    from the ground up.
                    <br />
                    <br />

                    Not by building yet another app: But by giving our users the
                    freedom to access the same content across different clients
                    and by allowing everyone to choose their moderation rules.
                    By building Kiwi primarily as a protocol, and then as an
                    app, we're enabling anyone to fork us, hence bootstrapping
                    credible neutrality.
                    <br />
                    <br />Because as David Hoffman says: “Crypto wasn’t made to
                    make you rich. Crypto was to set you free”.
                    <br />
                    <br />
                    Tim Daubenschütz & Mac Budkowski
                  </p>

                  <br />
                  <br />
                  <br />
                  <br />

                  <br />
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
}
