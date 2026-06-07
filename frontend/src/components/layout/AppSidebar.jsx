import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../context/authStore';
import UserAvatar from '../common/UserAvatar';

function Pill({ active }) {
  return active ? (
    <span style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', width:'4px', height:'40px', background:'#fff', borderRadius:'0 4px 4px 0' }} />
  ) : null;
}

function ServerBtn({ server, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  const letters = server.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isActive = active || hovered;
  return (
    <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'8px' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Pill active={active} />
      <div onClick={onClick} style={{
        width:'48px', height:'48px', borderRadius: isActive ? '16px' : '50%',
        background: active ? 'var(--accent)' : (hovered ? 'var(--accent)' : 'var(--bg-dark)'),
        display:'flex', alignItems:'center', justifyContent:'center',
        cursor:'pointer', transition:'border-radius 0.2s, background 0.2s',
        overflow:'hidden', flexShrink:0, boxShadow: active ? '0 0 0 2px var(--accent)' : 'none',
      }}>
        {server.icon
          ? <img src={server.icon} alt={server.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span style={{ color:'#fff', fontSize:'14px', fontWeight:700 }}>{letters}</span>}
      </div>
      {/* Tooltip */}
      <div style={{
        position:'absolute', left:'60px', top:'50%', transform:'translateY(-50%)',
        background:'var(--bg-modifier)', color:'#fff', fontSize:'13px', fontWeight:700,
        padding:'8px 12px', borderRadius:'6px', whiteSpace:'nowrap', zIndex:999,
        boxShadow:'var(--shadow)', pointerEvents:'none',
        opacity: hovered ? 1 : 0, transition:'opacity 0.12s',
      }}>
        {server.name}
        <div style={{ position:'absolute', left:'-4px', top:'50%', transform:'translateY(-50%)', width:'8px', height:'8px', background:'var(--bg-modifier)', rotate:'45deg' }} />
      </div>
    </div>
  );
}

export default function AppSidebar() {
  const { user, logout } = useAuthStore();
  const { serverId }     = useParams();
  const navigate         = useNavigate();
  const [servers, setServers]   = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]   = useState('');
  const [creating, setCreating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    api.get('/servers').then(({ data }) => setServers(data.servers)).catch(() => {});
  }, []);

  const createServer = async e => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/servers', { name: newName.trim() });
      setServers(s => [...s, data.server]);
      setShowCreate(false); setNewName('');
      navigate(`/channels/${data.server._id}`);
      toast.success(`${data.server.name} created!`);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  return (
    <>
      <div style={{ width:'72px', background:'var(--bg-darker)', display:'flex', flexDirection:'column', alignItems:'center', paddingTop:'12px', paddingBottom:'8px', gap:0, flexShrink:0, overflowY:'auto', overflowX:'hidden' }}>

        {/* DMs button */}
        <div style={{ position:'relative', marginBottom:'8px' }}>
          {!serverId && <Pill active />}
          <div onClick={() => navigate('/channels/@me')} data-tip="Direct Messages"
            style={{ width:'48px', height:'48px', borderRadius: !serverId ? '16px' : '50%', background: !serverId ? 'var(--accent)' : 'var(--bg-dark)',
              display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
              transition:'border-radius 0.2s, background 0.2s', fontSize:'22px',
            }}
            onMouseEnter={e => { if(serverId) { e.currentTarget.style.borderRadius='16px'; e.currentTarget.style.background='var(--accent)'; }}}
            onMouseLeave={e => { if(serverId) { e.currentTarget.style.borderRadius='50%'; e.currentTarget.style.background='var(--bg-dark)'; }}}>
            💬
          </div>
        </div>

        {/* Divider */}
        <div style={{ width:'32px', height:'2px', background:'var(--border)', borderRadius:'1px', marginBottom:'8px' }} />

        {/* Server list */}
        {servers.map(s => (
          <ServerBtn key={s._id} server={s} active={serverId === s._id}
            onClick={() => navigate(`/channels/${s._id}`)} />
        ))}

        {/* Add server */}
        <div data-tip="Add a Server">
          <div onClick={() => setShowCreate(true)}
            style={{ width:'48px', height:'48px', borderRadius:'50%', background:'var(--bg-dark)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'24px', color:'var(--green)', fontWeight:700, transition:'border-radius 0.2s, background 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderRadius='16px'; e.currentTarget.style.background='var(--green)'; e.currentTarget.style.color='#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderRadius='50%'; e.currentTarget.style.background='var(--bg-dark)'; e.currentTarget.style.color='var(--green)'; }}>
            +
          </div>
        </div>

        <div style={{ flex:1 }} />

        {/* User avatar */}
        <div style={{ position:'relative' }}>
          <div onClick={() => setShowMenu(p => !p)} style={{ cursor:'pointer', opacity: showMenu ? 0.8 : 1, transition:'opacity 0.15s' }}>
            <UserAvatar user={user} size={40} showStatus />
          </div>
          {showMenu && (
            <div style={{ position:'absolute', left:'52px', bottom:0, background:'var(--bg-modifier)', borderRadius:'8px', boxShadow:'var(--shadow)', padding:'6px', minWidth:'160px', zIndex:999 }}
              onMouseLeave={() => setShowMenu(false)}>
              <div onClick={() => { navigate('/settings'); setShowMenu(false); }}
                style={{ padding:'8px 12px', borderRadius:'4px', cursor:'pointer', color:'var(--text)', fontSize:'14px', display:'flex', alignItems:'center', gap:'8px' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                ⚙️ Settings
              </div>
              <div style={{ height:'1px', background:'var(--border)', margin:'4px 0' }} />
              <div onClick={() => { logout(); navigate('/login'); }}
                style={{ padding:'8px 12px', borderRadius:'4px', cursor:'pointer', color:'var(--red)', fontSize:'14px', display:'flex', alignItems:'center', gap:'8px' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--red-light)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                🚪 Log Out
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create server modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:'440px' }}>
            <div style={{ padding:'24px' }}>
              <h2 style={{ fontSize:'20px', fontWeight:800, color:'#fff', marginBottom:'8px', textAlign:'center' }}>Create Your Server</h2>
              <p style={{ color:'var(--text-muted)', fontSize:'14px', textAlign:'center', marginBottom:'24px' }}>
                Give your server a personality with a name and an icon.
              </p>
              <form onSubmit={createServer}>
                <label style={{ display:'block', fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'8px' }}>
                  Server Name *
                </label>
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="My Awesome Server"
                  style={{ width:'100%', background:'var(--bg-darker)', border:'1px solid var(--border)', borderRadius:'4px', padding:'10px 12px', color:'#fff', fontSize:'15px', marginBottom:'20px' }} />
                <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end' }}>
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
                  <button type="submit" disabled={creating || !newName.trim()} className="btn-primary">
                    {creating ? 'Creating…' : 'Create Server'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
