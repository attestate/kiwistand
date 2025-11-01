import htm from "htm";
import vhtml from "vhtml";

import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Header from "./components/header.mjs";
import Head from "./components/head.mjs";
import * as ens from "../ens.mjs";
import { getSlug } from "../utils.mjs";

const html = htm.bind(vhtml);

// Hardcoded sample comments from the database
const sampleComments = [
  {
    id: "kiwi:0x66b1e4194964a3f23902f701370f866237b67c7a515e4ee8bb84a732d85f7ad42f068353",
    index: "66b1e4194964a3f23902f701370f866237b67c7a515e4ee8bb84a732d85f7ad42f068353",
    identity: "0xC304Eef1023e0b6e644f8ED8f8c629fD0973c52d",
    title: "21. The right to say gm ☕️",
    timestamp: 1722934297,
    submission_id: "kiwi:0x66b1dada49f6355d5edd34a59e22a81d9ab573c10c8ddf3d30640b9bbf072418d3e6777d",
    submission_title: "web3 bill of rights",
    submission_href: "https://github.com/lrettig/web3-bill-of-rights/blob/master/bor.md",
    story_index: "66b1dada49f6355d5edd34a59e22a81d9ab573c10c8ddf3d30640b9bbf072418d3e6777d"
  },
  {
    id: "kiwi:0x67dd21a1654731b49aea04dae9a2c8c58e035f014f96f4f2a6652fa85a806cdbd5cd06fe",
    index: "67dd21a1654731b49aea04dae9a2c8c58e035f014f96f4f2a6652fa85a806cdbd5cd06fe",
    identity: "0x3e6c23CdAa52B1B6621dBb30c367d16ace21F760",
    title: "From this panel:\nhttps://www.youtube.com/live/ZElYvaq0JTQ?si=_a13Oqk4YuLwsLy1&t=6120",
    timestamp: 1742545313,
    submission_id: "kiwi:0x67dd2176c57e402278f039f5c5bf13d4973cd87d941104fef856f2ca1db20068797b0285",
    submission_title: "\"The negativity around Ethereum is very overdone\"",
    submission_href: "https://imagedelivery.net/C5bPuWCkK_P2Rg7LwXEwPQ/c707d049-e32e-4944-b167-26ae5d803000/public",
    story_index: "67dd2176c57e402278f039f5c5bf13d4973cd87d941104fef856f2ca1db20068797b0285"
  },
  {
    id: "kiwi:0x67ed07ca8c158df649ffd46c715528871ef748d0e6adf5dc4f2d418aae32efb3a0044679",
    index: "67ed07ca8c158df649ffd46c715528871ef748d0e6adf5dc4f2d418aae32efb3a0044679",
    identity: "0xee324c588ceF1BF1c1360883E4318834af66366d",
    title: "> @timdaub.eth do you have any website/portfolio of theirs that you could share?\n\nNope, but I can share more details in DMs is there's anyone interested",
    timestamp: 1743587274,
    submission_id: "kiwi:0x67ece85957e57b819923089baa3905eb112b14de957fc1bf9c4ef3759b1906269cae6d73",
    submission_title: "Who's hiring or looking for a job?",
    submission_href: "https://imagedelivery.net/C5bPuWCkK_P2Rg7LwXEwPQ/a489b4a2-ac5d-485a-c0df-97237eee8600/public",
    story_index: "67ece85957e57b819923089baa3905eb112b14de957fc1bf9c4ef3759b1906269cae6d73"
  },
  {
    id: "kiwi:0x6878753b28d9189057d3247b08b8e67c04dfb6719d242f4435068dc69d0b04033aa39a48",
    index: "6878753b28d9189057d3247b08b8e67c04dfb6719d242f4435068dc69d0b04033aa39a48",
    identity: "0xE15BE263BE24B1C4baAa6f678BD4EC3A1CDBA2eE",
    title: "Jesse Pollak\nDonated USDC, received FARCASTER CROWDFUNDS worth $100 at Seedclub Com \n\nView activity on 0xppl",
    timestamp: 1752724795,
    submission_id: "kiwi:0x68787520f5312b9e65f633f41fe946790c95831b19798019b3f3d54273362414304f99c9",
    submission_title: "Sektor perikanan Indonesia ",
    submission_href: "https://imagedelivery.net/C5bPuWCkK_P2Rg7LwXEwPQ/8a1f2d22-9b2e-400c-fa2c-34bc37b69e00/public",
    story_index: "68787520f5312b9e65f633f41fe946790c95831b19798019b3f3d54273362414304f99c9"
  },
  {
    id: "kiwi:0x65ba93382d3cabcc79dfc08200909921debc16ff991aea223598e5c932b4e4e59c49eafa",
    index: "65ba93382d3cabcc79dfc08200909921debc16ff991aea223598e5c932b4e4e59c49eafa",
    identity: "0x3e6c23CdAa52B1B6621dBb30c367d16ace21F760",
    title: "Binance slowly losing its dominance is very good for the industry. Kind of crazy that they did a round trip - from below 40% in Jan 2022, with 60% in Jan 2023, back to 40% in Dec 2023.",
    timestamp: 1706726200,
    submission_id: "kiwi:0x65ba91d8bdd25582adae7029f54f5a065553569b5bd8aa2dd5fd22cdd5b83238faa69012",
    submission_title: "Market share of Centralized Crypto Exchanges, by trading volume",
    submission_href: "https://www.coingecko.com/research/publications/centralized-crypto-exchanges-market-share",
    story_index: "65ba91d8bdd25582adae7029f54f5a065553569b5bd8aa2dd5fd22cdd5b83238faa69012"
  },
  {
    id: "kiwi:0x682c349f92c3ceb436130b221a168f4d2221a012b139c98a77f6e7cdb4a91f5511780ef7",
    index: "682c349f92c3ceb436130b221a168f4d2221a012b139c98a77f6e7cdb4a91f5511780ef7",
    identity: "0xC304Eef1023e0b6e644f8ED8f8c629fD0973c52d",
    title: "they're independent founded, but think they partnered at some point on usdc governance.",
    timestamp: 1747727519,
    submission_id: "kiwi:0x682c0550894a560502bbf8664c7537d74b5f54931495cd6efa8df35998509baae81cbf51",
    submission_title: "Circle in talks to sell as Coinbase and Ripple emerge as top buyers",
    submission_href: "https://watcher.guru/news/circle-in-talks-to-sell-as-coinbase-ripple-emerge-as-top-buyers",
    story_index: "682c0550894a560502bbf8664c7537d74b5f54931495cd6efa8df35998509baae81cbf51"
  },
  {
    id: "kiwi:0x682e3c0b0592ad35e3c08999fe59057c5ec4209bc3a0f1d61c89717d67310d5866f0e4ba",
    index: "682e3c0b0592ad35e3c08999fe59057c5ec4209bc3a0f1d61c89717d67310d5866f0e4ba",
    identity: "0x131CF758d9EF6bcA88928442DC715c8Fdc113952",
    title: "https://app.metri.xyz/p/0x2408d464f2C8025d3A13301b0209A63496182d99",
    timestamp: 1747860491,
    submission_id: "kiwi:0x682e2881c83b5bccdbfa0cca9120d0c206883c7695cf784c6892b79be45321ae3d4963ce",
    submission_title: "Metri trust thread",
    submission_href: "https://imagedelivery.net/C5bPuWCkK_P2Rg7LwXEwPQ/f063cea5-dbd9-4f14-9ed3-8dccdc6db500/public",
    story_index: "682e2881c83b5bccdbfa0cca9120d0c206883c7695cf784c6892b79be45321ae3d4963ce"
  },
  {
    id: "kiwi:0x681c702348846b4b0024182ccb04bc11a8292d430eb59e2a0754658e201927af944b1efb",
    index: "681c702348846b4b0024182ccb04bc11a8292d430eb59e2a0754658e201927af944b1efb",
    identity: "0xee324c588ceF1BF1c1360883E4318834af66366d",
    title: "More context: https://news.kiwistand.com/stories/Clone-from-Dirt-and-Boys-Club?index=0x681c7005f880485f37ca9c492ae4830263a4f95c6312a0a781941cdbc97142918fec5e32",
    timestamp: 1746694179,
    submission_id: "kiwi:0x681bb3ff7f956eac4d642e7231681060431471edcc956bbdf2b5c8eca87fafee38f422f6",
    submission_title: "clone.fyi",
    submission_href: "https://clone.fyi",
    story_index: "681bb3ff7f956eac4d642e7231681060431471edcc956bbdf2b5c8eca87fafee38f422f6"
  },
  {
    id: "kiwi:0x67b838f6762fceee0be5c7ca098d96ab1c52022b64a747738bdf2a10c5d73b90eed08287",
    index: "67b838f6762fceee0be5c7ca098d96ab1c52022b64a747738bdf2a10c5d73b90eed08287",
    identity: "0xee324c588ceF1BF1c1360883E4318834af66366d",
    title: "Btw, I often get the impression here that I say something in this community and I try to say it as the leader. \n\nAnd in my view I communicate this sufficiently clearly. E.g. even with LLMs I now have a counter factual where I can say something and in many cases the LLM actually understands me really well. So this would lead me to believe that it isn't my communication capability that makes me fail to generate alignment. But then somehow I often feel like that comfort or dissent actually trumps my mandate here in the community.\n\nIn my view we have to find greater alignment otherwise we're not going to succeed and this site is going to fail like any other.\n\nI know the crypto space is all sorts of bullshit about decentralization, no censorship, no leader, power and whatever. But I feel like we're going to have to really step up our game in terms of aligning wrt goals etc. because otherwise we're not going to go anywhere.\n\nI see our trajectory as a vector. If I wanna move in a certain direction, and others want to move in different directions, in the crypto space I only have soft power influence. We're peers here, I can't pressure anyone really.\nSo it is extra important that we step into conflict and we find out where our commonalities are. Otherwise we're going nowhere.\nI often get the impression that comfort or passive aggression is the norm instead of alignment: \"I can just do my own thing without communicating that I'm unaligned right now.\" or \"No, you the leader, you are wrong and I'm just going to insist on doing my thing\"\n\nI think this is really bad and should stop. Otherwise we can't scale and we won't be able to monetize this thing here.",
    timestamp: 1740126454,
    submission_id: "kiwi:0x67b8323dfa75f7b3fd0d1a110d12fa283a608ac62e0fdbb210d19d1ffde5dade67d49720",
    submission_title: "Daily discussion thread 2025-02-21",
    submission_href: "https://hackmd.io/QaMCfYaBQqSnwIAOgCDXDA?date=2025-02-21",
    story_index: "67b8323dfa75f7b3fd0d1a110d12fa283a608ac62e0fdbb210d19d1ffde5dade67d49720"
  },
];

