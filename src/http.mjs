//@format
import { env } from "process";

import express from "express";
import cookieParser from "cookie-parser";

import log from "./logger.mjs";
import { SCHEMATA } from "./constants.mjs";
import themes from "./themes.mjs";

import feed from "./views/feed.mjs";
import newest from "./views/new.mjs";
import privacy from "./views/privacy.mjs";
import nft from "./views/nft.mjs";
import subscribe from "./views/subscribe.mjs";
import guidelines from "./views/guidelines.mjs";
import upvotes from "./views/upvotes.mjs";
import community from "./views/community.mjs";
import stats from "./views/stats.mjs";
import activity from "./views/activity.mjs";
import about from "./views/about.mjs";
import why from "./views/why.mjs";
import submit from "./views/submit.mjs";
import settings from "./views/settings.mjs";

const app = express();

app.use(express.static("src/public"));
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

if (!env.THEME_COLOR || !env.THEME_EMOJI || !env.THEME_NAME) {
  throw new Error(
    "The environment variables THEME_COLOR, THEME_EMOJI and THEME_NAME must be defined"
  );
}

export async function launch(trie, libp2p) {
  app.get("/", async (request, reply) => {
    let page = parseInt(request.query.page);
    if (isNaN(page) || page < 1) {
      page = 0;
    }
    const content = await feed(trie, reply.locals.theme, page);
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
    const content = await newest(trie, reply.locals.theme);
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/community", async (request, reply) => {
    const content = await community(trie, reply.locals.theme);
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/stats", async (request, reply) => {
    const content = await stats(trie, reply.locals.theme);
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/about", async (request, reply) => {
    const content = await about(reply.locals.theme);
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/settings", async (request, reply) => {
    const content = await settings(reply.locals.theme);
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/why", async (request, reply) => {
    const content = await why(reply.locals.theme);
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/guidelines", async (request, reply) => {
    const content = await guidelines(reply.locals.theme);
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/activity", async (request, reply) => {
    const { content, lastUpdate } = await activity(
      trie,
      reply.locals.theme,
      request.query.address
    );
    if (lastUpdate) {
      reply.setHeader("X-LAST-UPDATE", lastUpdate);
      reply.cookie("lastUpdate", lastUpdate);
    }
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/subscribe", async (request, reply) => {
    return reply
      .status(200)
      .type("text/html")
      .send(subscribe(reply.locals.theme));
  });
  app.get("/privacy-policy", async (request, reply) => {
    return reply
      .status(200)
      .type("text/html")
      .send(privacy(reply.locals.theme));
  });
  app.get("/welcome", async (request, reply) => {
    return reply.status(200).type("text/html").send(nft(reply.locals.theme));
  });
  app.get("/upvotes", async (request, reply) => {
    const content = await upvotes(
      trie,
      reply.locals.theme,
      request.query.address
    );
    return reply.status(200).type("text/html").send(content);
  });

  app.get("/submit", async (request, reply) => {
    const { url, title } = request.query;
    const content = await submit(reply.locals.theme, url, title);
    return reply.status(200).type("text/html").send(content);
  });

  app.listen(env.HTTP_PORT, () =>
    log(`Launched HTTP server at port "${env.HTTP_PORT}"`)
  );
}
