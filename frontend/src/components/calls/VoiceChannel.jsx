/**
 * VoiceChannel – Mesh WebRTC voice/video room for server channels.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import useAuthStore from '../../context/authStore';
import UserAvatar from '../common/UserAvatar';
import SimplePeer from 'simple-peer';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function VoiceChannel({ channel }) {
  const { user }   = useAuthStore();
  const { emit, on } = useSocket();
  const [joined, setJoined]   = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(true);
  const [participants, setParticipants] = useState([]);
  const localStreamRef = useRef(null);
  const peersRef       = useRef({});
  const [remoteStreams, setRemoteStreams] = useState({});

  const joinChannel = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      emit('voice:join', { channelId: channel._id });
      setJoined(true);
    } catch {
      alert('Could not access microphone');
    }
  };

  const leaveChannel = () => {
    emit('voice:leave', { channelId: channel._id });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    Object.values(peersRef.current).forEach(p => p.destroy());
    peersRef.current = {};
    setRemoteStreams({});
    setParticipants([]);
    setJoined(false);
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
    emit('voice:mute', { channelId: channel._id, isMuted: !isMuted });
  };

  useEffect(() => {
    if (!joined) return;
    const rm1 = on('voice:userJoined', ({ userId, username, socketId }) => {
      setParticipants(p => [...p.filter(x => x.socketId !== socketId), { userId, username, socketId }]);
      // Create initiator peer
      const peer = new SimplePeer({ initiator: true, stream: localStreamRef.current, trickle: true, config: { iceServers: ICE_SERVERS } });
      peer.on('signal', d => emit('signal:offer', { targetSocketId: socketId, offer: d }));
      peer.on('stream', s => setRemoteStreams(r => ({ ...r, [socketId]: s })));
      peersRef.current[socketId] = peer;
    });
    const rm2 = on('voice:userLeft', ({ userId }) => {
      setParticipants(p => p.filter(x => x.userId !== userId));
      Object.entries(peersRef.current).forEach(([sid, peer]) => {
        setRemoteStreams(r => { const n = { ...r }; delete n[sid]; return n; });
        peer.destroy();
        delete peersRef.current[sid];
      });
    });
    const rm3 = on('voice:currentParticipants', ({ participants: pts }) => {
      setParticipants(pts.map(sid => ({ socketId: sid })));
    });
    const rm4 = on('signal:offer', ({ offer, fromSocketId }) => {
      const peer = new SimplePeer({ initiator: false, stream: localStreamRef.current, trickle: true, config: { iceServers: ICE_SERVERS } });
      peer.on('signal', d => emit('signal:answer', { targetSocketId: fromSocketId, answer: d }));
      peer.on('stream', s => setRemoteStreams(r => ({ ...r, [fromSocketId]: s })));
      peer.signal(offer);
      peersRef.current[fromSocketId] = peer;
    });
    const rm5 = on('signal:answer', ({ answer, fromSocketId }) => peersRef.current[fromSocketId]?.signal(answer));
    const rm6 = on('signal:ice-candidate', ({ candidate, fromSocketId }) => peersRef.current[fromSocketId]?.signal(candidate));
    const rm7 = on('voice:userMuted', ({ userId, isMuted }) =>
      setParticipants(p => p.map(x => x.userId === userId ? { ...x, isMuted } : x)));
    return () => { rm1?.(); rm2?.(); rm3?.(); rm4?.(); rm5?.(); rm6?.(); rm7?.(); };
  }, [joined, on, emit]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 bg-cb-bg">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">🔊 {channel.name}</h2>
        <p className="text-cb-text-muted text-sm">Voice Channel</p>
      </div>

      {/* Participant tiles */}
      <div className="flex flex-wrap gap-4 justify-center">
        {joined && (
          <div className="flex flex-col items-center gap-2 bg-cb-bg-dark rounded-xl p-4 w-32">
            <div className="relative">
              <UserAvatar user={user} size={64} />
              {isMuted && <span className="absolute -bottom-1 -right-1 bg-cb-red rounded-full text-xs p-0.5">🔇</span>}
            </div>
            <span className="text-white text-sm font-medium text-center">{user?.displayName} (You)</span>
          </div>
        )}
        {participants.map(p => (
          <div key={p.socketId} className="flex flex-col items-center gap-2 bg-cb-bg-dark rounded-xl p-4 w-32">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-cb-accent flex items-center justify-center text-2xl">👤</div>
              {p.isMuted && <span className="absolute -bottom-1 -right-1 bg-cb-red rounded-full text-xs p-0.5">🔇</span>}
            </div>
            <span className="text-white text-sm font-medium text-center">{p.username || 'Participant'}</span>
            {/* Remote audio */}
            {remoteStreams[p.socketId] && (
              <audio autoPlay ref={el => { if (el && remoteStreams[p.socketId]) el.srcObject = remoteStreams[p.socketId]; }} />
            )}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {!joined ? (
          <button onClick={joinChannel}
            className="bg-cb-green hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2">
            🎙️ Join Voice
          </button>
        ) : (
          <>
            <button onClick={toggleMute}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isMuted ? 'bg-cb-red text-white' : 'bg-cb-bg-input text-white hover:bg-cb-bg'}`}>
              {isMuted ? '🔇 Unmute' : '🎤 Mute'}
            </button>
            <button onClick={leaveChannel}
              className="bg-cb-red hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              📵 Leave
            </button>
          </>
        )}
      </div>
    </div>
  );
}