// Enrich comments with profile data
async function enrichComments(comments) {
  return await Promise.all(
    comments.map(async (comment) => {
      try {
        const profile = await ens.resolve(comment.identity);
        return {
          ...comment,
          profile: {
            displayName: profile?.ens || profile?.displayName || comment.identity.slice(0, 6) + "...",
            avatar: profile?.safeAvatar || `https://cdn.stamp.fyi/avatar/eth:${comment.identity}?s=144`,
            ens: profile?.ens,
            farcaster: profile?.farcaster,
          }
        };
      } catch (err) {
        return {
          ...comment,
          profile: {
            displayName: comment.identity.slice(0, 6) + "...",
            avatar: `https://cdn.stamp.fyi/avatar/eth:${comment.identity}?s=144`,
          }
        };
      }
    })
  );
}

// Categorize comments by characteristics for better testing
function categorizeComments(comments) {
  const categories = {
    short: [],      // < 100 chars
    medium: [],     // 100-300 chars
    long: [],       // > 300 chars
    withLinks: [],  // Contains URLs
    withQuotes: [], // Contains quoted text
  };
  
  comments.forEach(comment => {
    const textLength = comment.title.length;
    
    if (textLength < 100) categories.short.push(comment);
    else if (textLength <= 300) categories.medium.push(comment);
    else categories.long.push(comment);
    
    if (comment.title.includes('http://') || comment.title.includes('https://')) {
      categories.withLinks.push(comment);
    }
    
    if (comment.title.includes('>')) {
      categories.withQuotes.push(comment);
    }
  });
  
  return categories;
}

