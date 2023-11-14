//@format
import { env } from "process";
import { readFile } from "fs/promises";

import morgan from "morgan";
import express from "express";
import cookieParser from "cookie-parser";
import { utils } from "ethers";
import htm from "htm";
import "express-async-errors";

import log from "./logger.mjs";
import { SCHEMATA } from "./constants.mjs";
import themes from "./themes.mjs";
import feed, { index } from "./views/feed.mjs";
import story from "./views/story.mjs";
import newest from "./views/new.mjs";
import best from "./views/best.mjs";
import canon from "./views/canon.mjs";
import lists from "./views/lists.mjs";
import privacy from "./views/privacy.mjs";
import guidelines from "./views/guidelines.mjs";
import onboarding from "./views/onboarding.mjs";
import join from "./views/join.mjs";
import kiwipass from "./views/kiwipass.mjs";
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

const app = express();

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

  app.get("/api/v1/parse", async (request, reply) => {
    const embed = await parse(request.query.url);
    return reply.status(200).type("text/html").send(embed);
  });
  app.get("/api/v1/feeds/:name", async (request, reply) => {
    if (request.params.name !== "hot") {
      const code = 501;
      const httpMessage = "Not Implemented";
      const details =
        "We currently don't implement any other endpoint but 'hot'";
      return sendError(reply, code, httpMessage, details);
    }

    let page = parseInt(request.query.page);
    if (isNaN(page) || page < 1) {
      page = 0;
    }
    const { stories } = await index(trie, page);

    const code = 200;
    const httpMessage = "OK";
    const details = "Hot feed";
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
      request.cookies.identity,
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
    const content = await canon(
      trie,
      reply.locals.theme,
      request.cookies.identity,
      sheet,
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

    const ensData = await ens.resolve(post.value.identity);
    const value = {
      ...post.value,
      displayName: ensData.displayName,
      submitter: ensData,
    };
    // NOTE: We aren't awaiting here because this can run in parallel
    generate(hexIndex, value.title, value.submitter);

    const content = await story(
      trie,
      reply.locals.theme,
      hexIndex,
      post.value,
      request.cookies.identity,
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
    const content = await newest(
      trie,
      reply.locals.theme,
      request.cookies.identity,
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/nfts", async (request, reply) => {
    const content = await nfts(
      trie,
      reply.locals.theme,
      request.cookies.identity,
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
      request.cookies.identity,
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/community", async (request, reply) => {
    let page = parseInt(request.query.page);
    if (isNaN(page) || page < 1) {
      page = 0;
    }
    const content = await community(
      trie,
      reply.locals.theme,
      page,
      request.cookies.identity,
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/stats", async (request, reply) => {
    const content = await stats(trie, reply.locals.theme);
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/lists", async (request, reply) => {
    const content = await lists(trie, reply.locals.theme);
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/about", async (request, reply) => {
    const content = await about(reply.locals.theme, request.cookies.identity);
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/demonstration", async (request, reply) => {
    const content = await demonstration(
      reply.locals.theme,
      request.cookies.identity,
    );
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
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/settings", async (request, reply) => {
    const content = await settings(
      reply.locals.theme,
      request.cookies.identity,
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/why", async (request, reply) => {
    const content = await why(reply.locals.theme, request.cookies.identity);
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
        request.cookies.identity || request.query.address,
        request.cookies.lastUpdate,
      );
    } catch (err) {
      return reply.status(400).type("text/plain").send(err.toString());
    }
    const content = await activity.page(
      reply.locals.theme,
      request.cookies.identity,
      data.notifications,
      request.cookies.lastUpdate,
    );
    if (data && data.lastUpdate) {
      reply.setHeader("X-LAST-UPDATE", data.lastUpdate);
      reply.cookie("lastUpdate", data.lastUpdate);
    }
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/subscribe", async (request, reply) => {
    return reply
      .status(200)
      .type("text/html")
      .send(await subscribe(reply.locals.theme, request.cookies.identity));
  });
  app.get("/privacy-policy", async (request, reply) => {
    return reply
      .status(200)
      .type("text/html")
      .send(await privacy(reply.locals.theme, request.cookies.identity));
  });
  app.get("/guidelines", async (request, reply) => {
    return reply
      .status(200)
      .type("text/html")
      .send(await guidelines(reply.locals.theme, request.cookies.identity));
  });
  app.get("/onboarding", async (request, reply) => {
    return reply
      .status(200)
      .type("text/html")
      .send(await onboarding(reply.locals.theme, request.cookies.identity));
  });
  app.get("/welcome", async (request, reply) => {
    return reply
      .status(200)
      .type("text/html")
      .send(await join(reply.locals.theme, request.cookies.identity));
  });
  app.get("/kiwipass", async (request, reply) => {
    return reply
      .status(200)
      .type("text/html")
      .send(await kiwipass(reply.locals.theme, request.cookies.identity));
  });
  app.get("/shortcut", async (request, reply) => {
    return reply
      .status(200)
      .type("text/html")
      .send(await shortcut(reply.locals.theme, request.cookies.identity));
  });

  async function getProfile(trie, theme, address, page, mode, identity) {
    let activeMode = "top";
    if (mode === "new") activeMode = "new";

    page = parseInt(page);
    if (isNaN(page) || page < 1) {
      page = 0;
    }
    const content = await upvotes(
      trie,
      theme,
      address,
      page,
      activeMode,
      identity,
    );
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
      request.cookies.identity,
    );
    return reply.status(200).type("text/html").send(content);
  });

  app.get("/submit", async (request, reply) => {
    const { url, title } = request.query;
    const content = await submit(
      reply.locals.theme,
      url,
      title,
      request.cookies.identity,
    );
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
      return next();
    }
    const content = await getProfile(
      trie,
      reply.locals.theme,
      address,
      request.query.page,
      request.query.mode,
      request.cookies.identity,
    );
    return reply.status(200).type("text/html").send(content);
  });

  app.listen(env.HTTP_PORT, () =>
    log(`Launched HTTP server at port "${env.HTTP_PORT}"`),
  );
}
