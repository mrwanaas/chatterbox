import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import AppSidebar    from '../components/layout/AppSidebar';
import ServerSidebar from '../components/layout/ServerSidebar';
import MessageList   from '../components/messages/MessageList';
import MessageInput  from '../components/messages/MessageInput';
import VoiceChannel  from '../components/calls/VoiceChannel';

export default function ServerPage() {
  const { serverId, channelId } = useParams();
  const [channel, setChannel]   = useState(null);

  useEffect(() => {
    if (!channelId || !serverId) { setChannel(null); return; }
    api.get(`/channels/${serverId}`)
      .then(({ data }) => {
        const ch = data.channels?.find(c => c._id === channelId);
        setChannel(ch || null);
      }).catch(() => {});
  }, [serverId, channelId]);

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <AppSidebar />
      <ServerSidebar />

      {channelId && channel ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:'var(--bg)' }}>
          {/* Channel header */}
          <div style={{ height:'48px', display:'flex', alignItems:'center', padding:'0 16px', gap:'10px', borderBottom:'1px solid var(--border)', flexShrink:0, boxShadow:'0 1px 0 var(--border)' }}>
            <span style={{ color:'var(--text-muted)', fontWeight:700, fontSize:'20px' }}>
              {channel.type === 'voice' ? '🔊' : '#'}
            </span>
            <span style={{ fontWeight:700, color:'#fff', fontSize:'16px' }}>{channel.name}</span>
            {channel.description && (
              <>
                <div style={{ width:'1px', height:'20px', background:'var(--border)', marginLeft:'4px' }} />
                <span style={{ color:'var(--text-muted)', fontSize:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {channel.description}
                </span>
              </>
            )}
          </div>

          {channel.type === 'voice' ? (
            <VoiceChannel channel={channel} />
          ) : (
            <>
              <MessageList roomId={channelId} roomType="channel" name={channel.name} />
              <MessageInput roomId={channelId} roomType="channel" placeholder={`Message #${channel.name}`} />
            </>
          )}
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg)', gap:'12px' }}>
          <div style={{ fontSize:'72px' }}>📺</div>
          <h2 style={{ fontSize:'22px', fontWeight:800, color:'#fff' }}>Pick a channel</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'15px' }}>Select a channel from the left to start chatting.</p>
        </div>
      )}
    </div>
  );
}
