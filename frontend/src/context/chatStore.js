/**
 * Chat store using Zustand.
 * Manages messages, DMs, unread counts, and typing indicators.
 */

import { create } from 'zustand';
import api from '../services/api';

const useChatStore = create((set, get) => ({
  // Map of roomId -> messages[]
  messages: {},
  // Map of roomId -> boolean (hasMore)
  hasMore: {},
  // Map of roomId -> boolean (loading)
  loadingMessages: {},
  // DM conversations list
  dmChats: [],
  // Active DM chat
  activeDmChat: null,
  // Unread counts: Map<roomId, count>
  unreadCounts: {},
  // Typing users: Map<roomId, [{userId, username, avatar}]>
  typingUsers: {},

  // ── Messages ─────────────────────────────────────────────────────────────

  loadMessages: async (roomId, roomType, before = null) => {
    const key = roomId;
    if (get().loadingMessages[key]) return;

    set((s) => ({ loadingMessages: { ...s.loadingMessages, [key]: true } }));

    try {
      const url = roomType === 'channel'
        ? `/messages/${roomId}`
        : `/dms/${roomId}/messages`;

      const params = before ? { before, limit: 50 } : { limit: 50 };
      const { data } = await api.get(url, { params });

      set((s) => ({
        messages: {
          ...s.messages,
          [key]: before ? [...data.messages, ...(s.messages[key] || [])] : data.messages,
        },
        hasMore: { ...s.hasMore, [key]: data.hasMore },
        loadingMessages: { ...s.loadingMessages, [key]: false },
      }));
    } catch (err) {
      console.error('loadMessages error:', err);
      set((s) => ({ loadingMessages: { ...s.loadingMessages, [key]: false } }));
    }
  },

  addMessage: (roomId, message) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [roomId]: [...(s.messages[roomId] || []), message],
      },
    }));
  },

  updateMessage: (roomId, updatedMessage) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [roomId]: (s.messages[roomId] || []).map((m) =>
          m._id === updatedMessage._id ? updatedMessage : m
        ),
      },
    }));
  },

  deleteMessage: (roomId, messageId) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [roomId]: (s.messages[roomId] || []).map((m) =>
          m._id === messageId ? { ...m, isDeleted: true, content: '[Message deleted]' } : m
        ),
      },
    }));
  },

  updateReactions: (roomId, messageId, reactions) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [roomId]: (s.messages[roomId] || []).map((m) =>
          m._id === messageId ? { ...m, reactions } : m
        ),
      },
    }));
  },

  clearMessages: (roomId) => {
    set((s) => {
      const msgs = { ...s.messages };
      delete msgs[roomId];
      return { messages: msgs };
    });
  },

  // ── DM Chats ──────────────────────────────────────────────────────────────

  loadDmChats: async () => {
    try {
      const { data } = await api.get('/dms');
      set({ dmChats: data.chats });
    } catch (err) {
      console.error('loadDmChats error:', err);
    }
  },

  setActiveDmChat: (chat) => set({ activeDmChat: chat }),

  upsertDmChat: (chat) => {
    set((s) => {
      const exists = s.dmChats.find((c) => c._id === chat._id);
      if (exists) {
        return {
          dmChats: s.dmChats
            .map((c) => (c._id === chat._id ? chat : c))
            .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)),
        };
      }
      return { dmChats: [chat, ...s.dmChats] };
    });
  },

  // ── Unread counts ─────────────────────────────────────────────────────────

  incrementUnread: (roomId) => {
    set((s) => ({
      unreadCounts: { ...s.unreadCounts, [roomId]: (s.unreadCounts[roomId] || 0) + 1 },
    }));
  },

  clearUnread: (roomId) => {
    set((s) => {
      const counts = { ...s.unreadCounts };
      delete counts[roomId];
      return { unreadCounts: counts };
    });
  },

  // ── Typing indicators ─────────────────────────────────────────────────────

  setTyping: (roomId, user) => {
    set((s) => {
      const existing = s.typingUsers[roomId] || [];
      const filtered = existing.filter((u) => u.userId !== user.userId);
      return { typingUsers: { ...s.typingUsers, [roomId]: [...filtered, user] } };
    });
  },

  removeTyping: (roomId, userId) => {
    set((s) => ({
      typingUsers: {
        ...s.typingUsers,
        [roomId]: (s.typingUsers[roomId] || []).filter((u) => u.userId !== userId),
      },
    }));
  },
}));

export default useChatStore;
