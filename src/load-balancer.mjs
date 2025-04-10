//@format
import { env } from "process";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cluster from "cluster";
import os from "os";
import log from "./logger.mjs";

// Routes that should be handled by worker processes
const workerRoutes = [
  "/friends",
  "/kiwipass-mint",
  "/api/v1/karma",
  "/api/v1/feeds",
  "/api/v1/stories",
  "/gateway",
  "/",
  "/stories",
  "/best",
  "/community",
  "/price",
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
  "/onboarding",
  "/whattosubmit",
  "/referral",
  "/onboarding-reader",
  "/onboarding-curator",
  "/onboarding-submitter",
  "/welcome",
  "/kiwipass",
  "/shortcut",
  "/profile",
  "/upvotes",
  "/submit",
];

async function startLoadBalancer() {
  const app = express();

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

  // Start the load balancer
  const port = env.HTTP_PORT;
  app.listen(port, () => {
    log(`Load balancer started on port ${port}`);
    log(`Primary process expected on port ${primaryPort}`);
    log(
      `Routing to ${workerCount} workers on ports ${workerBasePort}-${
        workerBasePort + workerCount - 1
      }`,
    );
  });
}

// Only run the load balancer if this file is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startLoadBalancer().catch((err) => {
    console.error("Error starting load balancer:", err);
    process.exit(1);
  });
}

export { startLoadBalancer };
