/**
 * Telegram integration routes
 * POST /api/telegram/webhook  – Telegram webhook endpoint
 * POST /api/telegram/send     – Send a message via bot (internal use)
 */

const express = require('express');
const User = require('../models/User');
const { DirectChat } = require('../models/Relations');
const Message = require('../models/Message');
const telegramService = require('../services/telegramService');

const router = express.Router();

// ─── POST /api/telegram/webhook ──────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    const update = req.body;

    if (!update.message) return res.sendStatus(200);

    const { text, chat, from } = update.message;
    const chatId = chat.id.toString();

    if (!text) return res.sendStatus(200);

    // ── /start ──────────────────────────────────────────────────────────────
    if (text === '/start') {
      await telegramService.sendMessage(chatId,
        `👋 Welcome to Chatterbox Bot!\n\n` +
        `To link your account, go to Settings in the Chatterbox app and click "Link Telegram". ` +
        `Then send me the 6-digit code with the command:\n\n/link YOUR_CODE\n\n` +
        `Commands:\n` +
        `/link <code>     - Link your account\n` +
        `/unlink          - Unlink your account\n` +
        `/messages        - View unread messages\n` +
        `/reply <id> <text> - Reply to a DM`
      );
      return res.sendStatus(200);
    }

    // ── /link <code> ─────────────────────────────────────────────────────────
    if (text.startsWith('/link ')) {
      const code = text.replace('/link ', '').trim();
      const user = await User.findOne({
        'telegram.linkCode': code,
        'telegram.linkCodeExpires': { $gt: Date.now() },
      });

      if (!user) {
        await telegramService.sendMessage(chatId, '❌ Invalid or expired code. Generate a new one from the Chatterbox app settings.');
        return res.sendStatus(200);
      }

      user.telegram.chatId = chatId;
      user.telegram.username = from.username || from.first_name;
      user.telegram.isLinked = true;
      user.telegram.linkCode = undefined;
      user.telegram.linkCodeExpires = undefined;
      await user.save({ validateBeforeSave: false });

      await telegramService.sendMessage(chatId,
        `✅ Account linked successfully! You'll now receive notifications here.\n\n` +
        `Linked to: ${user.displayName} (@${user.username})`
      );
      return res.sendStatus(200);
    }

    // ── /unlink ──────────────────────────────────────────────────────────────
    if (text === '/unlink') {
      const user = await User.findOne({ 'telegram.chatId': chatId });
      if (!user) {
        await telegramService.sendMessage(chatId, 'No Chatterbox account is linked to this Telegram chat.');
        return res.sendStatus(200);
      }

      user.telegram.chatId = null;
      user.telegram.username = null;
      user.telegram.isLinked = false;
      await user.save({ validateBeforeSave: false });

      await telegramService.sendMessage(chatId, '✅ Your Chatterbox account has been unlinked.');
      return res.sendStatus(200);
    }

    // ── /messages ────────────────────────────────────────────────────────────
    if (text === '/messages') {
      const user = await User.findOne({ 'telegram.chatId': chatId });
      if (!user) {
        await telegramService.sendMessage(chatId, 'Please link your account first with /link <code>');
        return res.sendStatus(200);
      }

      const chats = await DirectChat.find({ participants: user._id })
        .populate('lastMessage')
        .populate('participants', 'displayName')
        .sort({ lastMessageAt: -1 })
        .limit(10);

      if (!chats.length) {
        await telegramService.sendMessage(chatId, 'No conversations found.');
        return res.sendStatus(200);
      }

      const lines = chats.map((c, i) => {
        const other = c.participants.find((p) => p._id.toString() !== user._id.toString());
        const name = c.isGroup ? c.name : (other?.displayName || 'Unknown');
        const preview = c.lastMessage?.content?.slice(0, 50) || '[Attachment]';
        return `${i + 1}. *${name}*: ${preview}`;
      });

      await telegramService.sendMessage(chatId,
        `📬 Your recent conversations:\n\n${lines.join('\n')}\n\nUse /reply <chat_number> <message> to reply.`,
        { parse_mode: 'Markdown' }
      );
      return res.sendStatus(200);
    }

    // ── /reply <id> <text> ───────────────────────────────────────────────────
    if (text.startsWith('/reply ')) {
      const user = await User.findOne({ 'telegram.chatId': chatId });
      if (!user) {
        await telegramService.sendMessage(chatId, 'Please link your account first with /link <code>');
        return res.sendStatus(200);
      }

      const parts = text.split(' ');
      const chatIndex = parseInt(parts[1], 10) - 1;
      const replyContent = parts.slice(2).join(' ');

      if (isNaN(chatIndex) || !replyContent) {
        await telegramService.sendMessage(chatId, 'Usage: /reply <chat_number> <your message>');
        return res.sendStatus(200);
      }

      const chats = await DirectChat.find({ participants: user._id })
        .sort({ lastMessageAt: -1 })
        .limit(10);

      const targetChat = chats[chatIndex];
      if (!targetChat) {
        await telegramService.sendMessage(chatId, 'Invalid chat number. Use /messages to see your chats.');
        return res.sendStatus(200);
      }

      const message = await Message.create({
        content: replyContent,
        author: user._id,
        dmChat: targetChat._id,
        readBy: [{ user: user._id }],
      });

      await message.populate('author', 'username displayName avatar avatarUrl');

      targetChat.lastMessage = message._id;
      targetChat.lastMessageAt = new Date();
      await targetChat.save();

      // Broadcast via socket
      const io = require('../server').httpServer?._events?.request?._router;
      global.io?.to(`dm:${targetChat._id}`).emit('message:new', { message, chatId: targetChat._id });

      await telegramService.sendMessage(chatId, '✅ Message sent!');
      return res.sendStatus(200);
    }

    // Unknown command
    await telegramService.sendMessage(chatId,
      'Unknown command. Available commands:\n/start /link /unlink /messages /reply'
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('Telegram webhook error:', err);
    res.sendStatus(500);
  }
});

module.exports = router;
