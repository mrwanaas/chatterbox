/**
 * IncomingCall – Ringing overlay when another user calls you.
 */
import React, { useEffect, useRef } from 'react';
import useWebRTC from '../../hooks/useWebRTC';
import UserAvatar from '../common/UserAvatar';

export default function IncomingCall() {
  const { callState, callInfo, acceptCall, endCall } = useWebRTC();
  const audioRef = useRef(null);

  useEffect(() => {
    if (callState === 'ringing' && callInfo?.direction === 'incoming') {
      // Play ringing sound (data URI of short beep)
      audioRef.current = new Audio('/ring.mp3');
      audioRef.current.loop = true;
      audioRef.current.play().catch(() => {});
    }
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, [callState, callInfo?.direction]);

  if (callState !== 'ringing' || callInfo?.direction !== 'incoming') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in">
      <div className="bg-cb-bg rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 w-80 animate-slide-up">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-cb-accent flex items-center justify-center text-3xl">
            {callInfo?.callType === 'video' ? '📹' : '📞'}
          </div>
          {/* Pulsing ring */}
          <span className="absolute inset-0 rounded-full border-4 border-cb-accent animate-ping opacity-30" />
        </div>

        <div className="text-center">
          <p className="text-white font-bold text-lg">{callInfo?.callerName || 'Someone'}</p>
          <p className="text-cb-text-muted text-sm">
            Incoming {callInfo?.callType === 'video' ? 'Video' : 'Voice'} Call…
          </p>
        </div>

        <div className="flex gap-6">
          <button onClick={endCall}
            className="w-14 h-14 rounded-full bg-cb-red hover:bg-red-600 text-white text-2xl flex items-center justify-center transition-colors shadow">
            📵
          </button>
          <button onClick={acceptCall}
            className="w-14 h-14 rounded-full bg-cb-green hover:bg-green-600 text-white text-2xl flex items-center justify-center transition-colors shadow">
            📞
          </button>
        </div>
      </div>
    </div>
  );
}
