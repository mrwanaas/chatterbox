import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api.get(`/auth/verify-email/${token}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cb-bg-darker">
      <div className="w-full max-w-md bg-cb-bg p-8 rounded-lg shadow-xl text-center">
        {status === 'loading' && <p className="text-cb-text-muted">Verifying…</p>}
        {status === 'success' && <>
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">Email Verified!</h2>
          <p className="text-cb-text-muted mb-4">Your email has been verified successfully.</p>
          <Link to="/login" className="text-cb-accent hover:underline">Go to Login</Link>
        </>}
        {status === 'error' && <>
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-white mb-2">Verification Failed</h2>
          <p className="text-cb-text-muted mb-4">The link is invalid or expired.</p>
          <Link to="/login" className="text-cb-accent hover:underline">Go to Login</Link>
        </>}
      </div>
    </div>
  );
}
