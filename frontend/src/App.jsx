/**
 * App.jsx – Root component with routing and global providers.
 */

import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import useAuthStore from './context/authStore';

// Pages
import Login          from './pages/Login';
import Register       from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import VerifyEmail    from './pages/VerifyEmail';
import Home           from './pages/Home';
import ServerPage     from './pages/ServerPage';
import FriendsPage    from './pages/FriendsPage';
import SettingsPage   from './pages/SettingsPage';
import InvitePage     from './pages/InvitePage';

// Components
import VideoCallModal  from './components/calls/VideoCallModal';
import IncomingCall    from './components/calls/IncomingCall';
import LoadingScreen   from './components/common/LoadingScreen';

// ─── Protected route ──────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// ─── Public route (redirect if logged in) ────────────────────────────────────
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/channels/@me" replace />;
  return children;
};

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <SocketProvider>
      {/* Global call overlays (always mounted so they catch socket events) */}
      <IncomingCall />
      <VideoCallModal />

      <Routes>
        {/* Public */}
        <Route path="/login"           element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register"        element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="/verify-email/:token"   element={<VerifyEmail />} />
        <Route path="/invite/:code"    element={<InvitePage />} />

        {/* Protected */}
        <Route path="/channels/@me"                 element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/channels/@me/:dmChatId"       element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/channels/:serverId"           element={<ProtectedRoute><ServerPage /></ProtectedRoute>} />
        <Route path="/channels/:serverId/:channelId" element={<ProtectedRoute><ServerPage /></ProtectedRoute>} />
        <Route path="/friends"                      element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
        <Route path="/settings"                     element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/channels/@me" replace />} />
      </Routes>
    </SocketProvider>
  );
}
