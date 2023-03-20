//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

let theme = {};
if (env.THEME === "kiwi") {
  theme.color = "limegreen";
  theme.emoji = "🥝";
  theme.name = "Kiwi News";
} else if (env.THEME === "orange") {
  theme.color = "orange";
  theme.emoji = "🍊";
  theme.name = "Orange News";
} else {
  throw new Error("Must define env.THEME");
}

const stories = [
  {
    title: "Paving the Road to Vulkan",
    points: 375,
    href: "http://example.com",
  },
  {
    title:
      "The Times 20/Mar/2023 Chancellor on brink of second bailout for banks.",
    points: 1337,
    href: "http://example.com",
  },
];

export default html`
  <html lang="en" op="news">
    <head>
      <meta charset="utf-8" />
      <meta name="referrer" content="origin" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" type="text/css" href="public/news.css" />
      <link rel="shortcut icon" href="favicon.ico" />
      <title>Kiwi News</title>
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
            <td bgcolor="${theme.color}">
              <table
                border="0"
                cellpadding="0"
                cellspacing="0"
                width="100%"
                style="padding:5px"
              >
                <tr>
                  <td style="width:18px;padding-right:4px"></td>
                  <td style="line-height:12pt; height:10px;">
                    <span class="pagetop"
                      ><b class="hnname">${`${theme.emoji} ${theme.name}`}</b>
                    </span>
                  </td>
                  <td style="text-align:right;padding-right:4px;"></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr id="pagespace" title="" style="height:10px"></tr>
          ${stories.map(
            (story, i) => html`
              <tr>
                <td>
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr class="athing" id="35233479">
                      <td align="right" valign="top" class="title">
                        <span class="rank">${i + 1}.</span>
                      </td>
                      <td valign="top" class="votelinks">
                        <center>
                          <a id="up_35233479" class="clicky" href="#">
                            <div class="votearrow" title="upvote"></div>
                          </a>
                        </center>
                      </td>
                      <td class="title">
                        <span class="titleline">
                          <a href="${story.href}">${story.title}</a>
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2"></td>
                      <td class="subtext">
                        <span class="subline">
                          <span class="score" id="score_35233479"
                            >${story.points} points</span
                          >
                        </span>
                      </td>
                    </tr>
                    <tr class="spacer" style="height:5px"></tr>
                  </table>
                </td>
              </tr>
            `
          )}
        </table>
      </center>
    </body>
  </html>
`;
