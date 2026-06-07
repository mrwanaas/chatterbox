/**
 * MessageList – Real-time, infinite-scroll message feed.
 * Fixes: instant delivery, proper socket room joining, typing indicators.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { format, isToday, isYesterday, isSameDay, isSameMinute } from 'date-fns';
import useChatStore from '../../context/chatStore';
import { useSocket } from '../../context/SocketContext';
import useAuthStore from '../../context/authStore';
import MessageItem from './MessageItem';
import api from '../../services/api';

/* ── Date divider ────────────────────────────────────────────────────── */
function DateDivider({ date }) {
  const d = new Date(date);
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy');
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'16px 16px 4px', userSelect:'none' }}>
      <div style={{ flex:1, height:'1px', background:'var(--border)' }} />
      <span style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{label}</span>
      <div style={{ flex:1, height:'1px', background:'var(--border)' }} />
    </div>
  );
}

/* ── Typing indicator ────────────────────────────────────────────────── */
function TypingIndicator({ users }) {
  if (!users?.length) return null;
  const names = users.slice(0, 3).map(u => u.username).join(', ');
  const suffix = users.length > 3 ? ` and ${users.length - 3} others` : '';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'4px 16px 8px', minHeight:'24px' }}>
      <span style={{ display:'flex', gap:'3px', alignItems:'center' }}>
        {[0,1,2].map(i => (
          <span key={i} style={{
            width:'6px', height:'6px', borderRadius:'50%', background:'var(--text-muted)',
            animation:`bounce 1.2s ease infinite`, animationDelay:`${i*0.15}s`,
          }} />
        ))}
      </span>
      <span style={{ fontSize:'13px', color:'var(--text-muted)' }}>
        <strong style={{ color:'var(--text)' }}>{names}{suffix}</strong> {users.length === 1 ? 'is' : 'are'} typing…
      </span>
    </div>
  );
}

/* ── Welcome message ─────────────────────────────────────────────────── */
function WelcomeMsg({ roomType, name }) {
  return (
    <div style={{ padding:'32px 16px 16px' }}>
      <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'32px', marginBottom:'16px' }}>
        {roomType === 'channel' ? '#' : '💬'}
      </div>
      <h2 style={{ fontSize:'28px', fontWeight:800, color:'#fff', marginBottom:'8px' }}>
        {roomType === 'channel' ? `Welcome to #${name}!` : `Your conversation with ${name}`}
      </h2>
      <p style={{ color:'var(--text-muted)', fontSize:'15px' }}>
        {roomType === 'channel'
          ? 'This is the start of this channel. Send a message to get the conversation started!'
          : 'This is the beginning of your direct message history.'}
      </p>
    </div>
  );
}

export default function MessageList({ roomId, roomType, name }) {
  const bottomRef  = useRef(null);
  const listRef    = useRef(null);
  const prevHeight = useRef(0);
  const isAtBottom = useRef(true);

  const { user } = useAuthStore();
  const { messages, hasMore, loadingMessages, loadMessages,
          addMessage, updateMessage, deleteMessage, updateReactions,
          typingUsers, setTyping, removeTyping } = useChatStore();
  const { joinChannel, leaveChannel, joinDM, leaveDM, on } = useSocket();

  const roomMessages = messages[roomId] || [];
  const typingList   = typingUsers[roomId] || [];
  const isLoading    = loadingMessages[roomId];

  /* ── Track scroll position ─────────────────────────────────────────── */
  const onScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    isAtBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;

    // Load older messages when scrolled to top
    if (list.scrollTop < 100 && !isLoading && hasMore[roomId]) {
      prevHeight.current = list.scrollHeight;
      const oldest = roomMessages[0]?._id;
      loadMessages(roomId, roomType, oldest);
    }
  }, [isLoading, hasMore, roomId, roomMessages, loadMessages, roomType]);

  /* ── Restore scroll position after loading older messages ──────────── */
  useEffect(() => {
    const list = listRef.current;
    if (!list || !prevHeight.current) return;
    list.scrollTop = list.scrollHeight - prevHeight.current;
    prevHeight.current = 0;
  }, [roomMessages.length]);

  /* ── Scroll to bottom on new messages ──────────────────────────────── */
  useEffect(() => {
    if (isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [roomMessages.length]);

  /* ── Join room and load messages ───────────────────────────────────── */
  useEffect(() => {
    if (!roomId) return;
    if (roomType === 'channel') joinChannel(roomId);
    else joinDM(roomId);

    // Only load if we don't have messages yet
    if (!messages[roomId]) loadMessages(roomId, roomType);

    // Scroll to bottom when switching rooms
    setTimeout(() => bottomRef.current?.scrollIntoView(), 100);

    return () => {
      if (roomType === 'channel') leaveChannel(roomId);
      else leaveDM(roomId);
    };
  }, [roomId, roomType]);

  /* ── Real-time socket listeners ────────────────────────────────────── */
  useEffect(() => {
    if (!roomId) return;

    const handlers = [
      on('message:new', ({ message, chatId }) => {
        const id = chatId || message.channel;
        if (String(id) === String(roomId)) {
          addMessage(roomId, message);
        }
      }),
      on('message:updated', ({ message }) => {
        if (String(message.channel || message.dmChat) === String(roomId))
          updateMessage(roomId, message);
      }),
      on('message:deleted', ({ messageId, channelId, chatId }) => {
        if (String(channelId || chatId) === String(roomId))
          deleteMessage(roomId, messageId);
      }),
      on('message:reaction', ({ messageId, reactions }) =>
        updateReactions(roomId, messageId, reactions)),
      on('typing:start', data => {
        if (data.userId !== user?._id) setTyping(roomId, data);
      }),
      on('typing:stop', ({ userId }) => removeTyping(roomId, userId)),
    ];

    return () => handlers.forEach(rm => rm?.());
  }, [roomId, on, user?._id]);

  useEffect(() => {
    const list = listRef.current;
    list?.addEventListener('scroll', onScroll, { passive: true });
    return () => list?.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  /* ── Group messages ────────────────────────────────────────────────── */
  const grouped = roomMessages.map((msg, i) => {
    const prev    = roomMessages[i - 1];
    const msgDate = new Date(msg.createdAt);
    const showDate   = !prev || !isSameDay(new Date(prev.createdAt), msgDate);
    const isCompact  = prev && !showDate &&
      prev.author?._id === msg.author?._id &&
      !msg.replyTo &&
      (msgDate - new Date(prev.createdAt)) < 7 * 60 * 1000;
    return { msg, showDate, isCompact };
  });

  return (
    <div ref={listRef} style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>
      {/* Top loading spinner */}
      {isLoading && (
        <div style={{ display:'flex', justifyContent:'center', padding:'16px' }}>
          <div style={{ width:'24px', height:'24px', border:'3px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%' }} className="animate-spin" />
        </div>
      )}

      {/* Welcome / beginning of history */}
      {!isLoading && !hasMore[roomId] && (
        <WelcomeMsg roomType={roomType} name={name || 'this channel'} />
      )}

      <div style={{ flex:1 }} />

      {/* Messages */}
      {grouped.map(({ msg, showDate, isCompact }) => (
        <React.Fragment key={msg._id}>
          {showDate && <DateDivider date={msg.createdAt} />}
          <MessageItem
            message={msg}
            compact={isCompact}
            roomId={roomId}
            roomType={roomType}
            currentUserId={user?._id}
          />
        </React.Fragment>
      ))}

      <TypingIndicator users={typingList} />
      <div ref={bottomRef} style={{ height:'1px' }} />
    </div>
  );
}
