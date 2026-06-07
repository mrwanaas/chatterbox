/**
 * useWebRTC hook
 * Manages WebRTC peer connections for 1-on-1 and group voice/video calls.
 * Uses simple-peer for peer abstraction and Socket.io for signalling.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import SimplePeer from 'simple-peer';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Add TURN servers here for production
];

const useWebRTC = () => {
  const { socket, on, off, emit } = useSocket();

  const localStreamRef   = useRef(null);
  const peersRef         = useRef({}); // socketId -> SimplePeer instance
  const [localStream, setLocalStream]   = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream
  const [callState, setCallState] = useState('idle'); // idle | ringing | ongoing
  const [callInfo, setCallInfo]   = useState(null);   // caller/callee details
  const [isMuted, setIsMuted]     = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // ── Cleanup all peers ──────────────────────────────────────────────────────
  const destroyAllPeers = useCallback(() => {
    Object.values(peersRef.current).forEach((peer) => {
      try { peer.destroy(); } catch { /* ignore */ }
    });
    peersRef.current = {};
    setRemoteStreams({});
  }, []);

  // ── Get user media ─────────────────────────────────────────────────────────
  const getMedia = useCallback(async (video = false) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  // ── Stop local stream ──────────────────────────────────────────────────────
  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  // ── Create a peer ──────────────────────────────────────────────────────────
  const createPeer = useCallback((targetSocketId, initiator, stream) => {
    const peer = new SimplePeer({
      initiator,
      stream,
      trickle: true,
      config: { iceServers: ICE_SERVERS },
    });

    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        emit('signal:offer', { targetSocketId, offer: data });
      } else if (data.type === 'answer') {
        emit('signal:answer', { targetSocketId, answer: data });
      } else {
        emit('signal:ice-candidate', { targetSocketId, candidate: data });
      }
    });

    peer.on('stream', (remoteStream) => {
      setRemoteStreams((prev) => ({ ...prev, [targetSocketId]: remoteStream }));
    });

    peer.on('close', () => {
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[targetSocketId];
        return next;
      });
      delete peersRef.current[targetSocketId];
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
    });

    peersRef.current[targetSocketId] = peer;
    return peer;
  }, [emit]);

  // ── Initiate a 1-on-1 call ─────────────────────────────────────────────────
  const initiateCall = useCallback(async (targetUserId, callType = 'voice', dmChatId) => {
    try {
      const stream = await getMedia(callType === 'video');
      setCallState('ringing');
      setCallInfo({ targetUserId, callType, dmChatId, direction: 'outgoing' });
      emit('call:initiate', { targetUserId, callType, dmChatId });
    } catch (err) {
      toast.error('Could not access microphone/camera');
      console.error(err);
    }
  }, [getMedia, emit]);

  // ── Accept an incoming call ────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!callInfo) return;
    try {
      const stream = await getMedia(callInfo.callType === 'video');
      setCallState('ongoing');
      emit('call:accept', { callerSocketId: callInfo.callerSocketId, callType: callInfo.callType });
      // Caller creates the peer as initiator; receiver just waits for offer
    } catch (err) {
      toast.error('Could not access microphone/camera');
    }
  }, [callInfo, getMedia, emit]);

  // ── Decline / end call ─────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    if (callInfo?.callerSocketId) {
      emit('call:decline', { callerSocketId: callInfo.callerSocketId });
    }
    if (callInfo?.targetSocketId) {
      emit('call:end', { targetSocketId: callInfo.targetSocketId });
    }
    destroyAllPeers();
    stopLocalStream();
    setCallState('idle');
    setCallInfo(null);
  }, [callInfo, emit, destroyAllPeers, stopLocalStream]);

  // ── Toggle mute ────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = stream.getAudioTracks()[0]?.enabled;
    stream.getAudioTracks().forEach((t) => { t.enabled = !enabled; });
    setIsMuted(!enabled);
  }, []);

  // ── Toggle camera ──────────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = stream.getVideoTracks()[0]?.enabled;
    stream.getVideoTracks().forEach((t) => { t.enabled = !enabled; });
    setIsCameraOff(!enabled);
  }, []);

  // ── Screen sharing ─────────────────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = screenStream.getVideoTracks()[0];

      // Replace video track in all peers
      Object.values(peersRef.current).forEach((peer) => {
        const sender = peer._pc?.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });

      // Replace in local stream
      const localTrack = localStreamRef.current?.getVideoTracks()[0];
      if (localTrack) {
        localStreamRef.current.removeTrack(localTrack);
        localStreamRef.current.addTrack(videoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      setIsScreenSharing(true);
      videoTrack.onended = () => stopScreenShare();
    } catch (err) {
      toast.error('Screen sharing failed');
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    setIsScreenSharing(false);
    // Re-get camera track
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = cameraStream.getVideoTracks()[0];
      Object.values(peersRef.current).forEach((peer) => {
        const sender = peer._pc?.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });
    } catch { /* ignore */ }
  }, []);

  // ── Socket event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const removeIncoming = on('call:incoming', (data) => {
      setCallState('ringing');
      setCallInfo({ ...data, direction: 'incoming' });
    });

    const removeAccepted = on('call:accepted', ({ socketId, callType }) => {
      setCallState('ongoing');
      // Initiator creates peer
      const stream = localStreamRef.current;
      if (stream) createPeer(socketId, true, stream);
    });

    const removeDeclined = on('call:declined', () => {
      toast('Call declined', { icon: '📵' });
      endCall();
    });

    const removeEnded = on('call:ended', () => {
      toast('Call ended');
      destroyAllPeers();
      stopLocalStream();
      setCallState('idle');
      setCallInfo(null);
    });

    const removeOffer = on('signal:offer', ({ offer, fromSocketId }) => {
      const stream = localStreamRef.current;
      if (!stream) return;
      const peer = createPeer(fromSocketId, false, stream);
      peer.signal(offer);
    });

    const removeAnswer = on('signal:answer', ({ answer, fromSocketId }) => {
      peersRef.current[fromSocketId]?.signal(answer);
    });

    const removeIce = on('signal:ice-candidate', ({ candidate, fromSocketId }) => {
      peersRef.current[fromSocketId]?.signal(candidate);
    });

    return () => {
      removeIncoming?.();
      removeAccepted?.();
      removeDeclined?.();
      removeEnded?.();
      removeOffer?.();
      removeAnswer?.();
      removeIce?.();
    };
  }, [on, createPeer, endCall, destroyAllPeers, stopLocalStream]);

  return {
    localStream,
    remoteStreams,
    callState,
    callInfo,
    isMuted,
    isCameraOff,
    isScreenSharing,
    initiateCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
  };
};

export default useWebRTC;
