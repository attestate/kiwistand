import htm from "htm";
import vhtml from "vhtml";

import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Header from "./components/header.mjs";
import Head from "./components/head.mjs";
import Row from "./components/row.mjs";

const html = htm.bind(vhtml);

// Comprehensive mock story data covering all rendering variations
const createMockStories = () => {
  const baseTimestamp = Math.floor(Date.now() / 1000);
  
  return [
    // 1. Basic link - minimal story object
    {
      index: "000001",
      title: "A Simple Link to Documentation",
      href: "https://docs.example.com/guide",
      upvoters: ["0x1234567890abcdef", "0x0987654321fedcba"],
      timestamp: baseTimestamp - 3600, // 1 hour ago
      displayName: "alice.eth",
      identity: "0x1234567890abcdef",
      avatars: [],
    },
    
    // 2. Cloudflare image - href pointing to Cloudflare URL
    {
      index: "000002",
      title: "NFT Collection Launch: Pixel Cats",
      href: "https://placehold.co/800x600/FFB347/ffffff?text=Cloudflare+Image",
      upvoters: ["0xddd", "0xeee", "0xfff", "0x111"],
      timestamp: baseTimestamp - 14400, // 4 hours ago
      displayName: "nftcreator.eth",
      identity: "0xddd",
      avatars: [
        "https://cdn.stamp.fyi/avatar/eth:0xddd?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0xeee?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0xfff?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0x111?s=144",
      ],
    },
    
    // 3. Twitter preview - href to twitter.com with metadata
    {
      index: "000003",
      title: "Breaking: Ethereum Hits New Milestone",
      href: "https://x.com/VitalikButerin/status/1234567890",
      upvoters: ["0x222", "0x333"],
      timestamp: baseTimestamp - 21600, // 6 hours ago
      displayName: "cryptonews.eth",
      identity: "0x222",
      avatars: [
        "https://cdn.stamp.fyi/avatar/eth:0x222?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0x333?s=144",
      ],
      metadata: {
        ogDescription: "Today marks a historic moment for @ethereum as we successfully complete the transition to Proof of Stake. This achievement represents years of research, development, and community coordination. The energy consumption has dropped by 99.95%. Thread 🧵",
        twitterCreator: "@VitalikButerin",
        twitterAuthorAvatar: "https://placehold.co/400x400/1da1f2/ffffff?text=VB",
      },
    },
    
    // 4. Farcaster preview - warpcast.com URL with metadata.farcasterCast
    {
      index: "000004",
      title: "Building in Public: My Journey with Kiwi",
      href: "https://warpcast.com/dwr.eth/0x1234abcd",
      upvoters: ["0x444", "0x555", "0x666"],
      timestamp: baseTimestamp - 28800, // 8 hours ago
      displayName: "builder.eth",
      identity: "0x444",
      avatars: [
        "https://cdn.stamp.fyi/avatar/eth:0x444?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0x555?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0x666?s=144",
      ],
      metadata: {
        farcasterCast: {
          hash: "0x1234abcd",
          text: "Just shipped a major update to @kiwi! 🥝\n\nNew features:\n- Real-time notifications\n- Improved feed algorithm\n- Dark mode support\n- Mobile app beta\n\nThanks to everyone who provided feedback. Building in public has been an incredible journey!",
          author: {
            username: "dwr.eth",
            displayName: "Dan Romero",
            pfp: "https://placehold.co/400x400/8A63D2/ffffff?text=DR",
            fid: "3",
          },
          embeds: [
            {
              url: "https://placehold.co/800x600/8A63D2/ffffff?text=Farcaster+Image",
              metadata: {
                image: {
                  url: "https://placehold.co/800x600/8A63D2/ffffff?text=Farcaster+Image",
                },
              },
            },
          ],
        },
      },
    },
    
    // 5. Comment preview - with lastComment object
    {
      index: "000005",
      title: "The State of DeFi in 2024: Comprehensive Analysis",
      href: "https://research.paradigm.xyz/defi-2024",
      upvoters: ["0x777", "0x888", "0x999", "0xaaa"],
      timestamp: baseTimestamp - 43200, // 12 hours ago
      displayName: "researcher.eth",
      identity: "0x777",
      avatars: [
        "https://cdn.stamp.fyi/avatar/eth:0x777?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0x888?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0x999?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0xaaa?s=144",
      ],
      lastComment: {
        index: "comment001",
        title: "Great analysis! I particularly found the section on cross-chain liquidity fascinating. Have you considered the impact of new L2 solutions on the DeFi ecosystem? I think there's a lot more to explore there, especially with the recent developments in zkSync and Arbitrum.",
        timestamp: baseTimestamp - 1800, // 30 minutes ago
        identity: {
          displayName: "defi_expert.eth",
          ens: "defi_expert.eth",
          safeAvatar: "https://placehold.co/200x200/FF6B6B/ffffff?text=CR",
        },
        previousParticipants: [
          {
            safeAvatar: "https://placehold.co/200x200/4ECDC4/ffffff?text=P1",
          },
          {
            safeAvatar: "https://placehold.co/200x200/45B7D1/ffffff?text=P2",
          },
        ],
      },
    },
    
    // 6. Original content - with isOriginal flag
    {
      index: "000006",
      title: "My Experience Building a Decentralized Social Protocol",
      href: "https://blog.example.com/decentralized-social",
      upvoters: ["0x123", "0x456", "0x789"],
      timestamp: baseTimestamp - 86400, // 1 day ago
      displayName: "protocol_dev.eth",
      identity: "0x123",
      avatars: [
        "https://cdn.stamp.fyi/avatar/eth:0x123?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0x456?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0x789?s=144",
      ],
      isOriginal: true,
      metadata: {
        compliantTitle: "My Experience Building a Decentralized Social Protocol [OC]",
      },
    },
    
    // 7. Multiple upvoters - with avatars array of 5+ items
    {
      index: "000007",
      title: "Ethereum's Roadmap: What's Next After The Merge",
      href: "https://ethereum.org/roadmap",
      upvoters: [
        "0xa01", "0xa02", "0xa03", "0xa04", "0xa05",
        "0xa06", "0xa07", "0xa08", "0xa09", "0xa10",
      ],
      timestamp: baseTimestamp - 259200, // 3 days ago
      displayName: "eth_enthusiast.eth",
      identity: "0xa01",
      avatars: [
        "https://cdn.stamp.fyi/avatar/eth:0xa01?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0xa02?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0xa03?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0xa04?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0xa05?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0xa06?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0xa07?s=144",
      ],
      impressions: 1337,
    },
    
    // 8. Any post with OG image
    {
      index: "000008",
      title: "The Future of Digital Identity: Self-Sovereign Solutions",
      href: "https://techblog.example.com/digital-identity-future",
      upvoters: ["0xc01", "0xc02", "0xc03"],
      timestamp: baseTimestamp - 432000, // 5 days ago
      displayName: "identity_researcher.eth",
      identity: "0xc01",
      avatars: [
        "https://cdn.stamp.fyi/avatar/eth:0xc01?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0xc02?s=144",
        "https://cdn.stamp.fyi/avatar/eth:0xc03?s=144",
      ],
      metadata: {
        image: "https://placehold.co/1200x600/FF6154/ffffff?text=Blog+Article+With+OG+Image",
        ogDescription: "Exploring how blockchain technology enables self-sovereign identity solutions that put users in control of their personal data.",
      },
    },
  ];
};

