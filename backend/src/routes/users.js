/**
 * User routes
 * GET    /api/users/search
 * GET    /api/users/:id
 * PATCH  /api/users/me
 * POST   /api/users/me/avatar
 * PATCH  /api/users/me/password
 * PATCH  /api/users/me/status
 * POST   /api/users/telegram/link
 * POST   /api/users/telegram/unlink
 * POST   /api/users/telegram/verify
 */

const express = require('express');
const path = require('path');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { uploadAvatar, getFileUrl } = require('../middleware/upload');
const telegramService = require('../services/telegramService');

const router = express.Router();

// All routes require auth
router.use(protect);

// ─── GET /api/users/search ────────────────────────────────────────────────────
router.get(
  '/search',
  [query('q').trim().isLength({ min: 1 }).withMessage('Search query required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { q } = req.query;
      const users = await User.find({
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { displayName: { $regex: q, $options: 'i' } },
        ],
        _id: { $ne: req.user._id },
        blockedUsers: { $nin: [req.user._id] },
      })
        .select('username displayName avatar status avatarUrl')
        .limit(20);

      res.json({ users });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      'username displayName avatar status customStatus avatarUrl lastSeen createdAt'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/users/me ──────────────────────────────────────────────────────
router.patch(
  '/me',
  [
    body('displayName').optional().trim().isLength({ min: 1, max: 50 }),
    body('customStatus').optional().trim().isLength({ max: 128 }),
    body('username')
      .optional()
      .trim()
      .isLength({ min: 2, max: 32 })
      .matches(/^[a-zA-Z0-9_.-]+$/),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const allowed = ['displayName', 'customStatus', 'username'];
      const updates = {};
      allowed.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      if (updates.username) {
        const existing = await User.findOne({ username: updates.username, _id: { $ne: req.user._id } });
        if (existing) return res.status(409).json({ error: 'Username already taken' });
      }

      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
      });

      res.json({ user });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/users/me/avatar ────────────────────────────────────────────────
router.post('/me/avatar', uploadAvatar, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    );

    res.json({ user, avatarUrl });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/users/me/password ────────────────────────────────────────────
router.patch(
  '/me/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must be at least 8 chars with uppercase, lowercase, and number'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const user = await User.findById(req.user._id).select('+password');
      if (!(await user.comparePassword(req.body.currentPassword))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      user.password = req.body.newPassword;
      user.refreshToken = undefined;
      await user.save();

      res.json({ message: 'Password updated successfully. Please log in again.' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/users/me/status ───────────────────────────────────────────────
router.patch(
  '/me/status',
  [body('status').isIn(['online', 'idle', 'dnd', 'offline']).withMessage('Invalid status')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { status: req.body.status },
        { new: true }
      );

      // Broadcast presence update via socket (handled in socket layer)
      req.app.get('io')?.emit('user:presence', {
        userId: req.user._id,
        status: req.body.status,
      });

      res.json({ user });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/users/telegram/link ───────────────────────────────────────────
router.post('/telegram/link', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.telegram.isLinked) {
      return res.status(400).json({ error: 'Telegram account already linked' });
    }

    const code = user.generateTelegramLinkCode();
    await user.save({ validateBeforeSave: false });

    // The bot username comes from env
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'ChatterboxBot';
    res.json({
      code,
      instruction: `Open Telegram, search for @${botUsername}, and send: /link ${code}`,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/users/telegram/verify ─────────────────────────────────────────
// Called by Telegram bot webhook internally, not by the user directly
router.post('/telegram/verify', async (req, res, next) => {
  try {
    const { code, chatId, telegramUsername } = req.body;

    const user = await User.findOne({
      'telegram.linkCode': code,
      'telegram.linkCodeExpires': { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired code' });

    user.telegram.chatId = chatId;
    user.telegram.username = telegramUsername;
    user.telegram.isLinked = true;
    user.telegram.linkCode = undefined;
    user.telegram.linkCodeExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, userId: user._id });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/users/telegram/unlink ─────────────────────────────────────────
router.post('/telegram/unlink', async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      'telegram.chatId': null,
      'telegram.username': null,
      'telegram.isLinked': false,
    });
    res.json({ message: 'Telegram account unlinked' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
