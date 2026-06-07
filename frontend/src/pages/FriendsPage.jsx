import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import useChatStore from '../context/chatStore';
import AppSidebar from '../components/layout/AppSidebar';
import DMSidebar  from '../components/layout/DMSidebar';
import UserAvatar from '../components/common/UserAvatar';
import useWebRTC  from '../hooks/useWebRTC';

const TABS = [
  { id:'online',  label:'Online',     icon:'🟢' },
  { id:'all',     label:'All',        icon:'👥' },
  { id:'pending', label:'Pending',    icon:'⏳' },
  { id:'blocked', label:'Blocked',    icon:'🚫' },
  { id:'add',     label:'Add Friend', icon:'➕', accent:true },
];

function FriendRow({ friend, onMessage, onCall, onVideoCall, onRemove, onBlock }) {
  const [hovered, setHovered] = useState(false);
  const STATUS = { online:'var(--green)', idle:'var(--yellow)', dnd:'var(--red)', offline:'var(--text-faint)' };
  const statusLabel = { online:'Online', idle:'Idle', dnd:'Do Not Disturb', offline:'Offline' };
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display:'flex', alignItems:'center', gap:'16px', padding:'12px 16px', borderRadius:'8px', background: hovered ? 'var(--bg-hover)' : 'transparent', transition:'background 0.1s', borderTop:'1px solid var(--border)' }}>
      <UserAvatar user={friend} size={40} showStatus />
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontWeight:600, color:'#fff', fontSize:'15px' }}>{friend.displayName}</p>
        <p style={{ fontSize:'13px', color:STATUS[friend.status] || STATUS.offline }}>
          {statusLabel[friend.status] || 'Offline'}
          {friend.customStatus ? ` — ${friend.customStatus}` : ''}
        </p>
      </div>
      {hovered && (
        <div style={{ display:'flex', gap:'8px' }}>
          {[
            { icon:'💬', title:'Message', fn:onMessage, color:'var(--accent)' },
            { icon:'📞', title:'Voice Call', fn:onCall, color:'var(--green)' },
            { icon:'📹', title:'Video Call', fn:onVideoCall, color:'var(--accent)' },
            { icon:'✕', title:'Remove Friend', fn:onRemove, color:'var(--red)' },
          ].map(({ icon, title, fn, color }) => (
            <button key={title} onClick={fn} title={title}
              style={{ width:'36px', height:'36px', borderRadius:'50%', background:'var(--bg-darker)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', transition:'background 0.1s, color 0.1s', color:'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.background=color+'20'; e.currentTarget.style.color=color; }}
              onMouseLeave={e => { e.currentTarget.style.background='var(--bg-darker)'; e.currentTarget.style.color='var(--text-muted)'; }}>
              {icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FriendsPage() {
  const [tab,      setTab]      = useState('online');
  const [friends,  setFriends]  = useState([]);
  const [requests, setRequests] = useState({ incoming:[], outgoing:[] });
  const [addInput, setAddInput] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { on }         = useSocket();
  const { upsertDmChat } = useChatStore();
  const { initiateCall } = useWebRTC();
  const navigate       = useNavigate();

  const load = async () => {
    try {
      const [fr, rq] = await Promise.all([api.get('/friends'), api.get('/friends/requests')]);
      setFriends(fr.data.friends);
      setRequests(rq.data);
    } catch { }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const rms = [on('friend:request', load), on('friend:accepted', load), on('friend:removed', load)];
    return () => rms.forEach(r => r?.());
  }, [on]);

  const sendRequest = async e => {
    e.preventDefault();
    if (!addInput.trim()) return;
    setLoading(true);
    try {
      await api.post('/friends/request', { identifier: addInput.trim() });
      toast.success('Friend request sent! 🎉');
      setAddInput(''); load();
    } catch (err) { toast.error(err.response?.data?.error || 'User not found'); }
    finally { setLoading(false); }
  };

  const respond = async (id, action) => {
    try {
      await api.patch(`/friends/request/${id}`, { action });
      toast.success(action === 'accept' ? '✅ Friend added!' : 'Request declined');
      load();
    } catch { toast.error('Failed'); }
  };

  const removeFriend = async userId => {
    if (!window.confirm('Remove this friend?')) return;
    try { await api.delete(`/friends/${userId}`); load(); }
    catch { toast.error('Failed'); }
  };

  const blockUser = async userId => {
    try { await api.post(`/friends/block/${userId}`); load(); toast.success('User blocked'); }
    catch { toast.error('Failed'); }
  };

  const startDM = async userId => {
    try {
      const { data } = await api.post('/dms', { userId });
      upsertDmChat(data.chat);
      navigate(`/channels/@me/${data.chat._id}`);
    } catch { }
  };

  const online = friends.filter(f => f.status === 'online');
  const display = tab === 'online' ? online : friends;
  const pendingCount = requests.incoming.length;

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <AppSidebar />
      <DMSidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:'var(--bg)' }}>

        {/* Header */}
        <div style={{ height:'48px', display:'flex', alignItems:'center', gap:'4px', padding:'0 16px', borderBottom:'1px solid var(--border)', flexShrink:0, boxShadow:'0 1px 0 var(--border)' }}>
          <span style={{ fontSize:'18px', marginRight:'8px' }}>👥</span>
          <span style={{ fontWeight:700, color:'#fff', marginRight:'16px' }}>Friends</span>
          <div style={{ width:'1px', height:'24px', background:'var(--border)', marginRight:'12px' }} />
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding:'4px 12px', borderRadius:'4px', fontSize:'14px', fontWeight:500,
                background: tab===t.id ? 'var(--bg-hover)' : 'transparent',
                color: t.accent ? 'var(--green)' : (tab===t.id ? '#fff' : 'var(--text-muted)'),
                transition:'all 0.1s', display:'flex', alignItems:'center', gap:'6px',
              }}
              onMouseEnter={e => { if(tab!==t.id) e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.color='#fff'; }}
              onMouseLeave={e => { if(tab!==t.id) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color=t.accent?'var(--green)':'var(--text-muted)'; }}}>
              {t.label}
              {t.id === 'pending' && pendingCount > 0 && (
                <span style={{ background:'var(--red)', color:'#fff', fontSize:'11px', fontWeight:700, borderRadius:'8px', padding:'0 6px', minWidth:'18px', height:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {/* Add friend */}
          {tab === 'add' && (
            <div style={{ maxWidth:'680px' }}>
              <h3 style={{ color:'#fff', fontWeight:700, fontSize:'16px', marginBottom:'4px' }}>Add Friend</h3>
              <p style={{ color:'var(--text-muted)', fontSize:'14px', marginBottom:'16px' }}>You can add friends with their username or email.</p>
              <form onSubmit={sendRequest}
                style={{ display:'flex', gap:'0', background:'var(--bg-darker)', borderRadius:'8px', border:'1px solid var(--border)', overflow:'hidden' }}>
                <input value={addInput} onChange={e => setAddInput(e.target.value)}
                  placeholder="Enter username or email address…"
                  style={{ flex:1, background:'transparent', border:'none', padding:'12px 16px', color:'var(--text)', fontSize:'15px' }} />
                <button type="submit" disabled={loading || !addInput.trim()} className="btn-primary"
                  style={{ borderRadius:0, padding:'12px 20px', opacity: !addInput.trim() ? 0.5 : 1 }}>
                  Send Request
                </button>
              </form>
            </div>
          )}

          {/* Pending */}
          {tab === 'pending' && (
            <div style={{ maxWidth:'800px' }}>
              {requests.incoming.length > 0 && (
                <>
                  <h4 style={{ color:'var(--text-muted)', fontSize:'12px', fontWeight:700, textTransform:'uppercase', marginBottom:'8px' }}>
                    Incoming — {requests.incoming.length}
                  </h4>
                  {requests.incoming.map(req => (
                    <div key={req._id} style={{ display:'flex', alignItems:'center', gap:'16px', padding:'12px 16px', borderRadius:'8px', borderTop:'1px solid var(--border)' }}>
                      <UserAvatar user={req.sender} size={40} showStatus />
                      <div style={{ flex:1 }}>
                        <p style={{ color:'#fff', fontWeight:600 }}>{req.sender.displayName}</p>
                        <p style={{ color:'var(--text-muted)', fontSize:'13px' }}>Incoming Friend Request</p>
                      </div>
                      <button onClick={() => respond(req._id,'accept')} title="Accept"
                        style={{ width:'36px', height:'36px', borderRadius:'50%', background:'var(--green-light)', color:'var(--green)', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--green)'}
                        onMouseLeave={e => e.currentTarget.style.background='var(--green-light)'}>✓</button>
                      <button onClick={() => respond(req._id,'decline')} title="Decline"
                        style={{ width:'36px', height:'36px', borderRadius:'50%', background:'var(--red-light)', color:'var(--red)', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--red)'}
                        onMouseLeave={e => e.currentTarget.style.background='var(--red-light)'}>✕</button>
                    </div>
                  ))}
                </>
              )}
              {requests.outgoing.length > 0 && (
                <>
                  <h4 style={{ color:'var(--text-muted)', fontSize:'12px', fontWeight:700, textTransform:'uppercase', margin:'20px 0 8px' }}>
                    Outgoing — {requests.outgoing.length}
                  </h4>
                  {requests.outgoing.map(req => (
                    <div key={req._id} style={{ display:'flex', alignItems:'center', gap:'16px', padding:'12px 16px', borderRadius:'8px', borderTop:'1px solid var(--border)' }}>
                      <UserAvatar user={req.receiver} size={40} showStatus />
                      <div style={{ flex:1 }}>
                        <p style={{ color:'#fff', fontWeight:600 }}>{req.receiver.displayName}</p>
                        <p style={{ color:'var(--text-muted)', fontSize:'13px' }}>Pending…</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {!requests.incoming.length && !requests.outgoing.length && (
                <div style={{ textAlign:'center', padding:'60px 0' }}>
                  <div style={{ fontSize:'64px', marginBottom:'16px' }}>🤝</div>
                  <p style={{ color:'var(--text-muted)', fontSize:'16px' }}>No pending friend requests.</p>
                </div>
              )}
            </div>
          )}

          {/* Friends list */}
          {(tab === 'online' || tab === 'all') && (
            <div style={{ maxWidth:'800px' }}>
              <h4 style={{ color:'var(--text-muted)', fontSize:'12px', fontWeight:700, textTransform:'uppercase', marginBottom:'8px' }}>
                {tab === 'online' ? 'Online' : 'All Friends'} — {display.length}
              </h4>
              {display.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 0' }}>
                  <div style={{ fontSize:'64px', marginBottom:'16px' }}>{tab === 'online' ? '😴' : '👋'}</div>
                  <p style={{ color:'var(--text-muted)', fontSize:'16px' }}>
                    {tab === 'online' ? 'Nobody is online right now.' : 'No friends yet. Add some!'}
                  </p>
                  {tab === 'all' && (
                    <button onClick={() => setTab('add')} className="btn-primary" style={{ marginTop:'16px', borderRadius:'4px' }}>
                      Add a Friend
                    </button>
                  )}
                </div>
              ) : display.map(f => (
                <FriendRow key={f._id} friend={f}
                  onMessage={() => startDM(f._id)}
                  onCall={() => initiateCall(f._id, 'voice')}
                  onVideoCall={() => initiateCall(f._id, 'video')}
                  onRemove={() => removeFriend(f._id)}
                  onBlock={() => blockUser(f._id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
