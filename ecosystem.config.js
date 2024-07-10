// @format

module.exports = {
  apps: [
    {
      name: "kiwinews",
      script: "npm run start",
      env: {
        DEBUG: "*attestate*",
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
      time: true,
    },
  ],
};
