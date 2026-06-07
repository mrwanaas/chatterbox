import React from 'react';

const STATUS_COLOR = { online:'#23a55a', idle:'#f0b232', dnd:'#f23f43', offline:'#80848e' };

export default function UserAvatar({ user, size = 40, showStatus = false, className = '' }) {
  const name = user?.displayName || user?.username || '?';
  const src  = user?.avatar
    ? user.avatar
    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=5865f2&textColor=ffffff`;

  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <img
        src={src}
        alt={name}
        style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover', background:'var(--bg-input)', display:'block' }}
        onError={e => {
          e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=5865f2&textColor=ffffff`;
        }}
      />
      {showStatus && (
        <span style={{
          position:'absolute', bottom: size > 32 ? '-1px' : '0', right: size > 32 ? '-1px' : '0',
          width: Math.max(8, size * 0.28), height: Math.max(8, size * 0.28),
          borderRadius:'50%',
          background: STATUS_COLOR[user?.status] || STATUS_COLOR.offline,
          border: '2px solid var(--bg-dark)',
          display:'block',
        }} />
      )}
    </div>
  );
}
