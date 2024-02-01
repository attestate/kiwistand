//@format
import { env } from "process";
import { readFile } from "fs/promises";
import { basename } from "path";

import morgan from "morgan";
import express from "express";
import cookieParser from "cookie-parser";
import { utils } from "ethers";
import htm from "htm";
import "express-async-errors";
import multer from "multer";

import log from "./logger.mjs";
import { SCHEMATA } from "./constants.mjs";
import themes from "./themes.mjs";
import feed, { index } from "./views/feed.mjs";
import story from "./views/story.mjs";
import newest, * as newAPI from "./views/new.mjs";
import images, * as imagesAPI from "./views/images.mjs";
import best from "./views/best.mjs";
import canon from "./views/canon.mjs";
import privacy from "./views/privacy.mjs";
import guidelines from "./views/guidelines.mjs";
import onboarding from "./views/onboarding.mjs";
import join from "./views/join.mjs";
import kiwipass from "./views/kiwipass.mjs";
import kiwipassmint from "./views/kiwipass-mint.mjs";
import memecoin from "./views/memecoin.mjs";
import onboardingReader from "./views/onboarding-reader.mjs";
import onboardingCurator from "./views/onboarding-curator.mjs";
import onboardingSubmitter from "./views/onboarding-submitter.mjs";
import lists from "./views/lists.mjs";
import shortcut from "./views/shortcut.mjs";
import nfts from "./views/nfts.mjs";
import subscribe from "./views/subscribe.mjs";
import upvotes from "./views/upvotes.mjs";
import community from "./views/community.mjs";
import stats from "./views/stats.mjs";
import * as activity from "./views/activity.mjs";
import about from "./views/about.mjs";
import why from "./views/why.mjs";
import submit from "./views/submit.mjs";
import settings from "./views/settings.mjs";
import indexing from "./views/indexing.mjs";
import demonstration from "./views/demonstration.mjs";
import * as curation from "./views/curation.mjs";
import * as moderation from "./views/moderation.mjs";
import { parse } from "./parser.mjs";
import { toAddress, resolve } from "./ens.mjs";
import * as registry from "./chainstate/registry.mjs";
import * as store from "./store.mjs";
import { generate } from "./preview.mjs";
import * as ens from "./ens.mjs";
import * as karma from "./karma.mjs";

const app = express();

app.set("etag", "strong");
app.use((req, res, next) => {
  res.setHeader("Last-Modified", new Date().toUTCString());
  next();
});

