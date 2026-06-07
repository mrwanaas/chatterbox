/**
 * Auth store using Zustand.
 * Manages current user, JWT token, and session lifecycle.
 */

import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('accessToken') || null,
  isLoading: true,
  isAuthenticated: false,

  // ── Initialise from stored token ──────────────────────────────────────────
  init: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, token, isAuthenticated: true, isLoading: false });
    } catch {
      // Try refresh
      try {
        const { data } = await api.post('/auth/refresh');
        localStorage.setItem('accessToken', data.accessToken);
        set({ user: data.user, token: data.accessToken, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem('accessToken');
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    }
  },

  // ── Register ──────────────────────────────────────────────────────────────
  register: async (username, displayName, email, password) => {
    const { data } = await api.post('/auth/register', { username, displayName, email, password });
    localStorage.setItem('accessToken', data.accessToken);
    set({ user: data.user, token: data.accessToken, isAuthenticated: true });
    return data;
  },

  // ── Login ─────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    set({ user: data.user, token: data.accessToken, isAuthenticated: true });
    return data;
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logout: async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('accessToken');
    set({ user: null, token: null, isAuthenticated: false });
  },

  // ── Update user in store ──────────────────────────────────────────────────
  setUser: (user) => set({ user }),
  updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
}));

export default useAuthStore;
