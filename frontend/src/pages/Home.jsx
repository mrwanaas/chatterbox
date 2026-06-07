import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AppSidebar   from '../components/layout/AppSidebar';
import DMSidebar    from '../components/layout/DMSidebar';
import MessageList  from '../components/messages/MessageList';
import MessageInput from '../components/messages/MessageInput';
import UserAvatar   from '../components/common/UserAvatar';
import useAuthStore from '../context/authStore';
import useWebRTC    from '../hooks/useWebRTC';

export default function Home() {
  const { dmChatId }    = useParams();
  const { user }        = useAuthStore();
  const [chat, setChat] = useState(null);
  const { initiateCall } = useWebRTC();
  const navigate        = useNavigate();

  useEffect(() => {
    if (!dmChatId) { setChat(null); return; }
    api.get('/dms').then(({ data }) => {
      const found = data.chats.find(c => c._id === dmChatId);
      setChat(found || null);
    }).catch(() => {});
  }, [dmChatId]);

  const getOther = () => chat?.participants?.find(p => (p._id || p) !== user?._id && p._id !== user?._id);
  const other    = getOther();
  const chatName = chat?.isGroup ? chat.name : (other?.displayName || 'Unknown');

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <AppSidebar />
      <DMSidebar />

      {dmChatId && chat ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:'var(--bg)' }}>
          {/* DM Header */}
          <div style={{ height:'48px', display:'flex', alignItems:'center', padding:'0 16px', gap:'12px', borderBottom:'1px solid var(--border)', flexShrink:0, boxShadow:'0 1px 0 var(--border)' }}>
            {chat.isGroup ? (
              <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>👥</div>
            ) : (
              <UserAvatar user={other} size={28} showStatus />
            )}
            <span style={{ fontWeight:700, color:'#fff', fontSize:'16px', flex:1 }}>{chatName}</span>

            {/* Action buttons */}
            <div style={{ display:'flex', gap:'4px' }}>
              {!chat.isGroup && [
                { icon:'📞', title:'Voice Call', fn:() => initiateCall(other?._id,'voice') },
                { icon:'📹', title:'Video Call', fn:() => initiateCall(other?._id,'video') },
              ].map(({ icon, title, fn }) => (
                <button key={title} onClick={fn} title={title}
                  style={{ width:'36px', height:'36px', borderRadius:'6px', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', transition:'all 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.color='var(--text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-muted)'; }}>
                  {icon}
                </button>
              ))}
              {chat.isGroup && (
                <span style={{ color:'var(--text-muted)', fontSize:'13px', display:'flex', alignItems:'center', gap:'4px' }}>
                  👥 {chat.participants?.length} members
                </span>
              )}
            </div>
          </div>

          <MessageList roomId={dmChatId} roomType="dm" name={chatName} />
          <MessageInput roomId={dmChatId} roomType="dm" placeholder={`Message ${chatName}`} />
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg)', gap:'16px', padding:'40px' }}>
          <div style={{ fontSize:'80px', marginBottom:'8px' }}>💬</div>
          <h2 style={{ fontSize:'24px', fontWeight:800, color:'#fff' }}>Your Direct Messages</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'16px', textAlign:'center', maxWidth:'400px', lineHeight:1.6 }}>
            Select a conversation from the sidebar, or click a friend's name to start chatting.
          </p>
          <button onClick={() => navigate('/friends')}
            style={{ marginTop:'8px', background:'var(--accent)', color:'#fff', padding:'12px 24px', borderRadius:'6px', fontWeight:600, fontSize:'15px', transition:'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--accent-hover)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--accent)'}>
            Find Friends
          </button>
        </div>
      )}
    </div>
  );
}
