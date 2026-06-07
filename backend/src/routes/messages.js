/**
 * Channel message routes
 * GET    /api/messages/:channelId         – paginated messages
 * POST   /api/messages/:channelId         – send message
 * PATCH  /api/messages/:channelId/:msgId  – edit message
 * DELETE /api/messages/:channelId/:msgId  – soft-delete message
 * POST   /api/messages/:msgId/react       – add/remove reaction
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Message = require('../models/Message');
const Channel = require('../models/Channel');
const Server = require('../models/Server');
const { protect } = require('../middleware/auth');
const { uploadAttachment } = require('../middleware/upload');

const router = express.Router();
router.use(protect);

const PAGE_SIZE = 50;

// ─── Helper – verify channel membership ──────────────────────────────────────
const verifyMembership = async (channelId, userId) => {
  const channel = await Channel.findById(channelId);
  if (!channel) return { error: 'Channel not found', status: 404 };
  const server = await Server.findById(channel.server);
  if (!server) return { error: 'Server not found', status: 404 };
  const isMember = server.members.some((m) => m.user.toString() === userId.toString());
  if (!isMember) return { error: 'Not a member of this server', status: 403 };
  return { channel, server };
};

// ─── GET /api/messages/:channelId ────────────────────────────────────────────
router.get(
  '/:channelId',
  [query('before').optional().isMongoId(), query('limit').optional().isInt({ min: 1, max: 100 })],
  async (req, res, next) => {
    try {
      const { channel, error, status } = await verifyMembership(req.params.channelId, req.user._id);
      if (error) return res.status(status).json({ error });

      const { before, limit = PAGE_SIZE } = req.query;
      const filter = { channel: channel._id, isDeleted: false };
      if (before) filter._id = { $lt: before };

      const messages = await Message.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit, 10))
        .populate('author', 'username displayName avatar avatarUrl status')
        .populate('replyTo', 'content author')
        .lean();

      res.json({ messages: messages.reverse(), hasMore: messages.length === parseInt(limit, 10) });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/messages/:channelId ───────────────────────────────────────────
router.post(
  '/:channelId',
  uploadAttachment,
  [body('content').optional().trim().isLength({ max: 4000 })],
  async (req, res, next) => {
    try {
      const { channel, error, status } = await verifyMembership(req.params.channelId, req.user._id);
      if (error) return res.status(status).json({ error });

      const { content, replyTo } = req.body;

      if (!content && !req.file) {
        return res.status(400).json({ error: 'Message must have content or an attachment' });
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
        channel: channel._id,
        attachments,
        replyTo: replyTo || null,
      });

      await message.populate('author', 'username displayName avatar avatarUrl status');
      if (replyTo) await message.populate('replyTo', 'content author');

      // Update channel's lastMessageAt
      await Channel.findByIdAndUpdate(channel._id, { lastMessageAt: new Date() });

      // Broadcast via Socket.io
      req.app.get('io')?.to(`channel:${channel._id}`).emit('message:new', { message });

      res.status(201).json({ message });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/messages/:channelId/:msgId ───────────────────────────────────
router.patch(
  '/:channelId/:msgId',
  [body('content').trim().isLength({ min: 1, max: 4000 }).withMessage('Content is required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const message = await Message.findById(req.params.msgId);
      if (!message) return res.status(404).json({ error: 'Message not found' });
      if (message.author.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Cannot edit another user\'s message' });
      }
      if (message.isDeleted) return res.status(400).json({ error: 'Cannot edit a deleted message' });

      // Save edit history
      message.editHistory.push({ content: message.content });
      message.content = req.body.content;
      message.isEdited = true;
      await message.save();

      await message.populate('author', 'username displayName avatar avatarUrl');

      req.app.get('io')?.to(`channel:${message.channel}`).emit('message:updated', { message });

      res.json({ message });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /api/messages/:channelId/:msgId ──────────────────────────────────
router.delete('/:channelId/:msgId', async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.msgId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const { server } = await verifyMembership(req.params.channelId, req.user._id);
    const member = server?.members.find((m) => m.user.toString() === req.user._id.toString());
    const canDelete =
      message.author.toString() === req.user._id.toString() ||
      (member && ['owner', 'admin', 'moderator'].includes(member.role));

    if (!canDelete) return res.status(403).json({ error: 'Cannot delete this message' });

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    req.app.get('io')?.to(`channel:${message.channel}`).emit('message:deleted', {
      messageId: message._id,
      channelId: message.channel,
    });

    res.json({ message: 'Message deleted' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/messages/:msgId/react ─────────────────────────────────────────
router.post('/:msgId/react', async (req, res, next) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

    const message = await Message.findById(req.params.msgId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const existing = message.reactions.find((r) => r.emoji === emoji);
    if (existing) {
      const userIdx = existing.users.indexOf(req.user._id);
      if (userIdx > -1) {
        existing.users.splice(userIdx, 1);
        if (existing.users.length === 0) {
          message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
        }
      } else {
        existing.users.push(req.user._id);
      }
    } else {
      message.reactions.push({ emoji, users: [req.user._id] });
    }

    await message.save();

    req.app.get('io')
      ?.to(`channel:${message.channel}`)
      .emit('message:reaction', { messageId: message._id, reactions: message.reactions });

    res.json({ reactions: message.reactions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
