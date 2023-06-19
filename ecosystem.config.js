// @format

module.exports = {
  apps: [
    {
      name: "kiwinews",
      script: "npm run start",
      env: {
        THEME_COLOR:"limegreen",
        THEME_EMOJI: "🥝",
        THEME_NAME: "Kiwi News",
        DEBUG: "*attestate*",
        NODE_ENV: "production",
        THEME: "kiwi",
        HTTP_PORT: 3000,
        API_PORT: 8000,
        DATA_DIR: "bootstrap",
        BIND_ADDRESS_V4: "0.0.0.0",
        IS_BOOTSTRAP_NODE: true,
        USE_EPHEMERAL_ID: false,
        SSL_CERT_PATH: "/etc/letsencrypt/live/news.kiwistand.com/fullchain.pem",
        SSL_KEY_PATH: "/etc/letsencrypt/live/news.kiwistand.com/privkey.pem"

      },
      time: true
    },
  ]
};
