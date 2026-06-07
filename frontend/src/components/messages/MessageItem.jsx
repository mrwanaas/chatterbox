import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import UserAvatar from '../common/UserAvatar';

const QUICK_EMOJI = ['👍','❤️','😂','😮','😢','🎉','🔥','✅'];

export default function MessageItem({ message, compact, roomId, roomType, currentUserId }) {
  const [hovered,  setHovered]  = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [showPicker, setShowPicker] = useState(false);
  const editRef = useRef(null);

  const isOwn   = message.author?._id === currentUserId || message.author === currentUserId;
  const deleted = message.isDeleted;

  const saveEdit = async () => {
    if (!editText.trim()) return;
    try {
      const url = roomType === 'channel' ? `/messages/${roomId}/${message._id}` : `/dms/${roomId}/messages/${message._id}`;
      await api.patch(url, { content: editText });
      setEditing(false);
    } catch { toast.error('Failed to edit'); }
  };

  const deleteMsg = async () => {
    if (!window.confirm('Delete this message?')) return;
    try {
      const url = roomType === 'channel' ? `/messages/${roomId}/${message._id}` : `/dms/${roomId}/messages/${message._id}`;
      await api.delete(url);
    } catch { toast.error('Failed to delete'); }
  };

  const addReaction = async emoji => {
    try { await api.post(`/messages/${message._id}/react`, { emoji }); }
    catch { /* ignore */ }
    setShowPicker(false);
  };

  const ts = format(new Date(message.createdAt), compact ? 'HH:mm' : 'MMM d, h:mm a');

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowPicker(false); }}
      style={{
        position:'relative',
        display:'flex', gap:'16px',
        padding: compact ? '1px 16px' : '6px 16px',
        background: hovered ? 'rgba(0,0,0,0.06)' : 'transparent',
        transition:'background 0.1s',
        marginTop: compact ? 0 : '12px',
      }}
    >
      {/* Avatar / timestamp */}
      <div style={{ width:'40px', flexShrink:0, display:'flex', justifyContent:'center', paddingTop:'2px' }}>
        {compact ? (
          hovered && <span style={{ fontSize:'11px', color:'var(--text-muted)', lineHeight:'20px', whiteSpace:'nowrap' }}>{format(new Date(message.createdAt),'HH:mm')}</span>
        ) : (
          <UserAvatar user={message.author} size={40} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        {!compact && (
          <div style={{ display:'flex', alignItems:'baseline', gap:'8px', marginBottom:'2px' }}>
            <span style={{ fontWeight:600, color:'#fff', fontSize:'15px', cursor:'pointer' }}
              onMouseEnter={e => e.target.style.textDecoration='underline'}
              onMouseLeave={e => e.target.style.textDecoration='none'}>
              {message.author?.displayName || 'Unknown'}
            </span>
            <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>{ts}</span>
            {message.isEdited && <span style={{ fontSize:'11px', color:'var(--text-muted)', fontStyle:'italic' }}>(edited)</span>}
          </div>
        )}

        {deleted ? (
          <p style={{ color:'var(--text-muted)', fontStyle:'italic', fontSize:'14px' }}>This message was deleted.</p>
        ) : editing ? (
          <div>
            <textarea ref={editRef} autoFocus value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();saveEdit();} if(e.key==='Escape')setEditing(false); }}
              style={{ width:'100%', background:'var(--bg-input)', color:'var(--text)', border:'1px solid var(--accent)', borderRadius:'6px', padding:'10px 12px', fontSize:'15px', resize:'none', lineHeight:1.5, minHeight:'60px' }}
              rows={2}
            />
            <div style={{ display:'flex', gap:'8px', marginTop:'6px', fontSize:'13px', color:'var(--text-muted)' }}>
              <span>Press <kbd style={{ background:'var(--bg-input)', padding:'1px 5px', borderRadius:'3px', color:'var(--text)' }}>Enter</kbd> to save,{' '}
              <kbd style={{ background:'var(--bg-input)', padding:'1px 5px', borderRadius:'3px', color:'var(--text)' }}>Esc</kbd> to cancel</span>
              <button onClick={saveEdit} style={{ color:'var(--accent)', fontWeight:600, marginLeft:'auto' }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ color:'var(--text-muted)' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {/* Reply preview */}
            {message.replyTo && (
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', paddingLeft:'12px', borderLeft:'2px solid var(--border)', opacity:0.7 }}>
                <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                  ↩ {message.replyTo?.content?.slice(0, 60) || '[Attachment]'}
                </span>
              </div>
            )}

            <p className="msg-content" style={{ color:'var(--text)', fontSize:'15px', lineHeight:1.5 }}>
              {message.content}
            </p>

            {/* Attachments */}
            {message.attachments?.map((att, i) => (
              <div key={i} style={{ marginTop:'8px' }}>
                {att.mimetype?.startsWith('image/') ? (
                  <img src={att.url} alt={att.filename}
                    style={{ maxWidth:'400px', maxHeight:'300px', borderRadius:'8px', objectFit:'contain', border:'1px solid var(--border)', cursor:'pointer' }}
                    onClick={() => window.open(att.url, '_blank')} />
                ) : (
                  <a href={att.url} target="_blank" rel="noopener noreferrer"
                    style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--bg-dark)', border:'1px solid var(--border)', borderRadius:'6px', padding:'10px 14px', color:'var(--text)', fontSize:'14px', maxWidth:'300px' }}>
                    📎 <span style={{ truncate:true }}>{att.filename}</span>
                    <span style={{ color:'var(--text-muted)', fontSize:'12px', marginLeft:'auto' }}>
                      {(att.size / 1024).toFixed(0)} KB
                    </span>
                  </a>
                )}
              </div>
            ))}

            {/* Reactions */}
            {message.reactions?.filter(r => r.users?.length > 0).length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginTop:'6px' }}>
                {message.reactions.filter(r => r.users?.length > 0).map((r, i) => {
                  const reacted = r.users?.includes(currentUserId);
                  return (
                    <button key={i} onClick={() => addReaction(r.emoji)}
                      style={{
                        display:'flex', alignItems:'center', gap:'4px',
                        background: reacted ? 'var(--accent-light)' : 'var(--bg-input)',
                        border: `1px solid ${reacted ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius:'6px', padding:'2px 8px', cursor:'pointer',
                        fontSize:'14px', color: reacted ? 'var(--accent)' : 'var(--text)',
                        transition:'all 0.1s',
                      }}>
                      <span>{r.emoji}</span>
                      <span style={{ fontSize:'12px', fontWeight:600 }}>{r.users?.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Hover actions */}
      {hovered && !deleted && !editing && (
        <div style={{
          position:'absolute', right:'16px', top:'-18px',
          display:'flex', gap:'2px', background:'var(--bg-dark)',
          border:'1px solid var(--border)', borderRadius:'8px',
          padding:'3px', boxShadow:'var(--shadow)', zIndex:10,
        }}>
          {/* Quick reactions */}
          {QUICK_EMOJI.slice(0,4).map(e => (
            <button key={e} onClick={() => addReaction(e)}
              style={{ width:'30px', height:'30px', borderRadius:'6px', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.1s' }}
              onMouseEnter={ev => ev.currentTarget.style.background='var(--bg-hover)'}
              onMouseLeave={ev => ev.currentTarget.style.background='transparent'}>
              {e}
            </button>
          ))}
          <button onClick={() => setShowPicker(p => !p)}
            style={{ width:'30px', height:'30px', borderRadius:'6px', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}
            onMouseEnter={ev => ev.currentTarget.style.background='var(--bg-hover)'}
            onMouseLeave={ev => ev.currentTarget.style.background='transparent'}>
            😊
          </button>
          {isOwn && (
            <>
              <div style={{ width:'1px', background:'var(--border)', margin:'4px 2px' }} />
              <button onClick={() => { setEditing(true); setEditText(message.content); }}
                style={{ width:'30px', height:'30px', borderRadius:'6px', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}
                onMouseEnter={ev => ev.currentTarget.style.background='var(--bg-hover)'}
                onMouseLeave={ev => ev.currentTarget.style.background='transparent'}>
                ✏️
              </button>
              <button onClick={deleteMsg}
                style={{ width:'30px', height:'30px', borderRadius:'6px', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}
                onMouseEnter={ev => { ev.currentTarget.style.background='var(--red-light)'; ev.currentTarget.style.color='var(--red)'; }}
                onMouseLeave={ev => { ev.currentTarget.style.background='transparent'; ev.currentTarget.style.color='var(--text-muted)'; }}>
                🗑️
              </button>
            </>
          )}
        </div>
      )}

      {/* Emoji picker */}
      {showPicker && (
        <div style={{ position:'absolute', right:'16px', top:'24px', background:'var(--bg-dark)', border:'1px solid var(--border)', borderRadius:'10px', padding:'10px', display:'flex', flexWrap:'wrap', gap:'4px', width:'200px', zIndex:20, boxShadow:'var(--shadow)' }}>
          {QUICK_EMOJI.map(e => (
            <button key={e} onClick={() => addReaction(e)}
              style={{ width:'36px', height:'36px', borderRadius:'6px', fontSize:'20px', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.1s' }}
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
