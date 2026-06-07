/**
 * Socket.io context.
 * Initialises the socket with JWT auth, provides emit helpers, and
 * re-connects automatically when the access token changes.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from './authStore';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuthStore();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    // Create socket with auth token
    const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, isAuthenticated]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const emit = (event, data) => socketRef.current?.emit(event, data);

  const on = (event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  };

  const off = (event, handler) => socketRef.current?.off(event, handler);

  const joinChannel  = (channelId) => emit('join:channel', channelId);
  const leaveChannel = (channelId) => emit('leave:channel', channelId);
  const joinDM       = (chatId)    => emit('join:dm', chatId);
  const leaveDM      = (chatId)    => emit('leave:dm', chatId);
  const joinServer   = (serverId)  => emit('join:server', serverId);

  const sendTypingStart = (roomId, roomType) => emit('typing:start', { roomId, roomType });
  const sendTypingStop  = (roomId, roomType) => emit('typing:stop',  { roomId, roomType });

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      emit,
      on,
      off,
      joinChannel,
      leaveChannel,
      joinDM,
      leaveDM,
      joinServer,
      sendTypingStart,
      sendTypingStop,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};

export default SocketContext;
