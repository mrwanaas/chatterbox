import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch { toast.error('Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cb-bg-darker">
      <div className="w-full max-w-md bg-cb-bg p-8 rounded-lg shadow-xl animate-fade-in">
        {sent ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-cb-text-muted">If that email is registered, we've sent a reset link.</p>
            <Link to="/login" className="mt-6 inline-block text-cb-accent hover:underline">Back to Login</Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white mb-1">Reset your password</h2>
            <p className="text-cb-text-muted text-sm mb-6">Enter your email to receive a reset link.</p>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-cb-text-muted mb-1">Email</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                  className="w-full bg-cb-bg-input text-cb-text rounded px-3 py-2 text-sm focus:ring-2 focus:ring-cb-accent" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-cb-accent hover:bg-cb-accent-hover text-white font-medium py-2.5 rounded transition-colors disabled:opacity-60">
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
            <p className="text-cb-text-muted text-sm mt-4 text-center">
              <Link to="/login" className="text-cb-accent hover:underline">Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
