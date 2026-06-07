import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';

export default function MessageInput({ roomId, roomType, placeholder }) {
  const [text,       setText]       = useState('');
  const [sending,    setSending]    = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [showEmoji,  setShowEmoji]  = useState(false);
  const fileRef     = useRef();
  const textRef     = useRef();
  const typingTimer = useRef(null);
  const { sendTypingStart, sendTypingStop } = useSocket();

  const EMOJI = ['😀','😂','🥹','😍','🤔','😎','🥳','😭','🔥','❤️','👍','👎','🎉','✅','❌','💯','🚀','⭐','💬','🎯','😊','🤣','😅','🙏','👀','💪','🤝','😴'];

  const doSend = useCallback(async () => {
    const content = text.trim();
    if (!content && !attachment) return;
    setSending(true);
    const url = roomType === 'channel' ? `/messages/${roomId}` : `/dms/${roomId}/messages`;
    try {
      if (attachment) {
        const fd = new FormData();
        if (content) fd.append('content', content);
        fd.append('file', attachment);
        await api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post(url, { content });
      }
      setText(''); setAttachment(null);
      if (textRef.current) textRef.current.style.height = 'auto';
      sendTypingStop(roomId, roomType);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message');
    } finally { setSending(false); }
  }, [text, attachment, roomId, roomType, sendTypingStop]);

  const onKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  const onTextChange = e => {
    setText(e.target.value);
    sendTypingStart(roomId, roomType);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => sendTypingStop(roomId, roomType), 3000);
    // Auto-resize
    const ta = textRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'; }
  };

  const onFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large (max 10 MB)'); return; }
    setAttachment(file);
    e.target.value = '';
  };

  const canSend = text.trim().length > 0 || !!attachment;

  return (
    <div style={{ padding:'0 16px 16px', flexShrink:0, position:'relative' }}>
      {/* Attachment preview */}
      {attachment && (
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px', background:'var(--bg-dark)', border:'1px solid var(--border)', borderRadius:'8px', padding:'10px 14px' }}>
          <span style={{ fontSize:'20px' }}>📎</span>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ color:'var(--text)', fontSize:'14px', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{attachment.name}</p>
            <p style={{ color:'var(--text-muted)', fontSize:'12px' }}>{(attachment.size/1024).toFixed(0)} KB</p>
          </div>
          <button onClick={() => setAttachment(null)}
            style={{ color:'var(--text-muted)', fontSize:'18px', lineHeight:1, padding:'2px 6px', borderRadius:'4px' }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--red-light)'; e.currentTarget.style.color='var(--red)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-muted)'; }}>
            ✕
          </button>
        </div>
      )}

      <div className="msg-input-box">
        {/* Attach file */}
        <button onClick={() => fileRef.current?.click()}
          style={{ color:'var(--text-muted)', fontSize:'22px', padding:'10px 4px', flexShrink:0, lineHeight:1, transition:'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color='var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}
          title="Attach file">
          ➕
          <input ref={fileRef} type="file" style={{ display:'none' }} onChange={onFile}
            accept="image/*,.pdf,.txt,.doc,.docx,.zip,.mp4,.mp3" />
        </button>

        {/* Text area */}
        <textarea
          ref={textRef}
          value={text}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder || 'Send a message…'}
          disabled={sending}
          rows={1}
          style={{
            flex:1, background:'transparent', color:'var(--text)', fontSize:'15px',
            resize:'none', outline:'none', border:'none', padding:'12px 0',
            lineHeight:1.5, maxHeight:'180px', fontFamily:'inherit',
          }}
        />

        {/* Emoji toggle */}
        <button onClick={() => setShowEmoji(p => !p)}
          style={{ color: showEmoji ? 'var(--yellow)' : 'var(--text-muted)', fontSize:'22px', padding:'10px 4px', flexShrink:0, lineHeight:1, transition:'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color='var(--yellow)'}
          onMouseLeave={e => e.currentTarget.style.color = showEmoji ? 'var(--yellow)' : 'var(--text-muted)'}
          title="Emoji">
          😊
        </button>

        {/* Send */}
        {canSend && (
          <button onClick={doSend} disabled={sending}
            style={{ color: sending ? 'var(--text-muted)' : 'var(--accent)', fontSize:'22px', padding:'10px 4px', flexShrink:0, lineHeight:1, transition:'color 0.15s, transform 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
            title="Send">
            ➤
          </button>
        )}
      </div>

      {/* Emoji picker */}
      {showEmoji && (
        <div style={{
          position:'absolute', bottom:'80px', right:'24px',
          background:'var(--bg-dark)', border:'1px solid var(--border)',
          borderRadius:'12px', padding:'12px', display:'flex', flexWrap:'wrap',
          gap:'4px', width:'260px', zIndex:50, boxShadow:'var(--shadow)',
          animation:'slideUp 0.15s ease',
        }}>
          {EMOJI.map(e => (
            <button key={e} onClick={() => { setText(p => p + e); setShowEmoji(false); textRef.current?.focus(); }}
              style={{ width:'36px', height:'36px', fontSize:'20px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.1s' }}
              onMouseEnter={ev => ev.currentTarget.style.background='var(--bg-hover)'}
              onMouseLeave={ev => ev.currentTarget.style.background='transparent'}>
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
