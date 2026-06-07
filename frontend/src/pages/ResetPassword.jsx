import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate  = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      toast.success('Password reset! Please log in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cb-bg-darker">
      <div className="w-full max-w-md bg-cb-bg p-8 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-6">Create new password</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-cb-text-muted mb-1">New Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}
              className="w-full bg-cb-bg-input text-cb-text rounded px-3 py-2 text-sm focus:ring-2 focus:ring-cb-accent" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-cb-accent hover:bg-cb-accent-hover text-white font-medium py-2.5 rounded transition-colors disabled:opacity-60">
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
