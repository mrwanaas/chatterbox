/**
 * FriendRequest model
 */

const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

friendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });

const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Friendship model – bidirectional friend relationship.
 */
const friendshipSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

friendshipSchema.index({ users: 1 });

const Friendship = mongoose.model('Friendship', friendshipSchema);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * DirectChat model – 1-on-1 or group DM conversation.
 */
const directChatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String, // for group DMs
      default: null,
    },
    icon: {
      type: String,
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // group DM owner
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
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

directChatSchema.index({ participants: 1 });

const DirectChat = mongoose.model('DirectChat', directChatSchema);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call model – stores call history.
 */
const callSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now },
        leftAt: { type: Date, default: null },
      },
    ],
    type: {
      type: String,
      enum: ['voice', 'video'],
      default: 'voice',
    },
    status: {
      type: String,
      enum: ['ringing', 'ongoing', 'ended', 'missed', 'declined'],
      default: 'ringing',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, // in seconds
      default: 0,
    },
    // Associated DM or channel
    dmChat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DirectChat',
      default: null,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      default: null,
    },
  },
  { timestamps: true }
);

const Call = mongoose.model('Call', callSchema);

module.exports = { FriendRequest, Friendship, DirectChat, Call };