app.use(
  morgan(
    ':remote-addr - :remote-user ":method :url" :status ":referrer" ":user-agent"',
  ),
);
app.use(
  "/assets",
  express.static("src/public/assets", {
    setHeaders: (res, pathName) => {
      if (env.NODE_ENV === "production") {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }),
);

app.use(
  express.static("src/public", {
    setHeaders: (res, pathName) => {
      if (env.NODE_ENV !== "production") return;
      if (!/\/assets\//.test(pathName)) {
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
    },
  }),
);
app.use(express.json());
app.use(cookieParser());

function loadTheme(req, res, next) {
  const themeId = parseInt(req.cookies.currentTheme, 10);
  const savedTheme = themes.find((theme) => theme.id === themeId);

  const theme = savedTheme || {
    id: 14,
    emoji: "🥝",
    name: "Kiwi News",
    color: "limegreen",
  };

  res.locals.theme = theme;

  next();
}

app.use(loadTheme);

// NOTE: sendError and sendStatus are duplicated here (compare with
// /src/api.mjs) because eventually we wanna rip apart the Kiwi News website
// from the node software.
function sendError(reply, code, message, details) {
  log(`http error: "${code}", "${message}", "${details}"`);
  return reply.status(code).json({
    status: "error",
    code,
    message,
    details,
  });
}

function sendStatus(reply, code, message, details, data) {
  const obj = {
    status: "success",
    code,
    message,
    details,
  };
  if (data) obj.data = data;
  return reply.status(code).json(obj);
}

export async function launch(trie, libp2p) {
  app.use((err, req, res, next) => {
    log(`Express error: "${err.message}", "${err.stack}"`);
    res.status(500).send("Internal Server Error");
  });

  const upload = multer({ storage: multer.memoryStorage() });

  app.post(
    "/api/v1/images",
    upload.single("fileToUpload"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }

      const form = new FormData();
      form.set("reqtype", "fileupload");
      form.set(
        "fileToUpload",
        new Blob([req.file.buffer]),
        basename(req.file.originalname),
      );

      try {
        const catboxResponse = await fetch("https://catbox.moe/user/api.php", {
          method: "POST",
          body: form,
        });

        if (!catboxResponse.ok) {
          throw new Error(
            `Catbox responded with status: ${catboxResponse.status}`,
          );
        }

        const catboxUrl = await catboxResponse.text();
        res.send(catboxUrl);
      } catch (error) {
        console.error(`Error during upload: ${error}`);
        res.status(500).send("Error uploading to Catbox");
      }
    },
  );
  app.get("/api/v1/parse", async (request, reply) => {
    const embed = await parse(request.query.url);
    reply.header("Cache-Control", "no-cache");
    return reply.status(200).type("text/html").send(embed);
  });
  app.get("/api/v1/karma/:address", async (request, reply) => {
    let address;
    try {
      address = utils.getAddress(request.params.address);
    } catch (err) {
      const code = 400;
      const httpMessage = "Bad Request";
      const details = "Please only submit valid Ethereum addresses.";
      reply.header(
        "Cache-Control",
        "public, max-age=0, no-transform, must-revalidate",
      );
      return sendError(reply, code, httpMessage, details);
    }

    const points = karma.resolve(address);
    const code = 200;
    const httpMessage = "OK";
    const details = `Karma`;
    reply.header(
      "Cache-Control",
      "public, max-age=300, no-transform, must-revalidate, stale-while-revalidate=300",
    );
    return sendStatus(reply, code, httpMessage, details, {
      address,
      karma: points,
    });
  });
  app.get("/api/v1/feeds/:name", async (request, reply) => {
    let stories = [];
    if (request.params.name === "hot") {
      let page = parseInt(request.query.page);
      if (isNaN(page) || page < 1) {
        page = 0;
      }
      const results = await index(trie, page);
      reply.header(
        "Cache-Control",
        "public, max-age=300, no-transform, must-revalidate, stale-while-revalidate=30",
      );
      stories = results.stories;
    } else if (request.params.name === "new") {
      reply.header("Cache-Control", "no-cache");
      stories = newAPI.getStories();
    } else if (request.params.name === "images") {
      reply.header("Cache-Control", "no-cache");
      stories = imagesAPI.getStories();
    } else {
      const code = 501;
      const httpMessage = "Not Implemented";
      const details =
        "We currently don't implement any other endpoint but 'hot' and 'new'";
      reply.header(
        "Cache-Control",
        "public, max-age=0, no-transform, must-revalidate",
      );
      return sendError(reply, code, httpMessage, details);
    }

    const code = 200;
    const httpMessage = "OK";
    const details = `${request.params.name} feed`;
    return sendStatus(reply, code, httpMessage, details, { stories });
  });
  app.get("/", async (request, reply) => {
    let page = parseInt(request.query.page);
    if (isNaN(page) || page < 1) {
      page = 0;
    }
    const content = await feed(
      trie,
      reply.locals.theme,
      page,
      request.query.domain,
    );
    reply.header(
      "Cache-Control",
      "public, max-age=60, no-transform, must-revalidate, stale-while-revalidate=3600",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/canons", async (request, reply) => {
    const name = request.query.name;
    let sheets;
    try {
      const activeSheets = await moderation.getActiveCanons();
      sheets = await curation.getSheets(activeSheets);
    } catch (err) {
      return reply.status(404).type("text/plain").send("canon wasn't found");
    }

    const sheet = sheets.find((element) => element.name === name);
    if (!sheet) {
      return reply.status(404).type("text/plain").send("canon wasn't found");
    }
    const content = await canon(trie, reply.locals.theme, sheet);

    reply.header(
      "Cache-Control",
      "public, max-age=300, no-transform, must-revalidate, stale-while-revalidate=86400",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/stories", async (request, reply) => {
    const index = request.query.index;
    const hexRegex = /^0x[a-fA-F0-9]{72}$/;

    if (!hexRegex.test(index)) {
      return reply.status(404).type("text/plain").send("index wasn't found");
    }

    const hexIndex = index.substring(2);
    const parser = JSON.parse;
    const allowlist = await registry.allowlist();
    const delegations = await registry.delegations();
    let post;
    try {
      post = await store.post(
        trie,
        Buffer.from(hexIndex, "hex"),
        parser,
        allowlist,
        delegations,
      );
    } catch (err) {
      log(
        `Requested index "${index}" but didn't find because of error "${err.toString()}"`,
      );
      return reply.status(404).type("text/plain").send("index wasn't found");
    }

    if (post && post.value && post.value.type === "comment") {
      return reply.status(404).type("text/plain").send("index wasn't found");
    }

    const ensData = await ens.resolve(post.value.identity);
    const value = {
      ...post.value,
      displayName: ensData.displayName,
      submitter: ensData,
    };
    // NOTE: We aren't awaiting here because this can run in parallel
    generate(hexIndex, value.title, value.submitter);

    const content = await story(trie, reply.locals.theme, hexIndex, post.value);

    reply.header(
      "Cache-Control",
      "public, max-age=10, no-transform, must-revalidate, stale-while-revalidate=600",
    );
    return reply.status(200).type("text/html").send(content);
  });
  // NOTE: During the process of combining the feed and the editor's picks, we
  // decided to expose people to the community pick's tab right from the front
  // page, which is why while deprecating the /feed, we're forwarding to root.
  app.get("/feed", function (req, res) {
    res.redirect(301, "/");
  });
  app.get("/dau", function (req, res) {
    res.redirect(301, "/stats");
  });
  app.get("/new", async (request, reply) => {
    const content = await newest(trie, reply.locals.theme, request.query.index);
    let timestamp;
    try {
      timestamp = newAPI.getLatestTimestamp();
      reply.cookie("newTimestamp", timestamp, { maxAge: 1000 * 60 * 60 * 32 });
    } catch (err) {
      //noop
    }

    reply.header("Cache-Control", "no-cache");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/images", async (request, reply) => {
    const content = await images(reply.locals.theme);

    let timestamp;
    try {
      timestamp = imagesAPI.getLatestTimestamp();
      reply.cookie("imagesTimestamp", timestamp, {
        maxAge: 1000 * 60 * 60 * 32,
      });
    } catch (err) {
      //noop
    }

    reply.header("Cache-Control", "no-cache");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/nfts", async (request, reply) => {
    const content = await nfts(trie, reply.locals.theme);

    reply.header(
      "Cache-Control",
      "public, max-age=0, no-transform, must-revalidate, stale-while-revalidate=86400",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/alltime", function (req, res) {
    return res.redirect(301, "/best?period=all");
  });
  app.get("/best", async (request, reply) => {
    let page = parseInt(request.query.page);
    if (isNaN(page) || page < 1) {
      page = 0;
    }

    const periodValues = ["all", "month", "week", "day"];
    let { period } = request.query;
    if (!period || !periodValues.includes(period)) {
      period = "week";
    }

    const content = await best(
      trie,
      reply.locals.theme,
      page,
      period,
      request.query.domain,
    );

    reply.header(
      "Cache-Control",
      "public, max-age=3600, no-transform, must-revalidate, stale-while-revalidate=86400",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/community", async (request, reply) => {
    const content = await community(
      trie,
      reply.locals.theme,
      request.query,
      request.cookies.identity,
    );

    reply.header("Cache-Control", "private, must-revalidate");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/stats", async (request, reply) => {
    const content = await stats(trie, reply.locals.theme);
    reply.header(
      "Cache-Control",
      "public, max-age=3600, no-transform, must-revalidate, stale-while-revalidate=120",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/about", async (request, reply) => {
    const content = await about(reply.locals.theme);

    reply.header("Cache-Control", "public, max-age=86400");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/demonstration", async (request, reply) => {
    const content = await demonstration(reply.locals.theme);

    reply.header("Cache-Control", "public, max-age=86400");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/indexing", async (request, reply) => {
    let address;
    try {
      address = utils.isAddress(request.query.address);
    } catch (err) {
      return reply
        .status(404)
        .type("text/plain")
        .send("No valid Ethereum address");
    }

    const { transactionHash } = request.query;
    if (
      !transactionHash ||
      !utils.isHexString(transactionHash) ||
      transactionHash.length !== 66
    ) {
      return reply
        .status(404)
        .type("text/plain")
        .send("Not valid Ethereum transaction hash");
    }

    const content = await indexing(
      reply.locals.theme,
      address,
      transactionHash,
    );

    reply.header("Cache-Control", "public, max-age=86400");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/settings", async (request, reply) => {
    const content = await settings(
      reply.locals.theme,
      request.cookies.identity,
    );

    reply.header("Cache-Control", "private, max-age=86400");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/why", async (request, reply) => {
    const content = await why(reply.locals.theme, request.cookies.identity);

    reply.header("Cache-Control", "public, max-age=86400");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/api/v1/activity", async (request, reply) => {
    let data;

    try {
      data = await activity.data(
        trie,
        request.cookies.identity || request.query.address,
        request.cookies.lastUpdate,
      );
    } catch (err) {
      const code = 400;
      const httpMessage = "Bad Request";
      return sendError(reply, code, httpMessage, "Valid query parameters");
    }
    const code = 200;
    const httpMessage = "OK";
    const details = "Notifications feed";

    reply.header("Cache-Control", "no-cache");
    return sendStatus(reply, code, httpMessage, details, {
      notifications: data.notifications,
      lastServerValue: data.latestValue,
    });
  });
  app.get("/activity", async (request, reply) => {
    let data;
    try {
      data = await activity.data(
        trie,
        request.query.address,
        request.cookies.lastUpdate,
      );
    } catch (err) {
      return reply.status(400).type("text/plain").send(err.toString());
    }
    const content = await activity.page(
      reply.locals.theme,
      request.cookies.identity || request.query.address,
      data.notifications,
      request.cookies.lastUpdate,
    );
    if (data && data.lastUpdate) {
      reply.setHeader("X-LAST-UPDATE", data.lastUpdate);
      reply.cookie("lastUpdate", data.lastUpdate);
    }
    reply.header("Cache-Control", "no-cache");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/subscribe", async (request, reply) => {
    reply.header("Cache-Control", "public, max-age=86400");
    return reply
      .status(200)
      .type("text/html")
      .send(await subscribe(reply.locals.theme));
  });
  app.get("/privacy-policy", async (request, reply) => {
    reply.header("Cache-Control", "public, max-age=86400");
    return reply
      .status(200)
      .type("text/html")
      .send(await privacy(reply.locals.theme));
  });
  app.get("/guidelines", async (request, reply) => {
    reply.header("Cache-Control", "public, max-age=86400");
    return reply
      .status(200)
      .type("text/html")
      .send(await guidelines(reply.locals.theme));
  });
  app.get("/onboarding", async (request, reply) => {
    reply.header("Cache-Control", "private, max-age=86400");
    return reply
      .status(200)
      .type("text/html")
      .send(await onboarding(reply.locals.theme, request.cookies.identity));
  });
  app.get("/onboarding-reader", async (request, reply) => {
    reply.header("Cache-Control", "private, max-age=86400");
    return reply
      .status(200)
      .type("text/html")
      .send(
        await onboardingReader(reply.locals.theme, request.cookies.identity),
      );
  });
  app.get("/onboarding-curator", async (request, reply) => {
    reply.header("Cache-Control", "private, max-age=86400");
    return reply
      .status(200)
      .type("text/html")
      .send(
        await onboardingCurator(reply.locals.theme, request.cookies.identity),
      );
  });
  app.get("/onboarding-submitter", async (request, reply) => {
    reply.header("Cache-Control", "private, max-age=86400");
    return reply
      .status(200)
      .type("text/html")
      .send(
        await onboardingSubmitter(reply.locals.theme, request.cookies.identity),
      );
  });

  app.get("/lists", async (request, reply) => {
    const content = await lists(reply.locals.theme);

    reply.header("Cache-Control", "public, max-age=60, must-revalidate");
    return reply.status(200).type("text/html").send(content);
  });

  app.get("/welcome", async (request, reply) => {
    reply.header("Cache-Control", "public, must-revalidate");
    return reply
      .status(200)
      .type("text/html")
      .send(await join(reply.locals.theme));
  });
  app.get("/kiwipass", async (request, reply) => {
    reply.header("Cache-Control", "public, must-revalidate");
    return reply
      .status(200)
      .type("text/html")
      .send(await kiwipass(reply.locals.theme));
  });
  app.get("/kiwipass-mint", async (request, reply) => {
    reply.header("Cache-Control", "public, max-age=3600, must-revalidate");
    return reply
      .status(200)
      .type("text/html")
      .send(await kiwipassmint(reply.locals.theme));
  });
  app.get("/memecoin", async (request, reply) => {
    reply.header("Cache-Control", "public, must-revalidate");
    return reply
      .status(200)
      .type("text/html")
      .send(await memecoin(reply.locals.theme));
  });
  app.get("/shortcut", async (request, reply) => {
    reply.header("Cache-Control", "public, max-age=86400");
    return reply
      .status(200)
      .type("text/html")
      .send(await shortcut(reply.locals.theme));
  });

  async function getProfile(trie, theme, address, page, mode) {
    let activeMode = "top";
    if (mode === "new") activeMode = "new";

    page = parseInt(page);
    if (isNaN(page) || page < 1) {
      page = 0;
    }
    const content = await upvotes(trie, theme, address, page, activeMode);
    return content;
  }
  app.get("/upvotes", async (request, reply) => {
    if (!utils.isAddress(request.query.address)) {
      return reply
        .status(404)
        .type("text/plain")
        .send("No valid Ethereum address");
    }
    const profile = await resolve(request.query.address);
    if (profile && profile.ens) {
      return reply.redirect(301, `/${profile.ens}`);
    }

    const content = await getProfile(
      trie,
      reply.locals.theme,
      request.query.address,
      request.query.page,
      request.query.mode,
    );

    if (request.query.mode === "new") {
      reply.header(
        "Cache-Control",
        "public, max-age=3600, no-transform, must-revalidate, stale-while-revalidate=86400",
      );
    } else if (!request.query.mode || request.query.mode == "top") {
      reply.header(
        "Cache-Control",
        "public, max-age=86400, no-transform, must-revalidate, stale-while-revalidate=86400",
      );
    } else {
      reply.header(
        "Cache-Control",
        "public, max-age=3600, no-transform, must-revalidate, stale-while-revalidate=60",
      );
    }

    return reply.status(200).type("text/html").send(content);
  });

  app.get("/submit", async (request, reply) => {
    const { url, title } = request.query;
    const content = await submit(reply.locals.theme, url, title);

    reply.header("Cache-Control", "public, max-age=18000, must-revalidate");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/*", async (request, reply, next) => {
    const name = request.params[0];
    if (!name.endsWith(".eth")) {
      return next();
    }
    let address;
    try {
      address = await toAddress(name);
    } catch (err) {
      if (err.toString().includes("Couldn't convert to address")) {
        return reply
          .status(404)
          .type("text/plain")
          .send("ENS address wasn't found.");
      }
      log(err.toString());
      return next(err);
    }
    let content;
    try {
      content = await getProfile(
        trie,
        reply.locals.theme,
        address,
        request.query.page,
        request.query.mode,
      );
    } catch (err) {
      return next(err);
    }

    reply.header(
      "Cache-Control",
      "public, max-age=86400, no-transform, must-revalidate, stale-while-revalidate=3600",
    );
    return reply.status(200).type("text/html").send(content);
  });

  app.listen(env.HTTP_PORT, () =>
    log(`Launched HTTP server at port "${env.HTTP_PORT}"`),
  );
}
