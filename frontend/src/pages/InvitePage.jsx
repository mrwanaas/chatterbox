import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../context/authStore';

export default function InvitePage() {
  const { code }   = useParams();
  const navigate   = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api.get(`/servers/join/${code}`)
      .then(({ data }) => setServer(data.server))
      .catch(() => toast.error('Invalid invite link'))
      .finally(() => setLoading(false));
  }, [code]);

  const join = async () => {
    if (!isAuthenticated) { navigate(`/login?redirect=/invite/${code}`); return; }
    setJoining(true);
    try {
      const { data } = await api.post(`/servers/join/${code}`);
      toast.success(`Joined ${data.server.name}!`);
      navigate(`/channels/${data.server._id}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to join'); }
    finally { setJoining(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-cb-bg-darker text-cb-text-muted">Loading…</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-cb-bg-darker">
      <div className="bg-cb-bg p-8 rounded-2xl shadow-xl text-center w-80 animate-slide-up">
        <div className="w-16 h-16 rounded-2xl bg-cb-accent flex items-center justify-center text-3xl mx-auto mb-4">
          {server?.icon ? <img src={server.icon} alt={server.name} className="w-full h-full object-cover rounded-2xl" /> : '🏠'}
        </div>
        <p className="text-cb-text-muted text-sm mb-1">You've been invited to join</p>
        <h2 className="text-white text-xl font-bold mb-1">{server?.name || 'Unknown Server'}</h2>
        <p className="text-cb-text-muted text-sm mb-6">{server?.members?.length || 0} Members</p>
        <button onClick={join} disabled={joining}
          className="w-full bg-cb-accent hover:bg-cb-accent-hover text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-60">
          {joining ? 'Joining…' : 'Accept Invite'}
        </button>
        <button onClick={() => navigate('/')} className="mt-3 text-cb-text-muted text-sm hover:underline">No thanks</button>
      </div>
    </div>
  );
}
