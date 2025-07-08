import { env } from "process";
import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(env.TG_KEY, { polling: false });

const channelId = "-1001902081637"; // Kiwi News TG channel with 500 members

export async function sendToChannel(message) {
  try {
    await bot.sendMessage(channelId, message, { 
      disable_web_page_preview: false 
    });
    return { success: true };
  } catch (error) {
    console.error("Error sending to Telegram channel:", error);
    return { success: false, error: error.message };
  }
}