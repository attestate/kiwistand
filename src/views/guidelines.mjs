//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default async function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 1rem;">
                  <h1>Why guidelines are important</h1>
                  <p>
                    We have an opportunity to build our own corner of the
                    onchain internet. With awesome people, links, resources, and
                    learning. To ensure this corner is valuable, we need to
                    follow some submission guidelines.
                  </p>
                  <h2>What to submit?</h2>
                  <h3>On topic:</h3>
                  <p>
                    Anything that gratifies the intellectual curiosities of
                    builders, engineers, hackers, and craftspeople in the
                    community.
                  </p>
                  <p>That includes:</p>
                  <ul>
                    <li>Technical resources, hacking, and awesome git repos</li>
                    <li>Dune dashboards, reports, data-driven articles</li>
                    <li>Startups, cryptocurrencies, cryptography</li>
                    <li>Networking, privacy, decentralization</li>
                    <li>Hardware, open source, art, economics, game theory</li>
                    <li>
                      Anything else our community might find fascinating,
                      covering any subject from philosophy, literature, and pop
                      culture, through science, and health, up to society and
                      infrastructure
                    </li>
                  </ul>
                  <h3>Off topic:</h3>
                  <ul>
                    <li>
                      Sensationalist journalism for the sake of ad revenue
                      (including overly optimized click-bait, rage-bait, fluff
                      headlines, clickthrough optimized headlines, cliffhanger
                      headlines, posts with no substance)
                    </li>
                    <li>Mediocre resources</li>
                    <li>
                      Old stories we all read and that have been widely shared
                      elsewhere
                    </li>
                    <li>Shilling (you know what this means)</li>
                  </ul>
                  <h2>How to submit?</h2>
                  <p>
                    A good headline tells you exactly what to expect without
                    embellishing or optimizing for clickthrough. Some
                    recommendations:
                  </p>
                  <ul>
                    <li>Attempt to submit the original title</li>
                    <li>
                      Trim the title if it's too long without losing substance
                    </li>
                    <li>
                      Avoid Title Casing Because It Looks Like Spam (and it's
                      terrible to read)
                    </li>
                    <li>
                      Avoid Upworthy and Buzzfeed style titles along the lines
                      of, "Fiat Crisis with Balaji (shocking!)" - there's no
                      need to add the last part
                    </li>
                    <li>Consider NOT submitting pay-walled articles</li>
                    <li>Don't end a title with a period or dot</li>
                    <li>
                      When introducing a new project or concept, you can use
                      either:
                      <ul>
                        <li>
                          A dash (-): "ETHStrategy - fully onchain Microstrategy
                          for Ethereum"
                        </li>
                        <li>
                          A colon (:): "Farcaster 2026: The Game-Changing
                          Potential of AI Agents"
                        </li>
                      </ul>
                    </li>
                    <li>
                      Don't include the hosting platform in titles (e.g.,
                      "GitHub - bitcoin/bitcoin") as we already show the domain
                    </li>
                  </ul>

                  <h3>Open Graph Images</h3>
                  <p>
                    Open Graph images are a crucial part of the submission.
                    They're not an afterthought - they're often the first thing
                    users see.
                  </p>
                  <ul>
                    <li>
                      Images should be visually appealing and professionally
                      designed
                    </li>
                    <li>
                      Low-quality, poorly designed, or hastily created images
                      will be moderated
                    </li>
                    <li>The image should meaningfully represent the content</li>
                  </ul>
                  <h3>Submitter Requirements</h3>
                  <p>
                    To maintain quality and accountability in our community, we
                    have specific requirements for story submissions:
                  </p>
                  <ul>
                    <li>
                      Stories will be removed from the front page if the
                      submitter hasn't connected at least one of:
                      <ul>
                        <li>Farcaster account</li>
                        <li>ENS name</li>
                        <li>Lens profile</li>
                      </ul>
                    </li>
                    <li>
                      Submissions from accounts showing only a truncated address
                      (e.g., 0xA9D2...1A87) will not appear on the front page
                    </li>
                  </ul>
                  <p>
                    Connect your social accounts to ensure your submissions
                    remain visible to the community.
                  </p>
                  <h2>How to upvote?</h2>
                  <p>
                    Within a small community, upvoting carries a lot of weight.
                    The recommendation here is to carefully consider what's
                    worth upvoting and what isn't. Avoid upvoting things you
                    haven't read, watched, or vetted as worthy of other people's
                    time.
                  </p>
                  <p>
                    <span>Thanks to </span>
                    <u
                      ><a href="/thatalexpalmer.eth" target="_blank"
                        >thatalexpalmer.eth</a
                      ></u
                    >
                    <span> who helped us prepare submission guidelines.</span>
                  </p>
                  <h1>Commenting guidelines</h1>
                  <p>
                    Kiwi wants to provide clarity in the confusing crypto world.
                    Comments play a huge role here, as they can expand the idea,
                    add context, or debunk the statements in the articles shared
                    here.
                  </p>
                  <p>
                    So just as we specified what content we want to see, now we
                    want to ensure it's clear what kind of comments we are
                    looking for. Also, since comments can't be edited (at least
                    for now) and are fully public, it’s good to give them a bit
                    of thought.
                  </p>

                  <h2>What comments are we looking for?</h2>
                  <ol>
                    <li>
                      <strong>Extra Context</strong><br />
                      Kiwi users see only the headline, so if you are a person
                      who submitted the link, feel free to add more context.
                      Explain what this content is about, why you think it’s
                      interesting, and share if you agree with it or not.
                    </li>
                    <br />
                    <li>
                      <strong>Insider's perspective</strong><br />
                      If an essay is about subject X (app, blockchain, or
                      whatever), and you have interacted with it before, feel
                      free to share your perspective. It's always interesting to
                      learn from people who have first-hand experience.
                    </li>
                    <br />
                    <li>
                      <strong>Deeper dive</strong><br />
                      If you can add more context and information about the
                      subject, please do it. We like to get a 360 perspective of
                      the things we discuss.
                    </li>
                    <br />
                    <li>
                      <strong>Debunks</strong><br />
                      If the material is misleading or you disagree with it,
                      share your perspective (and, if applicable, sources to
                      support it!)
                    </li>
                    <br />
                    <li>
                      <strong>Impact on you</strong><br />
                      If this essay changed how you look at this particular
                      subject, tell us what you thought before and how you think
                      about it now.
                    </li>
                    <br />
                    <li>
                      <strong>Questions</strong><br />
                      If you have any questions related to the subject, feel
                      free to ask them.
                    </li>
                    <br />
                    <li>
                      <strong>Funny, spicy remarks</strong><br />
                      If you have a funny, spicy way to comment on the content,
                      feel free to do it.
                    </li>
                  </ol>
                  <p>
                    This list is non-exhaustive, so all comments that include
                    more context, help us understand the subject better, or add
                    value to the conversation are much welcome!
                  </p>

                  <h2>What comments to avoid?</h2>
                  <ol>
                    <li>
                      <strong>Ad hominem attacks</strong><br />
                      Please avoid personal attacks against authors and
                      commenters. If you think they are questionable, point to
                      relevant material (see above: Debunks).
                    </li>
                    <br />
                    <li>
                      <strong>Shilling and spamming</strong><br />
                      We all know what this means. If you spot a comment you
                      think could be labeled as such, please let us know on the
                      Telegram group.
                    </li>
                    <br />
                    <li>
                      <strong>Strawman's arguments</strong><br />
                      It’s okay to digress, but if your arguments aren’t related
                      to the discussion, then it’s not that helpful.
                    </li>
                    <br />
                    <li>
                      <strong>“I made it up” comments</strong><br />
                      “Extraordinary claims require extraordinary evidence”. So
                      if you say something that is not a well-known fact, and
                      don’t provide data or arguments to support your point, the
                      comment is not that useful.
                    </li>
                  </ol>

                  <p>
                    PS: Thanks to<span> </span>
                    <u
                      ><a href="/mishaderrider.eth" target="_blank"
                        >mishaderidder.eth</a
                      ></u
                    >,<span> </span>
                    <u><a href="/rvolz.eth" target="_blank">rvolz.eth</a></u
                    >,<span> </span>
                    <u><a href="/zinkk.eth" target="_blank">zinkk.eth</a></u
                    >,<span> </span> and<span> </span>
                    <u><a href="/noctis.eth" target="_blank">noctis.eth</a></u
                    ><span> </span>
                    for helping us to set up commenting guidelines.
                  </p>
                  <a href="/submit">
                    <button
                      style="font-size: 1.01rem; border-radius: 2px; cursor: pointer; padding: 5px 15px 5px 15px; background-color: transparent; border: 1px solid"
                    >
                      Go to Submit page
                    </button>
                  </a>
                </td>
              </tr>
            </table>
            ${Footer(theme)}
          </div>
        </div>
      </body>
    </html>
  `;
}
