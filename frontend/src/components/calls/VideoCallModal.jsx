/**
 * VideoCallModal – Full-screen call UI with local/remote video tiles,
 * mute, camera, screen share, and hang-up controls.
 */
import React, { useRef, useEffect } from 'react';
import useWebRTC from '../../hooks/useWebRTC';

function VideoTile({ stream, label, muted = false, large = false }) {
  const videoRef = useRef();
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);
  return (
    <div className={`relative bg-cb-bg-darker rounded-xl overflow-hidden flex items-center justify-center
      ${large ? 'flex-1 min-h-[300px]' : 'w-48 h-36'}`}>
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-cb-text-muted">
          <span className="text-4xl">🎥</span>
          <span className="text-sm">Camera off</span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded">{label}</span>
    </div>
  );
}

export default function VideoCallModal() {
  const {
    localStream, remoteStreams, callState, callInfo,
    isMuted, isCameraOff, isScreenSharing,
    endCall, toggleMute, toggleCamera, startScreenShare, stopScreenShare,
  } = useWebRTC();

  if (callState !== 'ongoing') return null;

  const remoteEntries = Object.entries(remoteStreams);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center animate-fade-in">
      {/* Video grid */}
      <div className="flex flex-wrap gap-4 justify-center items-center flex-1 p-6 w-full">
        {remoteEntries.length === 0 ? (
          <div className="text-cb-text-muted text-center">
            <div className="text-5xl mb-3">📡</div>
            <p>Connecting…</p>
          </div>
        ) : (
          remoteEntries.map(([socketId, stream]) => (
            <VideoTile key={socketId} stream={stream} label={callInfo?.callerName || 'Participant'} large />
          ))
        )}
      </div>

      {/* Local video (picture-in-picture) */}
      <div className="absolute bottom-24 right-6">
        <VideoTile stream={localStream} label="You" muted large={false} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 pb-8">
        <ControlBtn onClick={toggleMute} active={isMuted} icon={isMuted ? '🔇' : '🎤'} label={isMuted ? 'Unmute' : 'Mute'} />
        <ControlBtn onClick={toggleCamera} active={isCameraOff} icon={isCameraOff ? '🚫' : '📷'} label={isCameraOff ? 'Start cam' : 'Stop cam'} />
        {callInfo?.callType === 'video' && (
          <ControlBtn onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            active={isScreenSharing} icon="🖥️" label={isScreenSharing ? 'Stop share' : 'Share screen'} />
        )}
        <button onClick={endCall}
          className="flex flex-col items-center gap-1 bg-cb-red hover:bg-red-600 text-white rounded-full w-14 h-14 flex items-center justify-center text-2xl transition-colors shadow-lg">
          📵
        </button>
      </div>
    </div>
  );
}

function ControlBtn({ onClick, active, icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-1 w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-colors shadow
        ${active ? 'bg-cb-red text-white' : 'bg-cb-bg-input text-white hover:bg-cb-bg'}`}>
      {icon}
    </button>
  );
}
