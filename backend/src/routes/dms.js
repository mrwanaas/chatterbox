/**
 * Direct Message routes
 * GET    /api/dms                    – list DM conversations
 * POST   /api/dms                    – create or get DM with a user
 * POST   /api/dms/group              – create group DM
 * GET    /api/dms/:chatId/messages   – paginated messages
 * POST   /api/dms/:chatId/messages   – send message
 * PATCH  /api/dms/:chatId/messages/:msgId  – edit message
 * DELETE /api/dms/:chatId/messages/:msgId  – delete message
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { DirectChat } = require('../models/Relations');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');
const { uploadAttachment } = require('../middleware/upload');

const router = express.Router();
router.use(protect);

const PAGE_SIZE = 50;

// ─── GET /api/dms ─────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const chats = await DirectChat.find({ participants: req.user._id })
      .populate('participants', 'username displayName avatar status avatarUrl')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });

    res.json({ chats });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/dms ────────────────────────────────────────────────────────────
router.post(
  '/',
  [body('userId').isMongoId().withMessage('Valid user ID required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      if (req.body.userId === req.user._id.toString()) {
        return res.status(400).json({ error: 'Cannot create DM with yourself' });
      }

      // Find or create DM
      let chat = await DirectChat.findOne({
        isGroup: false,
        participants: { $all: [req.user._id, req.body.userId], $size: 2 },
      }).populate('participants', 'username displayName avatar status avatarUrl');

      if (!chat) {
        chat = await DirectChat.create({
          participants: [req.user._id, req.body.userId],
          isGroup: false,
        });
        await chat.populate('participants', 'username displayName avatar status avatarUrl');
      }

      res.json({ chat });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/dms/group ─────────────────────────────────────────────────────
router.post(
  '/group',
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Group name is required'),
    body('userIds').isArray({ min: 1 }).withMessage('At least one participant required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { name, userIds } = req.body;
      const participants = [...new Set([req.user._id.toString(), ...userIds])];

      const chat = await DirectChat.create({
        name,
        participants,
        isGroup: true,
        owner: req.user._id,
      });

      await chat.populate('participants', 'username displayName avatar status avatarUrl');

      // Notify participants
      participants.forEach((uid) => {
        if (uid !== req.user._id.toString()) {
          req.app.get('io')?.to(`user:${uid}`).emit('dm:new', { chat });
        }
      });

      res.status(201).json({ chat });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/dms/:chatId/messages ───────────────────────────────────────────
router.get('/:chatId/messages', async (req, res, next) => {
  try {
    const chat = await DirectChat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const isMember = chat.participants.some((p) => p.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ error: 'Not a participant' });

    const { before, limit = PAGE_SIZE } = req.query;
    const filter = { dmChat: chat._id };
    if (before) filter._id = { $lt: before };

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .populate('author', 'username displayName avatar avatarUrl status')
      .populate('replyTo', 'content author')
      .lean();

    // Mark messages as read
    const unread = messages
      .filter((m) => !m.readBy?.some((r) => r.user.toString() === req.user._id.toString()))
      .map((m) => m._id);

    if (unread.length) {
      await Message.updateMany(
        { _id: { $in: unread } },
        { $addToSet: { readBy: { user: req.user._id, readAt: new Date() } } }
      );
    }

    res.json({ messages: messages.reverse(), hasMore: messages.length === parseInt(limit, 10) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/dms/:chatId/messages ──────────────────────────────────────────
router.post('/:chatId/messages', uploadAttachment, async (req, res, next) => {
  try {
    const chat = await DirectChat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const isMember = chat.participants.some((p) => p.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ error: 'Not a participant' });

    const { content, replyTo } = req.body;
    if (!content && !req.file) {
      return res.status(400).json({ error: 'Message must have content or attachment' });
    }

    const attachments = req.file
      ? [
          {
            url: `${req.protocol}://${req.get('host')}/uploads/attachments/${req.file.filename}`,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          },
        ]
      : [];

    const message = await Message.create({
      content: content || '',
      author: req.user._id,
      dmChat: chat._id,
      attachments,
      replyTo: replyTo || null,
      readBy: [{ user: req.user._id }],
    });

    await message.populate('author', 'username displayName avatar avatarUrl status');

    chat.lastMessage = message._id;
    chat.lastMessageAt = new Date();
    await chat.save();

    // Broadcast to all participants in the DM room
    req.app.get('io')?.to(`dm:${chat._id}`).emit('message:new', { message, chatId: chat._id });

    // Notify offline participants via Telegram if configured
    chat.participants.forEach(async (participantId) => {
      if (participantId.toString() !== req.user._id.toString()) {
        try {
          const { telegramService } = require('../services/telegramService');
          await telegramService?.notifyNewMessage(
            participantId.toString(),
            req.user.displayName,
            content || '[Attachment]'
          );
        } catch { /* Non-critical */ }
      }
    });

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/dms/:chatId/messages/:msgId ───────────────────────────────────
router.patch('/:chatId/messages/:msgId', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    const message = await Message.findOne({ _id: req.params.msgId, dmChat: req.params.chatId });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Cannot edit another user\'s message' });
    }

    message.editHistory.push({ content: message.content });
    message.content = content.trim();
    message.isEdited = true;
    await message.save();
    await message.populate('author', 'username displayName avatar avatarUrl');

    req.app.get('io')?.to(`dm:${req.params.chatId}`).emit('message:updated', { message });

    res.json({ message });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/dms/:chatId/messages/:msgId ──────────────────────────────────
router.delete('/:chatId/messages/:msgId', async (req, res, next) => {
  try {
    const message = await Message.findOne({ _id: req.params.msgId, dmChat: req.params.chatId });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Cannot delete another user\'s message' });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    req.app.get('io')?.to(`dm:${req.params.chatId}`).emit('message:deleted', {
      messageId: message._id,
      chatId: req.params.chatId,
    });

    res.json({ message: 'Message deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
