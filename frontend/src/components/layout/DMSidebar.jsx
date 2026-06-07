import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../context/authStore';
import useChatStore from '../../context/chatStore';
import { useSocket } from '../../context/SocketContext';
import UserAvatar from '../common/UserAvatar';

/* ── New Group DM modal ────────────────────────────────────────────── */
function GroupDMModal({ friends, onClose, onCreated }) {
  const [name,     setName]     = useState('');
  const [selected, setSelected] = useState([]);
  const [loading,  setLoading]  = useState(false);

  const toggle = id => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);

  const create = async () => {
    if (!name.trim() || selected.length === 0) return;
    setLoading(true);
    try {
      const { data } = await api.post('/dms/group', { name: name.trim(), userIds: selected });
      onCreated(data.chat);
      onClose();
    } catch { } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:'460px' }}>
        <div style={{ padding:'24px' }}>
          <h2 style={{ fontSize:'20px', fontWeight:800, color:'#fff', marginBottom:'4px' }}>New Group DM</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'14px', marginBottom:'20px' }}>You can add up to 9 friends.</p>

          <input value={name} onChange={e => setName(e.target.value)} placeholder="Group name…"
            style={{ width:'100%', background:'var(--bg-darker)', border:'1px solid var(--border)', borderRadius:'6px', padding:'10px 14px', color:'#fff', fontSize:'15px', marginBottom:'16px' }} />

          <p style={{ fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'10px' }}>
            Select friends ({selected.length} selected)
          </p>

          <div style={{ maxHeight:'240px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'4px', marginBottom:'20px' }}>
            {friends.length === 0 && <p style={{ color:'var(--text-muted)', fontSize:'14px', padding:'12px 0' }}>No friends to add yet.</p>}
            {friends.map(f => {
              const sel = selected.includes(f._id);
              return (
                <div key={f._id} onClick={() => toggle(f._id)}
                  style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 10px', borderRadius:'6px', cursor:'pointer', background: sel ? 'var(--accent-light)' : 'transparent', transition:'background 0.1s' }}
                  onMouseEnter={e => { if(!sel) e.currentTarget.style.background='var(--bg-hover)'; }}
                  onMouseLeave={e => { if(!sel) e.currentTarget.style.background='transparent'; }}>
                  <UserAvatar user={f} size={36} showStatus />
                  <div style={{ flex:1 }}>
                    <p style={{ color:'#fff', fontWeight:500, fontSize:'15px' }}>{f.displayName}</p>
                    <p style={{ color:'var(--text-muted)', fontSize:'13px' }}>@{f.username}</p>
                  </div>
                  <div style={{ width:'20px', height:'20px', borderRadius:'50%', border:`2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                    {sel && <span style={{ color:'#fff', fontSize:'12px', fontWeight:700 }}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={create} disabled={loading || !name.trim() || selected.length === 0} className="btn-primary"
              style={{ opacity: (!name.trim() || selected.length === 0) ? 0.5 : 1 }}>
              {loading ? 'Creating…' : 'Create Group DM'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DMSidebar() {
  const { dmChatId } = useParams();
  const { user }     = useAuthStore();
  const { dmChats, loadDmChats, upsertDmChat, unreadCounts } = useChatStore();
  const { on }       = useSocket();
  const navigate     = useNavigate();

  const [friends,     setFriends]     = useState([]);
  const [showGroup,   setShowGroup]   = useState(false);
  const [searchQ,     setSearchQ]     = useState('');

  useEffect(() => {
    loadDmChats();
    api.get('/friends').then(({ data }) => setFriends(data.friends)).catch(() => {});
  }, []);

  useEffect(() => {
    const rm = on('dm:new', ({ chat }) => upsertDmChat(chat));
    return () => rm?.();
  }, [on]);

  const startDM = async friendId => {
    try {
      const { data } = await api.post('/dms', { userId: friendId });
      upsertDmChat(data.chat);
      navigate(`/channels/@me/${data.chat._id}`);
    } catch { }
  };

  const getOther = chat => chat.participants?.find(p => (p._id || p) !== user?._id && p._id !== user?._id);

  const filteredChats = dmChats.filter(c => {
    if (!searchQ) return true;
    const other = getOther(c);
    const name  = c.isGroup ? c.name : other?.displayName || '';
    return name.toLowerCase().includes(searchQ.toLowerCase());
  });

  return (
    <>
      <div style={{ width:'240px', background:'var(--sidebar)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        {/* Search / header */}
        <div style={{ padding:'12px 8px 4px' }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search or start a DM…"
            style={{ width:'100%', background:'var(--bg-modifier)', border:'none', borderRadius:'4px', padding:'6px 10px', color:'var(--text)', fontSize:'14px' }} />
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>

          {/* Nav */}
          <Link to="/friends" className={`nav-item ${!dmChatId && window.location.pathname === '/friends' ? 'active' : ''}`}>
            <span style={{ fontSize:'18px' }}>👥</span>
            <span>Friends</span>
          </Link>

          {/* DM chats */}
          <div style={{ margin:'8px 0 4px' }}>
            <div style={{ display:'flex', alignItems:'center', padding:'4px 16px', justifyContent:'space-between' }}>
              <span style={{ fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>
                Direct Messages
              </span>
              <button onClick={() => setShowGroup(true)} title="New Group DM"
                style={{ color:'var(--text-muted)', fontSize:'18px', lineHeight:1, width:'20px', height:'20px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'3px', transition:'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color='var(--text)'}
                onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
                +
              </button>
            </div>

            {filteredChats.map(chat => {
              const other  = chat.isGroup ? null : getOther(chat);
              const name   = chat.isGroup ? chat.name : (other?.displayName || 'Unknown');
              const unread = unreadCounts[chat._id] || 0;
              const active = dmChatId === chat._id;

              return (
                <div key={chat._id} onClick={() => navigate(`/channels/@me/${chat._id}`)}
                  className={`nav-item ${active ? 'active' : ''}`}
                  style={{ cursor:'pointer', position:'relative' }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    {chat.isGroup ? (
                      <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' }}>👥</div>
                    ) : (
                      <UserAvatar user={other} size={32} showStatus />
                    )}
                    {unread > 0 && (
                      <span className="unread-badge" style={{ position:'absolute', bottom:'-2px', right:'-4px', fontSize:'10px', minWidth:'16px', height:'16px' }}>
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'15px', fontWeight: unread ? 600 : 500, color: active || unread ? '#fff' : 'inherit', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</p>
                    {chat.isGroup && (
                      <p style={{ fontSize:'12px', color:'var(--text-muted)' }}>{chat.participants?.length} members</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Friends for quick DM */}
          {friends.length > 0 && (
            <div style={{ margin:'8px 0 4px' }}>
              <div style={{ padding:'4px 16px', marginBottom:'4px' }}>
                <span style={{ fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>
                  Online Friends
                </span>
              </div>
              {friends.filter(f => f.status === 'online').map(f => (
                <div key={f._id} onClick={() => startDM(f._id)} className="nav-item" style={{ cursor:'pointer' }}>
                  <UserAvatar user={f} size={32} showStatus />
                  <span style={{ fontSize:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.displayName}</span>
                </div>
              ))}
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

      {showGroup && (
        <GroupDMModal friends={friends} onClose={() => setShowGroup(false)}
          onCreated={chat => { upsertDmChat(chat); navigate(`/channels/@me/${chat._id}`); }} />
      )}
    </>
  );
}
