/**
 * Channel routes
 * GET    /api/channels/:serverId        – list channels in server
 * POST   /api/channels/:serverId        – create channel
 * PATCH  /api/channels/:id             – update channel
 * DELETE /api/channels/:id             – delete channel
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const Channel = require('../models/Channel');
const Server = require('../models/Server');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ─── Helper – check membership + minimum role ─────────────────────────────────
const getMember = (server, userId) =>
  server.members.find((m) => m.user.toString() === userId.toString());

// ─── GET /api/channels/:serverId ─────────────────────────────────────────────
router.get('/:serverId', async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const member = getMember(server, req.user._id);
    if (!member) return res.status(403).json({ error: 'Not a member of this server' });

    const channels = await Channel.find({ server: server._id }).sort('position');
    res.json({ channels });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/channels/:serverId ────────────────────────────────────────────
router.post(
  '/:serverId',
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Channel name is required'),
    body('type').isIn(['text', 'voice']).withMessage('Type must be text or voice'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const server = await Server.findById(req.params.serverId);
      if (!server) return res.status(404).json({ error: 'Server not found' });

      const member = getMember(server, req.user._id);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { name, type, description } = req.body;
      const count = await Channel.countDocuments({ server: server._id });

      const channel = await Channel.create({
        name,
        type,
        description,
        server: server._id,
        position: count,
      });

      req.app.get('io')?.to(`server:${server._id}`).emit('channel:created', { channel });

      res.status(201).json({ channel });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/channels/:id ──────────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const server = await Server.findById(channel.server);
    const member = getMember(server, req.user._id);
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, isNsfw, slowMode, position } = req.body;
    if (name !== undefined) channel.name = name;
    if (description !== undefined) channel.description = description;
    if (isNsfw !== undefined) channel.isNsfw = isNsfw;
    if (slowMode !== undefined) channel.slowMode = slowMode;
    if (position !== undefined) channel.position = position;

    await channel.save();

    req.app.get('io')?.to(`server:${server._id}`).emit('channel:updated', { channel });

    res.json({ channel });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/channels/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const server = await Server.findById(channel.server);
    const member = getMember(server, req.user._id);
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await channel.deleteOne();

    req.app.get('io')?.to(`server:${server._id}`).emit('channel:deleted', { channelId: channel._id });

    res.json({ message: 'Channel deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
