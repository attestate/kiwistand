// @format

module.exports = {
  apps: [
    {
      name: "kiwinews-load-balancer",
      script: "npm",
      args: "run start:load-balancer",
      env: {
        NODE_PATH: "./node_modules",
        NODE_ENV: "production",
        HTTP_PORT: "3000",
      },
    },
    {
      name: "kiwinews-primary",
      script: "./src/launch.mjs",
      env: {
        NODE_PATH: "./node_modules",
        NODE_ENV: "production",
        THEME: "kiwi",
        HTTP_PORT: 3000,
        API_PORT: 8443,
        DATA_DIR: "bootstrap",
        BIND_ADDRESS_V4: "0.0.0.0",
        IS_BOOTSTRAP_NODE: true,
        USE_EPHEMERAL_ID: false,
        SSL_CERT_PATH: "/etc/letsencrypt/live/news.kiwistand.com/fullchain.pem",
        SSL_KEY_PATH: "/etc/letsencrypt/live/news.kiwistand.com/privkey.pem",
      },
      node_args: "-r dotenv/config --max-old-space-size=4096",
    },
    {
      name: "kiwinews-fid-labeling",
      script: "./src/fid-labeling-service.mjs",
      env: {
        NODE_PATH: "./node_modules",
        NODE_ENV: "production",
        DATA_DIR: "bootstrap",
        FID_LABELING_INTERVAL_HOURS: "6", // Run every 6 hours
      },
      node_args: "-r dotenv/config",
      // Restart if it crashes, but not more than 10 times in 10 minutes
      max_restarts: 10,
      min_uptime: "10m",
    },
  ],
};
