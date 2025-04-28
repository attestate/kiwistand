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
    // --- Telegram Bot Processes (Staggered & Generic) ---
    {
      name: "kiwinews-telegram-bot-0", // Generic name
      script: "./src/telegram_bot.mjs",
      // Run every 18 mins (0, 18, 36, 54) during 18:00-07:59 server time
      cron_restart: "0,18,36,54 18-23,0-7 * * *",
      autorestart: false,
      node_args: "-r dotenv/config",
      env: {
        NODE_PATH: "./node_modules",
        NODE_ENV: "production",
        PROCESS_INDEX: 0, // Pass index instead of channel name
        // Other keys (BOT_PRIVATE_KEY, ANTHROPIC_API_KEY, CACHE_DIR) from .env
      },
    },
    {
      name: "kiwinews-telegram-bot-1", // Generic name
      script: "./src/telegram_bot.mjs",
      // Run every 18 mins, offset by 5 (5, 23, 41, 59) during 18:00-07:59 server time
      cron_restart: "5,23,41,59 18-23,0-7 * * *",
      autorestart: false,
      node_args: "-r dotenv/config",
      env: {
        NODE_PATH: "./node_modules",
        NODE_ENV: "production",
        PROCESS_INDEX: 1, // Pass index instead of channel name
        // Other keys from .env
      },
    },
    {
      name: "kiwinews-telegram-bot-2", // Generic name
      script: "./src/telegram_bot.mjs",
      // Run every 18 mins, offset by 10 (10, 28, 46) during 18:00-07:59 server time
      cron_restart: "10,28,46 18-23,0-7 * * *",
      autorestart: false,
      node_args: "-r dotenv/config",
      env: {
        NODE_PATH: "./node_modules",
        NODE_ENV: "production",
        PROCESS_INDEX: 2, // Pass index instead of channel name
        // Other keys from .env
      },
    },
  ],
};
