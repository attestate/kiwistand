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
        WORKER_COUNT: 8,
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
        WORKER_COUNT: 8,
      },
      node_args: "-r dotenv/config --max-old-space-size=4096",
    },
  ],
};
