// @format

module.exports = {
  apps: [
    {
      name: "kiwinews",
      script: "./src/launch.mjs",
      // max_memory_restart: "XXXXM", enable to let pm2 restart the app when reaching the memory limit
      env: {
        DEBUG: "*attestate*",
        NODE_ENV: "production",
        NODE_PATH: "./node_modules",
        THEME: "kiwi",
        HTTP_PORT: 3000,
        API_PORT: 8443,
        DATA_DIR: "bootstrap",
        BIND_ADDRESS_V4: "0.0.0.0",
        IS_BOOTSTRAP_NODE: false,
        USE_EPHEMERAL_ID: false,
      },
      time: true,
      node_args: "-r dotenv/config --max-old-space-size=12288",
    },
  ],
};
