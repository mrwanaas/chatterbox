/**
 * Server routes
 * GET    /api/servers              – user's servers
 * POST   /api/servers              – create server
 * GET    /api/servers/:id          – get server details
 * PATCH  /api/servers/:id          – update server
 * DELETE /api/servers/:id          – delete server
 * POST   /api/servers/:id/join     – join via invite code
 * POST   /api/servers/:id/leave    – leave server
 * POST   /api/servers/:id/invite   – generate invite link
 * GET    /api/servers/join/:code   – get server info from invite code
 * PATCH  /api/servers/:id/members/:userId – update member role
 * DELETE /api/servers/:id/members/:userId – kick member
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const Server = require('../models/Server');
const Channel = require('../models/Channel');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { uploadServerIcon } = require('../middleware/upload');

const router = express.Router();
router.use(protect);

// ─── GET /api/servers ─────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const servers = await Server.find({ 'members.user': req.user._id })
      .select('name icon inviteCode owner members createdAt')
      .populate('owner', 'username displayName avatar avatarUrl');
    res.json({ servers });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/servers ────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Server name is required (max 100 chars)'),
    body('description').optional().trim().isLength({ max: 500 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { name, description } = req.body;

      const server = await Server.create({
        name,
        description,
        owner: req.user._id,
        inviteCode: uuidv4().slice(0, 8),
        members: [{ user: req.user._id, role: 'owner' }],
      });

      // Create default channels
      await Channel.create([
        { name: 'general', type: 'text', server: server._id, position: 0 },
        { name: 'general', type: 'voice', server: server._id, position: 1 },
      ]);

      // Add server to user's server list
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { servers: server._id } });

      const populated = await Server.findById(server._id).populate(
        'owner',
        'username displayName avatar avatarUrl'
      );
      res.status(201).json({ server: populated });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/servers/join/:code ─────────────────────────────────────────────
router.get('/join/:code', async (req, res, next) => {
  try {
    const server = await Server.findOne({ inviteCode: req.params.code })
      .select('name icon memberCount owner')
      .populate('owner', 'username displayName avatar avatarUrl');
    if (!server) return res.status(404).json({ error: 'Invalid invite code' });

    res.json({ server });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/servers/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id)
      .populate('owner', 'username displayName avatar avatarUrl')
      .populate('members.user', 'username displayName avatar status avatarUrl');

    if (!server) return res.status(404).json({ error: 'Server not found' });

    const isMember = server.members.some((m) => m.user._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ error: 'You are not a member of this server' });

    const channels = await Channel.find({ server: server._id }).sort('position');
    res.json({ server, channels });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/servers/:id ───────────────────────────────────────────────────
router.patch('/:id', uploadServerIcon, async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const member = server.members.find((m) => m.user.toString() === req.user._id.toString());
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, isPublic } = req.body;
    if (name) server.name = name;
    if (description !== undefined) server.description = description;
    if (isPublic !== undefined) server.isPublic = isPublic === 'true';
    if (req.file) {
      server.icon = `${req.protocol}://${req.get('host')}/uploads/server-icons/${req.file.filename}`;
    }

    await server.save();
    res.json({ server });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/servers/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    if (server.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the owner can delete the server' });
    }

    await Channel.deleteMany({ server: server._id });
    await User.updateMany({ servers: server._id }, { $pull: { servers: server._id } });
    await server.deleteOne();

    res.json({ message: 'Server deleted' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/servers/join/:code ────────────────────────────────────────────
router.post('/join/:code', async (req, res, next) => {
  try {
    const server = await Server.findOne({ inviteCode: req.params.code });
    if (!server) return res.status(404).json({ error: 'Invalid invite code' });

    const isMember = server.members.some((m) => m.user.toString() === req.user._id.toString());
    if (isMember) return res.status(409).json({ error: 'Already a member' });

    server.members.push({ user: req.user._id, role: 'member' });
    await server.save();
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { servers: server._id } });

    const channels = await Channel.find({ server: server._id }).sort('position');
    await server.populate('owner', 'username displayName avatar avatarUrl');

    // Notify server members
    req.app.get('io')?.to(`server:${server._id}`).emit('server:memberJoined', {
      serverId: server._id,
      user: req.user,
    });

    res.json({ server, channels });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/servers/:id/leave ─────────────────────────────────────────────
router.post('/:id/leave', async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    if (server.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Owner cannot leave. Transfer ownership or delete the server.' });
    }

    server.members = server.members.filter((m) => m.user.toString() !== req.user._id.toString());
    await server.save();
    await User.findByIdAndUpdate(req.user._id, { $pull: { servers: server._id } });

    res.json({ message: 'Left server' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/servers/:id/invite ────────────────────────────────────────────
router.post('/:id/invite', async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const isMember = server.members.some((m) => m.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    // Optionally regenerate invite code
    if (req.body.regenerate) {
      server.inviteCode = uuidv4().slice(0, 8);
      await server.save();
    }

    const inviteUrl = `${process.env.CLIENT_URL}/invite/${server.inviteCode}`;
    res.json({ inviteCode: server.inviteCode, inviteUrl });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/servers/:id/members/:userId ──────────────────────────────────
router.patch('/:id/members/:userId', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'moderator', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const requester = server.members.find((m) => m.user.toString() === req.user._id.toString());
    if (!requester || requester.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can change roles' });
    }

    const member = server.members.find((m) => m.user.toString() === req.params.userId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    member.role = role;
    await server.save();

    res.json({ message: 'Role updated', member });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/servers/:id/members/:userId ──────────────────────────────────
router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const requester = server.members.find((m) => m.user.toString() === req.user._id.toString());
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    server.members = server.members.filter((m) => m.user.toString() !== req.params.userId);
    await server.save();
    await User.findByIdAndUpdate(req.params.userId, { $pull: { servers: server._id } });

    req.app.get('io')?.to(`user:${req.params.userId}`).emit('server:kicked', { serverId: server._id });

    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
