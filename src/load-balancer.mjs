//@format
import { env } from "process";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cluster from "cluster";
import os from "os";
import log from "./logger.mjs";
import https from "https";
import fs from "fs";
import { createServer as createHttpServer } from "http";
import { Router as PortoRouter, Route } from "porto/server";

// Exit early in reconcile mode - only API and sync should run
if (env.NODE_ENV === "reconcile") {
  log("Load balancer exiting - reconcile mode doesn't need HTTP server");
  process.exit(0);
}

// Routes that should be handled by worker processes
const workerRoutes = [
  "/api/v1/activity",
  "/friends",
  "/api/v1/karma",
  "/api/v1/feeds",
  "/api/v1/stories",
  "/gateway",
  "/",
  "/stories",
  "/best",
  "/community",
  "/retention",
  "/users",
  "/basics",
  "/stats",
  "/about",
  "/passkeys",
  "/app-onboarding",
  "/app-testflight",
  "/pwaandroid",
  "/pwa",
  "/notifications",
  "/demonstration",
  "/email-notifications",
  "/invite",
  "/indexing",
  "/start",
  "/settings",
  "/why",
  "/subscribe",
  "/privacy-policy",
  "/guidelines",
  "/whattosubmit",
  "/welcome",
  "/shortcut",
  "/profile",
  "/upvotes",
  "/submit",
];

async function startLoadBalancer() {
  const app = express();

  // Porto Merchant API for sponsoring transactions
  const SPONSORED_CONTRACT = '0x418910fef46896eb0bfe38f656e2f7df3eca7198';

  const porto = PortoRouter()
    .route('/merchant', Route.merchant({
      address: env.PORTO_MERCHANT_ADDRESS,
      key: env.PORTO_MERCHANT_PRIVATE_KEY,
      sponsor: async (request) => {
        // Check if any call is to the sponsored contract
        const calls = request.calls || [];
        const shouldSponsor = calls.some(call =>
          call.to?.toLowerCase() === SPONSORED_CONTRACT.toLowerCase()
        );
        log(`Porto sponsor check: ${shouldSponsor} for ${calls.length} calls`);
        return shouldSponsor;
      },
    }));

  // Mount Porto before any proxying
  app.use('/porto', porto.listener);
  log('Porto merchant endpoint mounted at /porto/merchant');

  // Configure the number of workers
  const workerCount = Number(env.WORKER_COUNT) || os.cpus().length;

  // Set up ports for the primary and worker processes
  const originalPort = parseInt(env.HTTP_PORT);
  const primaryPort = originalPort + 1;
  const workerBasePort = primaryPort + 1;

  // Create array of worker URLs
  const workers = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(`http://localhost:${workerBasePort + i}`);
  }

  // Simple round-robin load balancer
  let currentWorker = 0;

  // Add proxy middleware for routes that should go to workers
  app.use((req, res, next) => {
    // Check if path should be handled by worker with direct path matching
    let shouldProxy = false;

    // Check if the path should be routed to a worker
    for (const route of workerRoutes) {
      // For root path, only match exactly
      if (route === "/" && req.path === "/") {
        shouldProxy = true;
        break;
      } else if (route === req.path) {
        shouldProxy = true;
        break;
      }
      // For paths that might have additional segments, check if the path starts with the route + "/"
      // For example, /stories/something or /api/v1/stories/something
      else if (route !== "/" && req.path.startsWith(route + "/")) {
        shouldProxy = true;
        break;
      }
    }

    // Special case for .eth paths - should be proxied to workers
    if (req.path.slice(1).endsWith(".eth")) {
      log(`Worker handling .eth address: ${req.method} ${req.url}`);
      shouldProxy = true;
    }

    if (shouldProxy) {
      // Get next worker in round-robin fashion
      const target = workers[currentWorker];
      currentWorker = (currentWorker + 1) % workers.length;

      log(
        `Load balancer: Proxying ${req.method} ${req.url} to worker at ${target}`,
      );

      const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        ws: false,
        logLevel: "warn",
        pathRewrite: (path, req) => path, // keep path unchanged
      });

      return proxy(req, res, next);
    }

    // If not a worker route, proxy to the primary process
    log(`Load balancer: Proxying ${req.method} ${req.url} to primary process`);
    const primaryProxy = createProxyMiddleware({
      target: `http://localhost:${primaryPort}`,
      changeOrigin: true,
      ws: false,
      logLevel: "warn",
    });

    return primaryProxy(req, res, next);
  });

  // Start the load balancer with SSL if configured
  const port = env.HTTP_PORT;

  let server;
  if (
    env.CUSTOM_PROTOCOL === "https://" &&
    env.CUSTOM_HOST_NAME === "staging.kiwistand.com:5173" &&
    fs.existsSync("staging.kiwistand.com/key.pem") &&
    fs.existsSync("staging.kiwistand.com/cert.pem")
  ) {
    const options = {
      key: fs.readFileSync("staging.kiwistand.com/key.pem", "utf8"),
      cert: fs.readFileSync("staging.kiwistand.com/cert.pem", "utf8"),
      rejectUnauthorized: false,
    };
    server = https.createServer(options, app);
    server.listen(port, () => {
      log(`Load balancer started with HTTPS on port ${port}`);
      log(`Primary process expected on port ${primaryPort}`);
      log(
        `Routing to ${workerCount} workers on ports ${workerBasePort}-${
          workerBasePort + workerCount - 1
        }`,
      );
    });
  } else if (env.CUSTOM_PROTOCOL === "https://") {
    const options = {
      key: fs.readFileSync("certificates/key.pem"),
      cert: fs.readFileSync("certificates/cert.pem"),
      rejectUnauthorized: false,
    };
    server = https.createServer(options, app);
    server.listen(port, () => {
      log(`Load balancer started with HTTPS on port ${port}`);
      log(`Primary process expected on port ${primaryPort}`);
      log(
        `Routing to ${workerCount} workers on ports ${workerBasePort}-${
          workerBasePort + workerCount - 1
        }`,
      );
    });
  } else {
    server = createHttpServer(app);
    server.listen(port, () => {
      log(`Load balancer started on port ${port}`);
      log(`Primary process expected on port ${primaryPort}`);
      log(
        `Routing to ${workerCount} workers on ports ${workerBasePort}-${
          workerBasePort + workerCount - 1
        }`,
      );
    });
  }
}

// Only run the load balancer if this file is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startLoadBalancer().catch((err) => {
    console.error("Error starting load balancer:", err);
    process.exit(1);
  });
}

export { startLoadBalancer };
