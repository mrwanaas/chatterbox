/**
 * Auth routes
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/refresh
 * POST /api/auth/logout
 * POST /api/auth/forgot-password
 * POST /api/auth/reset-password/:token
 * GET  /api/auth/verify-email/:token
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();

// ─── Helper – generate tokens ─────────────────────────────────────────────────
const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

const generateRefreshToken = (id) =>
  jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  });

const setCookieAndRespond = async (res, user, statusCode = 200) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Store hashed refresh token in DB
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const userObj = user.toJSON();

  res.status(statusCode).json({
    accessToken,
    user: userObj,
  });
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 2, max: 32 })
      .withMessage('Username must be between 2 and 32 characters')
      .matches(/^[a-zA-Z0-9_.-]+$/)
      .withMessage('Username can only contain letters, numbers, _, ., -'),
    body('displayName')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Display name must be between 1 and 50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { username, displayName, email, password } = req.body;

      // Check uniqueness
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        const field = existingUser.email === email ? 'email' : 'username';
        return res.status(409).json({ error: `An account with that ${field} already exists.` });
      }

      const user = await User.create({ username, displayName, email, password });

      // Send verification email (non-blocking)
      try {
        const verifyToken = user.generateEmailVerificationToken();
        await user.save({ validateBeforeSave: false });
        await emailService.sendVerificationEmail(user.email, user.displayName, verifyToken);
      } catch {
        // Don't fail registration if email fails
      }

      await setCookieAndRespond(res, user, 201);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');

      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      user.status = 'online';
      user.lastSeen = new Date();
      await setCookieAndRespond(res, user);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token provided' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ error: 'Refresh token reuse detected. Please log in again.' });
    }

    await setCookieAndRespond(res, user);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', protect, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      refreshToken: null,
      status: 'offline',
      lastSeen: new Date(),
    });
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid email' });

      const user = await User.findOne({ email: req.body.email });

      // Always return success (don't reveal if email exists)
      if (!user) {
        return res.json({ message: 'If that email exists, a reset link has been sent.' });
      }

      const resetToken = user.generatePasswordResetToken();
      await user.save({ validateBeforeSave: false });

      try {
        await emailService.sendPasswordResetEmail(user.email, user.displayName, resetToken);
      } catch {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return res.status(500).json({ error: 'Could not send reset email. Please try again.' });
      }

      res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/reset-password/:token ────────────────────────────────────
router.post(
  '/reset-password/:token',
  [
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and a number'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      });

      if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

      user.password = req.body.password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.refreshToken = undefined;
      await user.save();

      res.json({ message: 'Password reset successful. Please log in.' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/auth/verify-email/:token ───────────────────────────────────────
router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired verification token' });

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'Email verified successfully!' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
