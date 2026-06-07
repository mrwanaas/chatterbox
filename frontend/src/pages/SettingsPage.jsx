import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../context/authStore';
import UserAvatar from '../components/common/UserAvatar';

const SECTIONS = [
  { id:'account',  label:'My Account',       icon:'👤' },
  { id:'profile',  label:'Profile',          icon:'🎨' },
  { id:'telegram', label:'Telegram Bot',     icon:'✈️' },
  { id:'privacy',  label:'Privacy & Safety', icon:'🔒' },
];

const STATUS_OPTIONS = [
  { value:'online',  label:'Online',         color:'var(--green)',       dot:'🟢' },
  { value:'idle',    label:'Idle',           color:'var(--yellow)',      dot:'🟡' },
  { value:'dnd',     label:'Do Not Disturb', color:'var(--red)',         dot:'🔴' },
  { value:'offline', label:'Invisible',      color:'var(--text-faint)', dot:'⚫' },
];

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuthStore();
  const navigate   = useNavigate();
  const fileRef    = useRef();
  const [section,  setSection]  = useState('account');
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({ displayName: user?.displayName||'', username: user?.username||'', customStatus: user?.customStatus||'' });
  const [pwForm,   setPwForm]   = useState({ current:'', newPw:'', confirm:'' });
  const [tgInfo,   setTgInfo]   = useState(null);
  const [tgLoading,setTgLoading]= useState(false);

  const onFormChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me', form);
      updateUser(data.user);
      toast.success('Profile saved!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const uploadAvatar = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const { data } = await api.post('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateUser({ avatar: data.avatarUrl });
      toast.success('Avatar updated!');
    } catch { toast.error('Failed to upload avatar'); }
  };

  const changePassword = async e => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) { toast.error("Passwords don't match"); return; }
    if (pwForm.newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    try {
      await api.patch('/users/me/password', { currentPassword: pwForm.current, newPassword: pwForm.newPw });
      toast.success('Password changed! Please log in again.');
      logout(); navigate('/login');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const setStatus = async status => {
    try {
      await api.patch('/users/me/status', { status });
      updateUser({ status });
      toast.success('Status updated!');
    } catch { }
  };

  const getTelegramCode = async () => {
    setTgLoading(true);
    try {
      const { data } = await api.post('/users/telegram/link');
      setTgInfo(data);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setTgLoading(false); }
  };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      {/* Sidebar */}
      <div style={{ width:'220px', background:'var(--sidebar)', display:'flex', flexDirection:'column', padding:'20px 8px', flexShrink:0 }}>
        <p style={{ fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', padding:'4px 10px', marginBottom:'4px' }}>User Settings</p>

        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{
              display:'flex', alignItems:'center', gap:'10px',
              padding:'8px 10px', borderRadius:'4px', cursor:'pointer',
              background: section===s.id ? 'var(--bg-hover)' : 'transparent',
              color: section===s.id ? '#fff' : 'var(--text-muted)',
              fontSize:'15px', fontWeight: section===s.id ? 600 : 400,
              transition:'all 0.1s', marginBottom:'2px', textAlign:'left', border:'none',
            }}
            onMouseEnter={e => { if(section!==s.id) { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.color='var(--text)'; }}}
            onMouseLeave={e => { if(section!==s.id) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-muted)'; }}}>
            <span>{s.icon}</span><span>{s.label}</span>
          </button>
        ))}

        <div style={{ flex:1 }} />
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:'8px', marginTop:'8px' }}>
          <button onClick={() => navigate(-1)} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'4px', color:'var(--text-muted)', fontSize:'14px', width:'100%', transition:'all 0.1s' }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.color='var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-muted)'; }}>
            ← Back
          </button>
          <button onClick={() => { logout(); navigate('/login'); }} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'4px', color:'var(--red)', fontSize:'14px', width:'100%', transition:'all 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--red-light)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            🚪 Log Out
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'40px 40px 80px' }}>
        <div style={{ maxWidth:'660px' }}>

          {/* My Account */}
          {section === 'account' && (
            <div>
              <h2 style={{ color:'#fff', fontSize:'20px', fontWeight:800, marginBottom:'24px' }}>My Account</h2>

              {/* Profile card */}
              <div style={{ background:'var(--bg-dark)', borderRadius:'8px', overflow:'hidden', marginBottom:'24px' }}>
                <div style={{ height:'80px', background:'linear-gradient(135deg, var(--accent), #7289da)' }} />
                <div style={{ padding:'0 20px 20px', marginTop:'-40px', display:'flex', alignItems:'flex-end', gap:'16px', flexWrap:'wrap' }}>
                  <div style={{ position:'relative', cursor:'pointer' }} onClick={() => fileRef.current?.click()}>
                    <div style={{ borderRadius:'50%', border:'4px solid var(--bg-dark)', overflow:'hidden' }}>
                      <UserAvatar user={user} size={80} />
                    </div>
                    <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 0.15s', fontSize:'12px', fontWeight:700, color:'#fff' }}
                      onMouseEnter={e => e.currentTarget.style.opacity=1}
                      onMouseLeave={e => e.currentTarget.style.opacity=0}>
                      Change
                    </div>
                    <input ref={fileRef} type="file" style={{ display:'none' }} accept="image/*" onChange={uploadAvatar} />
                  </div>
                  <div style={{ paddingBottom:'4px' }}>
                    <p style={{ color:'#fff', fontWeight:800, fontSize:'20px' }}>{user?.displayName}</p>
                    <p style={{ color:'var(--text-muted)', fontSize:'14px' }}>@{user?.username}</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div style={{ background:'var(--bg-dark)', borderRadius:'8px', padding:'20px', marginBottom:'16px' }}>
                <p style={{ fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'12px' }}>Status</p>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {STATUS_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => setStatus(s.value)}
                      style={{
                        display:'flex', alignItems:'center', gap:'8px',
                        padding:'8px 14px', borderRadius:'6px',
                        background: user?.status === s.value ? 'var(--accent-light)' : 'var(--bg-input)',
                        border: `1px solid ${user?.status === s.value ? 'var(--accent)' : 'transparent'}`,
                        color: user?.status === s.value ? 'var(--accent)' : 'var(--text-muted)',
                        fontSize:'14px', fontWeight:500, transition:'all 0.15s',
                      }}>
                      <span>{s.dot}</span>{s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edit fields */}
              <div style={{ background:'var(--bg-dark)', borderRadius:'8px', padding:'20px', marginBottom:'16px' }}>
                <p style={{ fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'16px' }}>Profile Info</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                  {[
                    { name:'displayName', label:'Display Name' },
                    { name:'username',    label:'Username' },
                  ].map(({ name, label }) => (
                    <div key={name}>
                      <label style={{ display:'block', fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'8px' }}>{label}</label>
                      <input name={name} value={form[name]} onChange={onFormChange}
                        style={{ width:'100%', background:'var(--bg-darker)', border:'1px solid var(--border)', borderRadius:'4px', padding:'10px 12px', color:'var(--text)', fontSize:'15px' }} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom:'16px' }}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'8px' }}>Custom Status</label>
                  <input name="customStatus" value={form.customStatus} onChange={onFormChange} placeholder="What are you up to?"
                    style={{ width:'100%', background:'var(--bg-darker)', border:'1px solid var(--border)', borderRadius:'4px', padding:'10px 12px', color:'var(--text)', fontSize:'15px' }} />
                </div>
                <div style={{ marginBottom:'16px' }}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'8px' }}>Email</label>
                  <input value={user?.email || ''} readOnly
                    style={{ width:'100%', background:'var(--bg-modifier)', border:'1px solid var(--border)', borderRadius:'4px', padding:'10px 12px', color:'var(--text-muted)', fontSize:'15px', cursor:'not-allowed' }} />
                </div>
                <button onClick={saveProfile} disabled={saving} className="btn-primary" style={{ borderRadius:'4px' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>

              {/* Change Password */}
              <div style={{ background:'var(--bg-dark)', borderRadius:'8px', padding:'20px' }}>
                <p style={{ fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'16px' }}>Change Password</p>
                <form onSubmit={changePassword}>
                  {[
                    { name:'current', label:'Current Password', val:pwForm.current },
                    { name:'newPw',   label:'New Password',     val:pwForm.newPw },
                    { name:'confirm', label:'Confirm New Password', val:pwForm.confirm },
                  ].map(({ name, label, val }) => (
                    <div key={name} style={{ marginBottom:'12px' }}>
                      <label style={{ display:'block', fontSize:'12px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'8px' }}>{label}</label>
                      <input type="password" value={val} onChange={e => setPwForm(f => ({ ...f, [name]: e.target.value }))}
                        style={{ width:'100%', background:'var(--bg-darker)', border:'1px solid var(--border)', borderRadius:'4px', padding:'10px 12px', color:'var(--text)', fontSize:'15px' }} />
                    </div>
                  ))}
                  <button type="submit" className="btn-primary" style={{ borderRadius:'4px' }}>Change Password</button>
                </form>
              </div>
            </div>
          )}

          {/* Telegram */}
          {section === 'telegram' && (
            <div>
              <h2 style={{ color:'#fff', fontSize:'20px', fontWeight:800, marginBottom:'8px' }}>Telegram Integration</h2>
              <p style={{ color:'var(--text-muted)', marginBottom:'24px', fontSize:'15px', lineHeight:1.6 }}>
                Link your Telegram account to receive message notifications and reply directly from Telegram.
              </p>

              {user?.telegram?.isLinked ? (
                <div style={{ background:'var(--bg-dark)', borderRadius:'8px', padding:'24px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
                    <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#0088cc', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px' }}>✈️</div>
                    <div>
                      <p style={{ color:'var(--green)', fontWeight:700, fontSize:'16px', display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--green)', display:'inline-block' }} />
                        Connected
                      </p>
                      <p style={{ color:'var(--text-muted)', fontSize:'14px' }}>@{user.telegram.username}</p>
                    </div>
                  </div>
                  <button onClick={async () => { await api.post('/users/telegram/unlink'); updateUser({ telegram: { isLinked:false } }); toast.success('Unlinked'); }}
                    className="btn-danger" style={{ borderRadius:'4px', fontSize:'14px', padding:'8px 16px' }}>
                    Unlink Telegram
                  </button>
                </div>
              ) : (
                <div style={{ background:'var(--bg-dark)', borderRadius:'8px', padding:'24px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
                    <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:'#0088cc', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px' }}>✈️</div>
                    <div>
                      <p style={{ color:'#fff', fontWeight:700 }}>Not connected</p>
                      <p style={{ color:'var(--text-muted)', fontSize:'14px' }}>Link your Telegram to get notifications</p>
                    </div>
                  </div>

                  {tgInfo ? (
                    <div>
                      <p style={{ color:'var(--text-muted)', fontSize:'14px', marginBottom:'12px' }}>Send this code to the bot:</p>
                      <div style={{ background:'var(--bg-darker)', borderRadius:'8px', padding:'20px', textAlign:'center', marginBottom:'12px', border:'1px solid var(--border)' }}>
                        <p style={{ color:'#fff', fontSize:'32px', fontWeight:800, letterSpacing:'8px', fontFamily:'monospace' }}>{tgInfo.code}</p>
                      </div>
                      <p style={{ color:'var(--text-muted)', fontSize:'13px', lineHeight:1.6 }}>{tgInfo.instruction}</p>
                      <p style={{ color:'var(--text-faint)', fontSize:'12px', marginTop:'8px' }}>⏱ Expires in 10 minutes</p>
                    </div>
                  ) : (
                    <button onClick={getTelegramCode} disabled={tgLoading}
                      style={{ background:'#0088cc', color:'#fff', padding:'10px 20px', borderRadius:'6px', fontWeight:600, fontSize:'15px', opacity:tgLoading?0.7:1 }}>
                      {tgLoading ? 'Generating…' : '🔗 Link Telegram Account'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Privacy */}
          {section === 'privacy' && (
            <div>
              <h2 style={{ color:'#fff', fontSize:'20px', fontWeight:800, marginBottom:'24px' }}>Privacy & Safety</h2>
              <div style={{ background:'var(--bg-dark)', borderRadius:'8px', padding:'24px', marginBottom:'16px' }}>
                <p style={{ color:'var(--text)', lineHeight:1.7, fontSize:'15px' }}>
                  Your data is encrypted in transit using TLS and stored securely. Passwords are hashed with bcrypt. We never sell your data.
                </p>
              </div>
              <div style={{ background:'var(--bg-dark)', borderRadius:'8px', padding:'24px' }}>
                <h3 style={{ color:'var(--red)', fontWeight:700, marginBottom:'8px' }}>Danger Zone</h3>
                <p style={{ color:'var(--text-muted)', fontSize:'14px', marginBottom:'16px' }}>These actions are permanent and cannot be undone.</p>
                <button className="btn-danger" style={{ borderRadius:'4px', fontSize:'14px', padding:'8px 16px' }}>Delete Account</button>
              </div>
            </div>
          )}

          {section === 'profile' && (
            <div>
              <h2 style={{ color:'#fff', fontSize:'20px', fontWeight:800, marginBottom:'24px' }}>Profile</h2>
              <div style={{ background:'var(--bg-dark)', borderRadius:'8px', padding:'24px', display:'flex', alignItems:'center', gap:'20px' }}>
                <UserAvatar user={user} size={80} showStatus />
                <div>
                  <p style={{ color:'#fff', fontWeight:800, fontSize:'22px' }}>{user?.displayName}</p>
                  <p style={{ color:'var(--text-muted)' }}>@{user?.username}</p>
                  <p style={{ color:'var(--text-muted)', fontSize:'13px', marginTop:'8px' }}>Member since {new Date(user?.createdAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
