/**
 * Server model – Discord-style server/guild.
 */

const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Server name is required'],
      trim: true,
      maxlength: [100, 'Server name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    icon: {
      type: String,
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'admin', 'moderator', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
        nickname: { type: String, default: null },
      },
    ],
    inviteCode: {
      type: String,
      unique: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => { delete ret.__v; return ret; },
    },
  }
);

serverSchema.index({ inviteCode: 1 });

module.exports = mongoose.model('Server', serverSchema);
