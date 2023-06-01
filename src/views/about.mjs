//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

const price = "0.01";

export default function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <center>
          <table
            id="hnmain"
            border="0"
            cellpadding="0"
            cellspacing="0"
            width="85%"
            bgcolor="#f6f6ef"
          >
            <tr>
              ${Header(theme)}
            </tr>
            <tr>
              <td>
                <div style="padding: 20px;">
                  <p><b>Problem:</b></p>
                  <p>
                    Reaching new people on the Internet is hard. So is finding
                    great, non-mainstream quality content.
                  </p>
                  <p>
                    As social media became the principal tool for distributing
                    content, creators with fewer than 10k followers face an
                    uphill battle to be noticed, even if their work is
                    extraordinary.
                  </p>
                  <p>
                    It's especially true in web3 where Hacker News - once a
                    leading forum for intellectual exchange - has become openly
                    hostile towards crypto. Creators are thus relegated to
                    sharing their content through Discord, Telegram, and various
                    social media channels, praying that by a stroke of luck,
                    someone will notice their work.
                  </p>
                  <p>
                    On the other hand, if you are a reader looking for great
                    things, you need to check noisy social media newsfeeds and
                    group chats, hoping to find the content needle in the
                    haystack of unrelated posts.
                  </p>
                  <p>
                    <b>That's why we created Kiwi News</b> - to level the
                    playing field and provide a platform for creators to be
                    heard and for quality content to triumph. Even when it's not
                    shared by the most popular kid in the room.
                  </p>
                  <p>
                    Kiwi users can now take a look at the community-curated
                    links and uncover hidden gems in 5 minutes, instead of
                    digging on different social media for hours.
                  </p>
                  <p>
                    If you want to join our cause,
                    <span> </span>
                    <a style="color: black;" href="/welcome">mint a Kiwi NFT</a>
                    <span> </span>
                    and submit and upvote links to co-create a rich,
                    intellectual space. Every action taken on Kiwi News is a
                    vote for better content.
                  </p>
                </div>
              </td>
            </tr>
          </table>
          ${Footer}
        </center>
      </body>
    </html>
  `;
}