export default async function debug(theme) {
  const mockStories = createMockStories();
  const rowRenderer = Row(0, "/debug", "", false, false, null, false, "", true); // debugMode = true
  
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
        <title>Kiwi News - Debug View</title>
        <meta name="robots" content="noindex, nofollow" />
        <style>
          body {
            font-family: Verdana, Geneva, sans-serif;
            font-size: 10pt;
            color: #333;
          }
          .debug-header {
            background-color: #f6f6ef;
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
          .variation-label {
            background-color: #ff6600;
            color: white;
            padding: 5px 10px;
            margin: 20px 0 10px 0;
            font-weight: bold;
            display: inline-block;
          }
          table {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }
          .content-row {
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${Sidebar("/debug")}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td>
                  <div class="debug-header">
                    <h1>Kiwi News Debug View</h1>
                    <p>Comprehensive test cases for all story rendering variations</p>
                  </div>
                  
                  <div class="debug-description">
                    <p>This debug page displays mock story data that covers all rendering variations in the Kiwi News interface. Each story below demonstrates a specific rendering condition or feature.</p>
                  </div>
                </td>
              </tr>
              
              ${mockStories.map((story, index) => {
                const labels = [
                  "1. Basic Link (Minimal Story)",
                  "2. Cloudflare Image",
                  "3. Twitter/X Preview",
                  "4. Farcaster Cast Preview",
                  "5. Comment Preview",
                  "6. Original Content [OC]",
                  "7. Multiple Upvoters (7+ avatars)",
                  "8. Any Post with OG Image",
                ];
                
                return html`
                  <tr>
                    <td>
                      <div class="variation-label">${labels[index]}</div>
                    </td>
                  </tr>
                  ${rowRenderer(story, index)}
                `;
              })}
              
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

// Export the mock stories for potential reuse
export { createMockStories };