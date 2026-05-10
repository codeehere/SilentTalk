import { useEffect, useRef, useState, useCallback } from 'react';
import { FiPhoneOff, FiPhone, FiMic, FiMicOff, FiVideo, FiVideoOff } from 'react-icons/fi';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

// Free STUN servers (Google) — no time limit, no account needed
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export default function CallModal({ contact, callType, onEnd, incoming, incomingOffer, incomingRoomName }) {
  const { emit, on, off } = useSocket();
  const { authFetch, API, user } = useAuth();

  const [status, setStatus] = useState(incoming ? 'incoming' : 'calling');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const timerRef        = useRef(null);
  const callRecordIdRef = useRef(null);
  const pcRef           = useRef(null);   // RTCPeerConnection
  const localStreamRef  = useRef(null);   // Local MediaStream
  const localVideoRef   = useRef(null);   // <video> for local
  const remoteVideoRef  = useRef(null);   // <video> for remote

  const isVideo = callType === 'video';
  const isGroup = !!contact?.isGroup || !!contact?.members;

  // ── Start timer ─────────────────────────────────────────────────────────────
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  // ── Format mm:ss ─────────────────────────────────────────────────────────────
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Get local media ──────────────────────────────────────────────────────────
  const getMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.warn('[CallModal] Could not get media:', err.message);
      return null;
    }
  }, [isVideo]);

  // ── Create RTCPeerConnection ─────────────────────────────────────────────────
  const createPeerConnection = useCallback((stream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Add local tracks to connection
    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    // When we get remote tracks, display them
    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams?.[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    // Send ICE candidates to peer
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        emit('call:ice', { to: contact._id, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setStatus('connected');
        startTimer();
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCallLocally('completed');
      }
    };

    return pc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, emit]);

  // ── End call (cleanup) ───────────────────────────────────────────────────────
  const endCallLocally = useCallback((finalStatus = 'completed') => {
    clearInterval(timerRef.current);
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (callRecordIdRef.current) {
      authFetch(`${API}/api/calls/${callRecordIdRef.current}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: finalStatus, duration: callDuration })
      }).catch(() => {});
    }
    onEnd();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callDuration, authFetch, API, onEnd]);

  // ── Initiate outgoing call ───────────────────────────────────────────────────
  useEffect(() => {
    if (incoming) return;

    let cancelled = false;
    (async () => {
      const stream = await getMedia();
      if (cancelled) return;

      // For group calls we fall back to Jitsi (WebRTC 1-on-1 only for now)
      if (isGroup) {
        const roomName = incomingRoomName || `SilentTalk_${contact._id}`;
        emit('call:offer_group', { groupId: contact._id, callType, roomName });
        setStatus('connected');
        startTimer();
        return;
      }

      const pc = createPeerConnection(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      emit('call:offer', { to: contact._id, offer, callType });

      // Log call record
      authFetch(`${API}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: contact._id, callType })
      }).then(res => res.json()).then(data => { callRecordIdRef.current = data._id; }).catch(() => {});
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket event listeners ───────────────────────────────────────────────────
  useEffect(() => {
    // Callee answered — set remote description
    const handleAnswered = async ({ answer }) => {
      if (pcRef.current && answer) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setStatus('connected');
        startTimer();
      }
    };

    // ICE candidate from peer
    const handleIce = async ({ candidate }) => {
      if (pcRef.current && candidate) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    };

    const handleEnd      = () => endCallLocally('completed');
    const handleRejected = () => endCallLocally('rejected');

    on('call:answered', handleAnswered);
    on('call:ice',      handleIce);
    on('call:ended',    handleEnd);
    on('call:rejected', handleRejected);

    return () => {
      off('call:answered', handleAnswered);
      off('call:ice',      handleIce);
      off('call:ended',    handleEnd);
      off('call:rejected', handleRejected);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, off, endCallLocally]);

  // ── Accept incoming call ─────────────────────────────────────────────────────
  const acceptCall = async () => {
    setStatus('connecting');
    const stream = await getMedia();
    const pc = createPeerConnection(stream);

    if (incomingOffer) {
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emit('call:answer', { to: contact._id, answer });
    }
  };

  // ── End / Reject ─────────────────────────────────────────────────────────────
  const endCall = () => {
    if (!isGroup) emit('call:end', { to: contact._id });
    endCallLocally();
  };

  const rejectCall = () => {
    if (!isGroup) emit('call:reject', { to: contact._id });
    endCallLocally('rejected');
  };

  // ── Toggle mic / video ───────────────────────────────────────────────────────
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsVideoOff(v => !v);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Incoming ring screen
  // ─────────────────────────────────────────────────────────────────────────────
  if (status === 'incoming') {
    return (
      <div className="call-modal incoming-ring">
        <div className="audio-call-layout">
          <div className="call-avatar-ring incoming-pulse">
            {contact.avatar
              ? <img src={contact.avatar} alt="" style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover' }} />
              : <div className="avatar-fallback" style={{ width: 110, height: 110, fontSize: 40 }}>
                  {(contact.username || contact.name || contact.email || '?')[0].toUpperCase()}
                </div>
            }
          </div>
          <div className="call-name">{contact.username || contact.name || contact.email}</div>
          <div className="call-status-text">Incoming {callType} call{isGroup ? ' (Group)' : ''}</div>
        </div>
        <div className="call-controls">
          <div className="call-btn-wrap">
            <button className="call-btn" style={{ background: 'var(--green)', color: '#fff' }} onClick={acceptCall}>
              <FiPhone size={24} />
            </button>
            <span className="call-btn-label">Accept</span>
          </div>
          <div className="call-btn-wrap">
            <button className="call-btn call-btn-end" onClick={rejectCall}>
              <FiPhoneOff size={24} />
            </button>
            <span className="call-btn-label">Decline</span>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Active call screen — native WebRTC
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="call-modal" style={{ padding: 0, overflow: 'hidden', background: '#000' }}>

      {/* Remote video (full-screen) */}
      {isVideo && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
        />
      )}

      {/* Audio-only placeholder */}
      {!isVideo && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, color: '#fff', position: 'absolute', inset: 0, justifyContent: 'center', background: 'linear-gradient(160deg,#1a1d2e,#0d0f1a)' }}>
          {/* Hidden audio element for remote audio in audio-only call */}
          <video ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
          <div style={{ width: 90, height: 90, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.2)' }}>
            {contact.avatar
              ? <img src={contact.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700 }}>
                  {(contact.username || contact.name || '?')[0].toUpperCase()}
                </div>
            }
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{contact.username || contact.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            {status === 'calling' ? 'Calling…' : status === 'connecting' ? 'Connecting…' : fmt(callDuration)}
          </div>
        </div>
      )}

      {/* Local video (PiP) */}
      {isVideo && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{ position: 'absolute', bottom: 80, right: 16, width: 110, height: 150, borderRadius: 12, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.25)', zIndex: 10 }}
        />
      )}

      {/* Timer overlay for video */}
      {isVideo && status === 'connected' && (
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600, zIndex: 10 }}>
          {fmt(callDuration)}
        </div>
      )}

      {/* Controls bar */}
      <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 16, zIndex: 20 }}>
        {/* Mic */}
        <button
          onClick={toggleMic}
          style={{ width: 50, height: 50, borderRadius: '50%', border: 'none', cursor: 'pointer', background: isMuted ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}
        >
          {isMuted ? <FiMicOff size={20} /> : <FiMic size={20} />}
        </button>

        {/* Video toggle (video calls only) */}
        {isVideo && (
          <button
            onClick={toggleVideo}
            style={{ width: 50, height: 50, borderRadius: '50%', border: 'none', cursor: 'pointer', background: isVideoOff ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}
          >
            {isVideoOff ? <FiVideoOff size={20} /> : <FiVideo size={20} />}
          </button>
        )}

        {/* End call */}
        <button
          className="call-btn call-btn-end"
          style={{ width: 56, height: 56 }}
          onClick={endCall}
        >
          <FiPhoneOff size={22} />
        </button>
      </div>
    </div>
  );
}
