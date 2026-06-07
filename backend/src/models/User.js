/**
 * User model.
 * Stores credentials, profile info, presence state, and Telegram link.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Username must be at least 2 characters'],
      maxlength: [32, 'Username cannot exceed 32 characters'],
      match: [/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, underscores, dots, or hyphens'],
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [50, 'Display name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['online', 'idle', 'dnd', 'offline'],
      default: 'offline',
    },
    customStatus: {
      type: String,
      maxlength: [128, 'Custom status cannot exceed 128 characters'],
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    refreshToken: {
      type: String,
      select: false,
    },

    // Telegram integration
    telegram: {
      chatId: { type: String, default: null },
      username: { type: String, default: null },
      linkCode: { type: String, default: null },
      linkCodeExpires: { type: Date, default: null },
      isLinked: { type: Boolean, default: false },
    },

    // Servers this user belongs to
    servers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Server' }],

    // Users this user has blocked
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.emailVerificationToken;
        delete ret.passwordResetToken;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ username: 'text', displayName: 'text', email: 'text' });

// ─── Pre-save Hook – Hash password ────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

userSchema.methods.generateEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

userSchema.methods.generateTelegramLinkCode = function () {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.telegram.linkCode = code;
  this.telegram.linkCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return code;
};

// ─── Virtual – avatar URL ─────────────────────────────────────────────────────
userSchema.virtual('avatarUrl').get(function () {
  return this.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(this.displayName)}`;
});

module.exports = mongoose.model('User', userSchema);