export default async function commentDebug(theme) {
  const enrichedComments = await enrichComments(sampleComments);
  const categorized = categorizeComments(enrichedComments);
  
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
        <title>Kiwi News - Comment Preview Debug</title>
        <meta name="robots" content="noindex, nofollow" />
        <style>
          body {
            font-family: Verdana, Geneva, sans-serif;
            font-size: 10pt;
            color: var(--text-primary);
          }
          .debug-header {
            background-color: var(--background-color0);
            padding: 20px;
            text-align: center;
            border-bottom: 2px solid #ff6600;
          }
          .debug-description {
            max-width: 800px;
            margin: 20px auto;
            padding: 0 20px;
            line-height: 1.6;
          }
          .category-label {
            background-color: #ff6600;
            color: var(--bg-white);
            padding: 5px 10px;
            margin: 20px 0 10px 0;
            font-weight: bold;
            display: inline-block;
          }
          .comment-preview-container {
            margin: 20px;
            padding: 20px;
            background: var(--bg-white);
            border: 1px solid var(--border-subtle);
            border-radius: 4px;
          }
          .comment-meta {
            font-size: 9pt;
            color: var(--text-secondary);
            margin-bottom: 10px;
          }
          .comment-text {
            font-size: 10pt;
            line-height: 1.4;
            margin: 10px 0;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .story-context {
            background: var(--background-color0);
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 2px;
          }
          .preview-image {
            margin-top: 15px;
            border: 1px solid var(--border-subtle);
            max-width: 600px;
          }
          .avatar {
            width: 32px;
            height: 32px;
            border-radius: 2px;
            margin-right: 10px;
            vertical-align: middle;
          }
          .profile-info {
            display: inline-flex;
            align-items: center;
            margin-bottom: 10px;
          }
          .all-comments-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .all-comments-table th {
            background: #ff6600;
            color: var(--bg-white);
            padding: 8px;
            text-align: left;
          }
          .all-comments-table td {
            padding: 8px;
            border-bottom: 1px solid var(--border-subtle);
          }
          .all-comments-table tr:nth-child(even) {
            background: var(--background-color0);
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${Sidebar("/comment-debug")}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="var(--background-color0)">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td>
                  <div class="debug-header">
                    <h1>Comment Preview Debug</h1>
                    <p>Testing comment preview generation with real data</p>
                  </div>
                  
                  <div class="debug-description">
                    <p>This page displays real comments from the database to test preview generation.</p>
                    <p>Showing ${enrichedComments.length} sample comments.</p>
                    <p>Categories: Short (${categorized.short.length}), Medium (${categorized.medium.length}), Long (${categorized.long.length}), With Links (${categorized.withLinks.length}), With Quotes (${categorized.withQuotes.length})</p>
                  </div>
                </td>
              </tr>
              
              ${enrichedComments.map(comment => html`
                <tr>
                  <td>
                    <div class="comment-preview-container">
                      <div class="story-context">
                        <strong>Story:</strong> ${comment.submission_title}
                        <br/>
                        <span style="font-size: 9pt; color: var(--text-tertiary);">
                          ${comment.submission_href}
                        </span>
                      </div>
                      
                      <div class="profile-info">
                        <img class="avatar" src="${comment.profile.avatar}" alt="avatar" />
                        <div>
                          <strong>${comment.profile.displayName}</strong>
                          ${comment.profile.ens ? html`<span style="color: var(--text-tertiary);"> (${comment.profile.ens})</span>` : ''}
                          ${comment.profile.farcaster ? html`<span style="color: #7c65c1;"> • Farcaster</span>` : ''}
                        </div>
                      </div>
                      
                      <div class="comment-meta">
                        Comment ID: ${comment.index}
                        <br/>
                        Timestamp: ${new Date(comment.timestamp * 1000).toLocaleString()}
                      </div>
                      
                      <div class="comment-text">
                        ${comment.title}
                      </div>
                      
                      <div style="margin-top: 15px;">
                        <strong>Preview URL (for meta tags):</strong>
                        <br/>
                        <code style="background: var(--border-subtle); padding: 4px; font-size: 9pt; word-break: break-all;">
                          https://news.kiwistand.com/stories/${getSlug(comment.submission_title)}?index=0x${comment.story_index}&commentIndex=${comment.index}
                        </code>
                        <br/><br/>
                        <strong>Direct link (with hash):</strong>
                        <br/>
                        <code style="background: var(--border-subtle); padding: 4px; font-size: 9pt; word-break: break-all;">
                          https://news.kiwistand.com/stories/${getSlug(comment.submission_title)}?index=0x${comment.story_index}#${comment.index}
                        </code>
                        <br/><br/>
                        <a href="/stories/${getSlug(comment.submission_title)}?index=0x${comment.story_index}#${comment.index}" 
                           target="_blank"
                           style="color: #ff6600; text-decoration: none; padding: 8px 16px; background: var(--bg-white); border: 1px solid #ff6600; border-radius: 2px; display: inline-block; margin-right: 10px;">
                          View Comment →
                        </a>
                        <a href="/stories/${getSlug(comment.submission_title)}?index=0x${comment.story_index}&commentIndex=${comment.index}" 
                           target="_blank"
                           style="color: var(--text-white); text-decoration: none; padding: 8px 16px; background: #ff6600; border: 1px solid #ff6600; border-radius: 2px; display: inline-block;">
                          Generate Preview
                        </a>
                      </div>
                      
                      <div class="preview-image">
                        <div style="margin-top: 20px;">
                          <h4>OG Preview (1200x630):</h4>
                          <img 
                            src="/previews/${comment.story_index}-comment-${comment.index}.jpg"
                            alt="OG Preview"
                            style="max-width: 100%; border: 1px solid var(--border-subtle);"
                            onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221200%22 height=%22630%22%3E%3Crect width=%221200%22 height=%22630%22 fill=%22%23f6f6ef%22/%3E%3Ctext x=%22600%22 y=%22315%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2224%22 fill=%22%23999%22%3EGenerating preview...%3C/text%3E%3C/svg%3E'"
                          />
                          <br/><br/>
                          <h4>Farcaster Frame Preview (1200x800):</h4>
                          <img
                            src="/previews/${comment.story_index}-comment-${comment.index}-frame.jpg"
                            alt="Frame Preview"
                            style="max-width: 100%; border: 1px solid var(--border-subtle);"
                            onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221200%22 height=%22800%22%3E%3Crect width=%221200%22 height=%22800%22 fill=%22%23f6f6ef%22/%3E%3Ctext x=%22600%22 y=%22400%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2224%22 fill=%22%23999%22%3EGenerating preview...%3C/text%3E%3C/svg%3E'"
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              `)}
              
              <tr style="height: 50px;">
                <td></td>
              </tr>
            </table>
            ${Footer(theme)}
          </div>
        </div>
      </body>
    </html>
  `;
}