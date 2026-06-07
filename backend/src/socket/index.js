/**
 * Socket.io server initialisation and event registration.
 * Handles: authentication, rooms, messaging, typing, presence, WebRTC signalling.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map();

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Authentication middleware ────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password -refreshToken');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🔌 Socket connected: ${socket.user.username} (${socket.id})`);

    // Track online sockets per user
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Join personal room for targeted events
    socket.join(`user:${userId}`);

    // Update presence to online
    await User.findByIdAndUpdate(userId, { status: 'online', lastSeen: new Date() });
    io.emit('user:presence', { userId, status: 'online' });

    // Expose io on app for route handlers
    socket.server.httpServer?._events?.request?.set?.('io', io);

    // ── Room management ─────────────────────────────────────────────────────────

    socket.on('join:channel', (channelId) => {
      socket.join(`channel:${channelId}`);
      console.log(`  → ${socket.user.username} joined channel:${channelId}`);
    });

    socket.on('leave:channel', (channelId) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('join:dm', (chatId) => {
      socket.join(`dm:${chatId}`);
    });

    socket.on('leave:dm', (chatId) => {
      socket.leave(`dm:${chatId}`);
    });

    socket.on('join:server', (serverId) => {
      socket.join(`server:${serverId}`);
    });

    // ── Typing indicators ───────────────────────────────────────────────────────

    socket.on('typing:start', ({ roomId, roomType }) => {
      const room = roomType === 'channel' ? `channel:${roomId}` : `dm:${roomId}`;
      socket.to(room).emit('typing:start', {
        userId,
        username: socket.user.displayName,
        avatar: socket.user.avatarUrl,
      });
    });

    socket.on('typing:stop', ({ roomId, roomType }) => {
      const room = roomType === 'channel' ? `channel:${roomId}` : `dm:${roomId}`;
      socket.to(room).emit('typing:stop', { userId });
    });

    // ── Read receipts ───────────────────────────────────────────────────────────

    socket.on('message:read', ({ messageIds, roomId, roomType }) => {
      const room = roomType === 'channel' ? `channel:${roomId}` : `dm:${roomId}`;
      socket.to(room).emit('message:read', { messageIds, userId });
    });

    // ── WebRTC / Voice & Video Calling ──────────────────────────────────────────

    /**
     * Initiate a call to a user or voice channel.
     * Payload: { targetUserId?, channelId?, callType: 'voice'|'video', dmChatId? }
     */
    socket.on('call:initiate', ({ targetUserId, channelId, callType, dmChatId }) => {
      if (targetUserId) {
        // 1-on-1 DM call
        io.to(`user:${targetUserId}`).emit('call:incoming', {
          callerId: userId,
          callerName: socket.user.displayName,
          callerAvatar: socket.user.avatarUrl,
          callType,
          dmChatId,
          socketId: socket.id,
        });
      } else if (channelId) {
        // Voice channel join
        socket.to(`channel:${channelId}`).emit('call:userJoined', {
          userId,
          username: socket.user.displayName,
          avatar: socket.user.avatarUrl,
          socketId: socket.id,
        });
      }
    });

    socket.on('call:accept', ({ callerSocketId, callType }) => {
      io.to(callerSocketId).emit('call:accepted', {
        accepterId: userId,
        accepterName: socket.user.displayName,
        socketId: socket.id,
        callType,
      });
    });

    socket.on('call:decline', ({ callerSocketId }) => {
      io.to(callerSocketId).emit('call:declined', { declinerId: userId });
    });

    socket.on('call:end', ({ targetSocketId, channelId }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:ended', { endedBy: userId });
      }
      if (channelId) {
        socket.to(`channel:${channelId}`).emit('call:userLeft', { userId });
      }
    });

    // ── WebRTC Signalling (offer/answer/ICE) ────────────────────────────────────

    socket.on('signal:offer', ({ targetSocketId, offer }) => {
      io.to(targetSocketId).emit('signal:offer', {
        offer,
        fromSocketId: socket.id,
        fromUserId: userId,
      });
    });

    socket.on('signal:answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('signal:answer', {
        answer,
        fromSocketId: socket.id,
      });
    });

    socket.on('signal:ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('signal:ice-candidate', {
        candidate,
        fromSocketId: socket.id,
      });
    });

    // ── Voice channel participants ────────────────────────────────────────────

    socket.on('voice:join', ({ channelId }) => {
      socket.join(`voice:${channelId}`);
      // Notify others in the channel
      socket.to(`voice:${channelId}`).emit('voice:userJoined', {
        userId,
        username: socket.user.displayName,
        avatar: socket.user.avatarUrl,
        socketId: socket.id,
      });
      // Send current participants to the joining user
      const room = io.sockets.adapter.rooms.get(`voice:${channelId}`);
      const participants = room ? [...room].filter((sid) => sid !== socket.id) : [];
      socket.emit('voice:currentParticipants', { participants, channelId });
    });

    socket.on('voice:leave', ({ channelId }) => {
      socket.leave(`voice:${channelId}`);
      socket.to(`voice:${channelId}`).emit('voice:userLeft', { userId, channelId });
    });

    socket.on('voice:mute', ({ channelId, isMuted }) => {
      socket.to(`voice:${channelId}`).emit('voice:userMuted', { userId, isMuted });
    });

    socket.on('voice:deafen', ({ channelId, isDeafened }) => {
      socket.to(`voice:${channelId}`).emit('voice:userDeafened', { userId, isDeafened });
    });

    // ── Disconnect ───────────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      console.log(`🔌 Socket disconnected: ${socket.user.username} (${socket.id})`);

      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          // All tabs/sessions closed – mark offline
          await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: new Date() });
          io.emit('user:presence', { userId, status: 'offline' });
        }
      }
    });
  });

  // Expose io globally so route handlers can use it
  global.io = io;

  return io;
};

/**
 * Check if a user is currently online.
 */
const isUserOnline = (userId) => onlineUsers.has(userId.toString());

module.exports = { initSocket, isUserOnline };
