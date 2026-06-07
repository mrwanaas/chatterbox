/**
 * Channel model – text or voice channel within a server.
 */

const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Channel name is required'],
      trim: true,
      maxlength: [100, 'Channel name cannot exceed 100 characters'],
      set: (v) => v.toLowerCase().replace(/\s+/g, '-'),
    },
    description: {
      type: String,
      maxlength: [1024, 'Channel description cannot exceed 1024 characters'],
      default: '',
    },
    type: {
      type: String,
      enum: ['text', 'voice'],
      default: 'text',
    },
    server: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      required: true,
    },
    position: {
      type: Number,
      default: 0,
    },
    // Current voice participants (populated at runtime, not stored long-term)
    voiceParticipants: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    // Permissions override per user/role
    permissionOverwrites: [
      {
        type: { type: String, enum: ['user', 'role'] },
        id: mongoose.Schema.Types.ObjectId,
        allow: { type: Number, default: 0 },
        deny: { type: Number, default: 0 },
      },
    ],
    isNsfw: {
      type: Boolean,
      default: false,
    },
    slowMode: {
      type: Number, // seconds between messages per user
      default: 0,
    },
    lastMessageAt: {
      type: Date,
      default: null,
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

channelSchema.index({ server: 1, position: 1 });

module.exports = mongoose.model('Channel', channelSchema);
