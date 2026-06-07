import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../context/authStore';
import { useSocket } from '../../context/SocketContext';
import UserAvatar from '../common/UserAvatar';

export default function ServerSidebar() {
  const { serverId, channelId } = useParams();
  const { user }   = useAuthStore();
  const { joinServer, on } = useSocket();
  const navigate   = useNavigate();

  const [server,   setServer]   = useState(null);
  const [channels, setChannels] = useState([]);
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(null);
  const [newName,  setNewName]  = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUrl,  setInviteUrl]  = useState('');
  const [copied,   setCopied]   = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    setLoading(true);
    api.get(`/servers/${serverId}`)
      .then(({ data }) => {
        setServer(data.server);
        setChannels(data.channels);
        setMembers(data.server.members || []);
        joinServer(serverId);
      })
      .catch(() => toast.error('Failed to load server'))
      .finally(() => setLoading(false));
  }, [serverId]);

  useEffect(() => {
    const rm1 = on('channel:created', ({ channel }) => setChannels(p => [...p, channel]));
    const rm2 = on('channel:updated', ({ channel }) => setChannels(p => p.map(c => c._id === channel._id ? channel : c)));
    const rm3 = on('channel:deleted', ({ channelId: id }) => setChannels(p => p.filter(c => c._id !== id)));
    const rm4 = on('server:memberJoined', ({ user: u }) => setMembers(p => [...p, { user: u, role: 'member' }]));
    return () => { rm1?.(); rm2?.(); rm3?.(); rm4?.(); };
  }, [on]);

  const createChannel = async e => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.post(`/channels/${serverId}`, { name: newName.trim(), type: creating });
      setCreating(null); setNewName('');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const getInvite = async () => {
    try {
      const { data } = await api.post(`/servers/${serverId}/invite`);
      setInviteUrl(data.inviteUrl);
      setShowInvite(true);
    } catch { toast.error('Failed to get invite link'); }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const myRole = server?.members?.find(m => (m.user?._id || m.user) === user?._id)?.role;
  const isAdmin = ['owner', 'admin'].includes(myRole);
  const textChannels  = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  if (loading) return (
    <div style={{ width:'240px', background:'var(--sidebar)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <div style={{ width:'24px', height:'24px', border:'3px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%' }} className="animate-spin" />
    </div>
  );

  return (
    <>
      <div style={{ width:'240px', background:'var(--sidebar)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        {/* Server header */}
        <div style={{ height:'48px', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', borderBottom:'1px solid var(--bg-darker)', cursor:'pointer', flexShrink:0 }}
          onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
          <span style={{ fontWeight:700, color:'#fff', fontSize:'15px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{server?.name}</span>
          <span style={{ color:'var(--text-muted)', fontSize:'16px' }}>▾</span>
        </div>

        {/* Quick actions */}
        <div style={{ padding:'8px', display:'flex', gap:'4px', borderBottom:'1px solid var(--bg-darker)' }}>
          <button onClick={getInvite} title="Invite People"
            style={{ flex:1, padding:'6px', borderRadius:'4px', fontSize:'12px', fontWeight:600, color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px', transition:'background 0.1s, color 0.1s' }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.color='var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-muted)'; }}>
            👤+ Invite
          </button>
          <button onClick={() => setShowMembers(p => !p)} title="Members"
            style={{ flex:1, padding:'6px', borderRadius:'4px', fontSize:'12px', fontWeight:600, color: showMembers ? 'var(--accent)' : 'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px', transition:'background 0.1s, color 0.1s' }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}>
            👥 {members.length}
          </button>
        </div>

        {/* Channels */}
        <div style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>

          {/* Text channels */}
          <div>
            <div style={{ display:'flex', alignItems:'center', padding:'12px 8px 4px 16px' }}>
              <span style={{ fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', flex:1 }}>Text Channels</span>
              {isAdmin && (
                <button onClick={() => setCreating('text')} title="Add Channel"
                  style={{ color:'var(--text-muted)', fontSize:'20px', lineHeight:1, width:'20px', height:'20px', display:'flex', alignItems:'center', justifyContent:'center' }}
                  onMouseEnter={e => e.currentTarget.style.color='var(--text)'}
                  onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>+</button>
              )}
            </div>

            {creating === 'text' && (
              <form onSubmit={createChannel} style={{ padding:'4px 8px' }}>
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="channel-name" onBlur={() => { setCreating(null); setNewName(''); }}
                  style={{ width:'100%', background:'var(--bg-darker)', border:'1px solid var(--accent)', borderRadius:'4px', padding:'6px 10px', color:'#fff', fontSize:'14px' }} />
              </form>
            )}

            {textChannels.map(ch => (
              <div key={ch._id} onClick={() => navigate(`/channels/${serverId}/${ch._id}`)}
                className={`nav-item ${channelId === ch._id ? 'active' : ''}`} style={{ cursor:'pointer' }}>
                <span style={{ color: channelId === ch._id ? 'var(--text)' : 'var(--text-muted)', fontSize:'18px', fontWeight:700, flexShrink:0 }}>#</span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'15px' }}>{ch.name}</span>
              </div>
            ))}
          </div>

          {/* Voice channels */}
          <div style={{ marginTop:'8px' }}>
            <div style={{ display:'flex', alignItems:'center', padding:'8px 8px 4px 16px' }}>
              <span style={{ fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', flex:1 }}>Voice Channels</span>
              {isAdmin && (
                <button onClick={() => setCreating('voice')} title="Add Voice Channel"
                  style={{ color:'var(--text-muted)', fontSize:'20px', lineHeight:1, width:'20px', height:'20px', display:'flex', alignItems:'center', justifyContent:'center' }}
                  onMouseEnter={e => e.currentTarget.style.color='var(--text)'}
                  onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>+</button>
              )}
            </div>

            {creating === 'voice' && (
              <form onSubmit={createChannel} style={{ padding:'4px 8px' }}>
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="voice-channel" onBlur={() => { setCreating(null); setNewName(''); }}
                  style={{ width:'100%', background:'var(--bg-darker)', border:'1px solid var(--accent)', borderRadius:'4px', padding:'6px 10px', color:'#fff', fontSize:'14px' }} />
              </form>
            )}

            {voiceChannels.map(ch => (
              <div key={ch._id} onClick={() => navigate(`/channels/${serverId}/${ch._id}`)}
                className={`nav-item ${channelId === ch._id ? 'active' : ''}`} style={{ cursor:'pointer' }}>
                <span style={{ fontSize:'16px', flexShrink:0 }}>🔊</span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'15px' }}>{ch.name}</span>
              </div>
            ))}
          </div>

          {/* Members panel */}
          {showMembers && (
            <div style={{ marginTop:'8px', borderTop:'1px solid var(--border)', paddingTop:'8px' }}>
              <p style={{ fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', padding:'4px 16px 8px' }}>
                Members — {members.length}
              </p>
              {members.map((m, i) => {
                const u = m.user;
                if (!u) return null;
                return (
                  <div key={u._id || i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 16px' }}>
                    <UserAvatar user={u} size={32} showStatus />
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'14px', color:'var(--text)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {u.displayName || u.username}
                      </p>
                      {m.role !== 'member' && (
                        <p style={{ fontSize:'11px', color:'var(--accent)', textTransform:'capitalize' }}>{m.role}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* User bar */}
        <div style={{ height:'52px', background:'var(--bg-modifier)', display:'flex', alignItems:'center', padding:'0 8px', gap:'8px', flexShrink:0 }}>
          <UserAvatar user={user} size={32} showStatus />
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:'14px', fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.displayName}</p>
            <p style={{ fontSize:'12px', color:'var(--text-muted)' }}>#{user?.username}</p>
          </div>
          <Link to="/settings" style={{ color:'var(--text-muted)', fontSize:'18px', flexShrink:0, lineHeight:1 }}
            onMouseEnter={e => e.target.style.color='var(--text)'}
            onMouseLeave={e => e.target.style.color='var(--text-muted)'}>⚙️</Link>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ padding:'24px' }}>
              <h2 style={{ fontSize:'20px', fontWeight:800, color:'#fff', marginBottom:'4px' }}>Invite People</h2>
              <p style={{ color:'var(--text-muted)', fontSize:'14px', marginBottom:'20px' }}>
                Share this link — anyone with it can join <strong style={{ color:'var(--text)' }}>{server?.name}</strong>
              </p>
              <div style={{ display:'flex', gap:'8px' }}>
                <input readOnly value={inviteUrl}
                  style={{ flex:1, background:'var(--bg-darker)', border:'1px solid var(--border)', borderRadius:'4px', padding:'10px 12px', color:'var(--text)', fontSize:'14px' }} />
                <button onClick={copyInvite} className="btn-primary" style={{ padding:'10px 20px', borderRadius:'4px', whiteSpace:'nowrap' }}>
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <p style={{ color:'var(--text-muted)', fontSize:'12px', marginTop:'12px' }}>
                This invite link never expires. You can regenerate it in server settings.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
