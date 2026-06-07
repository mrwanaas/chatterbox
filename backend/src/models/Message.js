/**
 * Message model.
 * Handles both channel messages and DM messages.
 * Supports text, attachments, edits, soft-delete, and read receipts.
 */

const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  filename: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
});

const messageSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      maxlength: [4000, 'Message cannot exceed 4000 characters'],
      default: '',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Either channel or dmChat must be set
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      default: null,
    },
    dmChat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DirectChat',
      default: null,
    },
    attachments: [attachmentSchema],
    // Who has read this message
    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],
    // Edit history
    editHistory: [
      {
        content: String,
        editedAt: { type: Date, default: Date.now },
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // Reply threading
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    // Reactions: [{ emoji: '👍', users: [userId, ...] }]
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      },
    ],
    // System messages (join, leave, call started, etc.)
    type: {
      type: String,
      enum: ['text', 'system', 'call'],
      default: 'text',
    },
    systemData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        if (ret.isDeleted) {
          ret.content = '[Message deleted]';
          ret.attachments = [];
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
messageSchema.index({ channel: 1, createdAt: -1 });
messageSchema.index({ dmChat: 1, createdAt: -1 });
messageSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
