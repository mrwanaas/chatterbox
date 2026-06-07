/**
 * Friend routes
 * GET    /api/friends              – list friends
 * GET    /api/friends/requests     – pending incoming/outgoing requests
 * POST   /api/friends/request      – send a friend request
 * PATCH  /api/friends/request/:id  – accept or decline
 * DELETE /api/friends/:userId      – remove a friend
 * POST   /api/friends/block/:userId
 * DELETE /api/friends/block/:userId
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { FriendRequest, Friendship } = require('../models/Relations');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ─── GET /api/friends ─────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const friendships = await Friendship.find({ users: req.user._id }).populate(
      'users',
      'username displayName avatar status customStatus avatarUrl lastSeen'
    );

    const friends = friendships.map((f) =>
      f.users.find((u) => u._id.toString() !== req.user._id.toString())
    );

    res.json({ friends });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/friends/requests ────────────────────────────────────────────────
router.get('/requests', async (req, res, next) => {
  try {
    const [incoming, outgoing] = await Promise.all([
      FriendRequest.find({ receiver: req.user._id, status: 'pending' }).populate(
        'sender',
        'username displayName avatar avatarUrl status'
      ),
      FriendRequest.find({ sender: req.user._id, status: 'pending' }).populate(
        'receiver',
        'username displayName avatar avatarUrl status'
      ),
    ]);

    res.json({ incoming, outgoing });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/friends/request ────────────────────────────────────────────────
router.post(
  '/request',
  [
    body('identifier')
      .trim()
      .notEmpty()
      .withMessage('Username or email is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { identifier } = req.body;

      // Find target user by username or email
      const targetUser = await User.findOne({
        $or: [
          { username: identifier },
          { email: identifier.toLowerCase() },
        ],
        _id: { $ne: req.user._id },
      });

      if (!targetUser) return res.status(404).json({ error: 'User not found' });

      // Check if blocked
      if (
        req.user.blockedUsers?.includes(targetUser._id) ||
        targetUser.blockedUsers?.includes(req.user._id)
      ) {
        return res.status(403).json({ error: 'Cannot send friend request to this user' });
      }

      // Check if already friends
      const existingFriendship = await Friendship.findOne({ users: { $all: [req.user._id, targetUser._id] } });
      if (existingFriendship) return res.status(409).json({ error: 'Already friends' });

      // Check for existing request
      const existingRequest = await FriendRequest.findOne({
        $or: [
          { sender: req.user._id, receiver: targetUser._id },
          { sender: targetUser._id, receiver: req.user._id },
        ],
        status: 'pending',
      });
      if (existingRequest) return res.status(409).json({ error: 'Friend request already exists' });

      const request = await FriendRequest.create({
        sender: req.user._id,
        receiver: targetUser._id,
      });

      await request.populate('sender', 'username displayName avatar avatarUrl status');

      // Emit real-time notification
      req.app.get('io')?.to(`user:${targetUser._id}`).emit('friend:request', { request });

      res.status(201).json({ request });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/friends/request/:id ──────────────────────────────────────────
router.patch('/request/:id', async (req, res, next) => {
  try {
    const { action } = req.body; // 'accept' or 'decline'
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accept or decline' });
    }

    const request = await FriendRequest.findOne({
      _id: req.params.id,
      receiver: req.user._id,
      status: 'pending',
    });

    if (!request) return res.status(404).json({ error: 'Friend request not found' });

    request.status = action === 'accept' ? 'accepted' : 'declined';
    await request.save();

    if (action === 'accept') {
      await Friendship.create({ users: [request.sender, request.receiver] });

      // Notify sender
      req.app.get('io')?.to(`user:${request.sender}`).emit('friend:accepted', {
        userId: req.user._id,
      });
    }

    res.json({ message: `Friend request ${action}ed`, request });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/friends/:userId ──────────────────────────────────────────────
router.delete('/:userId', async (req, res, next) => {
  try {
    await Friendship.findOneAndDelete({
      users: { $all: [req.user._id, req.params.userId] },
    });

    req.app.get('io')?.to(`user:${req.params.userId}`).emit('friend:removed', {
      userId: req.user._id,
    });

    res.json({ message: 'Friend removed' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/friends/block/:userId ─────────────────────────────────────────
router.post('/block/:userId', async (req, res, next) => {
  try {
    const targetId = req.params.userId;
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: targetId },
    });

    // Remove friendship if it exists
    await Friendship.findOneAndDelete({ users: { $all: [req.user._id, targetId] } });
    // Cancel pending requests
    await FriendRequest.deleteMany({
      $or: [
        { sender: req.user._id, receiver: targetId },
        { sender: targetId, receiver: req.user._id },
      ],
    });

    res.json({ message: 'User blocked' });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/friends/block/:userId ───────────────────────────────────────
router.delete('/block/:userId', async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: req.params.userId },
    });
    res.json({ message: 'User unblocked' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
