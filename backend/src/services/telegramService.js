/**
 * Telegram Bot service.
 * Handles sending messages and notifications via the Telegram bot.
 * Falls back gracefully if the bot token is not configured.
 */

const User = require('../models/User');

class TelegramService {
  constructor() {
    this.bot = null;
    this.enabled = false;
    this.init();
  }

  init() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.log('[TelegramService] No TELEGRAM_BOT_TOKEN set. Telegram integration disabled.');
      return;
    }

    try {
      const TelegramBot = require('node-telegram-bot-api');

      const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
      if (webhookUrl) {
        // Production: use webhook
        this.bot = new TelegramBot(token, { webHook: false });
        this.bot.setWebHook(`${webhookUrl}`);
        console.log(`✅ Telegram bot webhook set: ${webhookUrl}`);
      } else {
        // Development: use polling
        this.bot = new TelegramBot(token, { polling: true });
        console.log('✅ Telegram bot running with polling');
      }

      this.enabled = true;
      this.setupPollingHandlers();
    } catch (err) {
      console.error('[TelegramService] Failed to init bot:', err.message);
    }
  }

  /**
   * Set up polling-mode handlers (used in dev when no webhook).
   * In production, handlers are in the /api/telegram/webhook route.
   */
  setupPollingHandlers() {
    if (!this.bot || process.env.TELEGRAM_WEBHOOK_URL) return;

    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id.toString();
      await this.sendMessage(chatId,
        `👋 Welcome to Chatterbox Bot!\n\nTo link your account:\n1. Go to Chatterbox Settings\n2. Click "Link Telegram"\n3. Send me: /link YOUR_CODE\n\nCommands:\n/link <code>\n/unlink\n/messages\n/reply <n> <text>`
      );
    });

    this.bot.onText(/\/link (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const code = match[1].trim();

      const user = await User.findOne({
        'telegram.linkCode': code,
        'telegram.linkCodeExpires': { $gt: Date.now() },
      });

      if (!user) {
        await this.sendMessage(chatId, '❌ Invalid or expired code. Please generate a new one in Chatterbox settings.');
        return;
      }

      user.telegram.chatId = chatId;
      user.telegram.username = msg.from.username || msg.from.first_name;
      user.telegram.isLinked = true;
      user.telegram.linkCode = undefined;
      user.telegram.linkCodeExpires = undefined;
      await user.save({ validateBeforeSave: false });

      await this.sendMessage(chatId,
        `✅ Successfully linked to Chatterbox account: *${user.displayName}* (@${user.username})`,
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.onText(/\/unlink/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const user = await User.findOne({ 'telegram.chatId': chatId });

      if (!user) {
        await this.sendMessage(chatId, 'No account linked to this Telegram chat.');
        return;
      }

      user.telegram.chatId = null;
      user.telegram.isLinked = false;
      await user.save({ validateBeforeSave: false });
      await this.sendMessage(chatId, '✅ Account unlinked from Chatterbox.');
    });
  }

  async sendMessage(chatId, text, options = {}) {
    if (!this.bot || !chatId) return;
    try {
      return await this.bot.sendMessage(chatId, text, options);
    } catch (err) {
      console.error('[TelegramService] sendMessage error:', err.message);
    }
  }

  /**
   * Notify a user about a new message (if their Telegram is linked).
   */
  async notifyNewMessage(userId, senderName, preview) {
    if (!this.enabled) return;
    try {
      const user = await User.findById(userId).select('telegram status');
      if (!user?.telegram?.isLinked || !user?.telegram?.chatId) return;
      if (user.status === 'online') return; // Don't notify if they're online

      await this.sendMessage(
        user.telegram.chatId,
        `📩 *New message from ${senderName}*\n${preview.slice(0, 100)}${preview.length > 100 ? '...' : ''}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[TelegramService] notifyNewMessage error:', err.message);
    }
  }

  /**
   * Notify a user about a friend request.
   */
  async notifyFriendRequest(userId, fromName) {
    if (!this.enabled) return;
    try {
      const user = await User.findById(userId).select('telegram');
      if (!user?.telegram?.isLinked || !user?.telegram?.chatId) return;

      await this.sendMessage(
        user.telegram.chatId,
        `👥 *${fromName}* sent you a friend request on Chatterbox!\n\nOpen the app to accept or decline.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[TelegramService] notifyFriendRequest error:', err.message);
    }
  }
}

const telegramService = new TelegramService();
module.exports = telegramService;
