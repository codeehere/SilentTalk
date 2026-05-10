import { useEffect, useRef, useState, useCallback } from 'react';
import { FiPhoneOff, FiPhone, FiMic, FiMicOff, FiVideo, FiVideoOff } from 'react-icons/fi';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

// Google STUN + free TURN via Open Relay (works through mobile carrier NAT)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Public TURN servers (Open Relay Project) — needed for symmetric NAT (mobile networks)
  { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

export default function CallModal({ contact, callType, onEnd, incoming, incomingOffer, incomingRoomName }) {
  const { emit, on, off } = useSocket();
  const { authFetch, API, user } = useAuth();

  const [status, setStatus]           = useState(incoming ? 'incoming' : 'calling');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted]         = useState(false);
  const [isVideoOff, setIsVideoOff]   = useState(false);

  const timerRef        = useRef(null);
  const callRecordIdRef = useRef(null);
  const pcRef           = useRef(null);
  const localStreamRef  = useRef(null);
  const localVideoRef   = useRef(null);
  const remoteVideoRef  = useRef(null);
  // Buffer ICE candidates received before setRemoteDescription is called
  const pendingIceRef   = useRef([]);
  // Stable ref to latest endCallLocally — avoids stale closure in socket listeners
  const endCallRef      = useRef(null);
  // Prevent double-end
  const endedRef        = useRef(false);

  const isVideo = callType === 'video';
  const isGroup = !!contact?.isGroup || !!contact?.members;

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  // ── Get local media ──────────────────────────────────────────────────────────
  const getMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
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
    pendingIceRef.current = [];

    if (stream) stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams?.[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) emit('call:ice', { to: contact._id, candidate: e.candidate });
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') {
        setStatus('connected');
        startTimer();
      }
      // 'disconnected' is transient — do NOT end the call, it may recover.
      // Only 'failed' is fatal, and even then give 4 s for ICE restart before ending.
      if (s === 'failed') {
        // Try ICE restart first
        try { pc.restartIce?.(); } catch {}
        setTimeout(() => {
          if (pcRef.current?.connectionState === 'failed') {
            endCallRef.current?.('completed');
          }
        }, 4000);
      }
    };

    return pc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, emit]);

  // ── Drain buffered ICE candidates ────────────────────────────────────────────
  const drainPendingIce = async (pc) => {
    for (const c of pendingIceRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingIceRef.current = [];
  };

  // ── End call cleanup ─────────────────────────────────────────────────────────
  const endCallLocally = useCallback((finalStatus = 'completed') => {
    if (endedRef.current) return;
    endedRef.current = true;

    clearInterval(timerRef.current);
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      localStreamRef.current = null;
    }
    if (callRecordIdRef.current) {
      // Use a snapshot of callDuration to avoid stale closure issue
      authFetch(`${API}/api/calls/${callRecordIdRef.current}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: finalStatus })
      }).catch(() => {});
    }
    onEnd();
  }, [authFetch, API, onEnd]);

  // Keep a stable ref so connection state handler (created once) can call latest version
  useEffect(() => { endCallRef.current = endCallLocally; }, [endCallLocally]);

  // ── Outgoing call setup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (incoming) return;
    let cancelled = false;

    (async () => {
      const stream = await getMedia();
      if (cancelled) return;

      if (isGroup) {
        const roomName = incomingRoomName || `SilentTalk_${contact._id}`;
        emit('call:offer_group', { groupId: contact._id, callType, roomName });
        setStatus('connected');
        startTimer();
        return;
      }

      const pc = createPeerConnection(stream);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit('call:offer', { to: contact._id, offer, callType });
      } catch (err) {
        console.error('[CallModal] Offer error:', err);
      }

      authFetch(`${API}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: contact._id, callType })
      }).then(r => r.json()).then(d => { callRecordIdRef.current = d._id; }).catch(() => {});
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket event listeners (registered once — use refs for callbacks) ────────
  useEffect(() => {
    const handleAnswered = async ({ answer }) => {
      if (!pcRef.current || !answer) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await drainPendingIce(pcRef.current);
        setStatus('connected');
        startTimer();
      } catch (err) { console.warn('[CallModal] setRemoteDescription (answer) failed:', err); }
    };

    const handleIce = async ({ candidate }) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        // Buffer — remote description not set yet
        pendingIceRef.current.push(candidate);
      }
    };

    // Use ref so these handlers always call the latest endCallLocally
    const handleEnd      = () => endCallRef.current?.('completed');
    const handleRejected = () => endCallRef.current?.('rejected');

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
  // Empty deps — register once only. endCallLocally accessed via endCallRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, off]);

  // ── Accept incoming call ─────────────────────────────────────────────────────
  const acceptCall = async () => {
    setStatus('connecting');
    const stream = await getMedia();
    const pc = createPeerConnection(stream);

    if (incomingOffer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        await drainPendingIce(pc);   // flush any early ICE candidates
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emit('call:answer', { to: contact._id, answer });
      } catch (err) {
        console.error('[CallModal] acceptCall error:', err);
        // Don't end the call — keep the screen, user can manually hang up
      }
    }
  };

  const endCall = () => {
    if (!isGroup) emit('call:end', { to: contact._id });
    endCallLocally();
  };

  const rejectCall = () => {
    if (!isGroup) emit('call:reject', { to: contact._id });
    endCallLocally('rejected');
  };

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

  // ── Incoming ring screen ─────────────────────────────────────────────────────
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

  // ── Active call screen (both caller and receiver after accept) ───────────────
  const statusLabel =
    status === 'calling'    ? 'Calling…'      :
    status === 'connecting' ? 'Connecting…'   :
    status === 'connected'  ? fmt(callDuration) : '…';

  return (
    <div className="call-modal" style={{ padding: 0, overflow: 'hidden', background: '#000' }}>

      {/* Remote video */}
      {isVideo && (
        <video ref={remoteVideoRef} autoPlay playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
      )}

      {/* Audio-only / calling state centre card */}
      {(!isVideo || status !== 'connected') && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          color: '#fff', position: 'absolute', inset: 0, justifyContent: 'center',
          background: isVideo ? 'rgba(0,0,0,0.55)' : 'linear-gradient(160deg,#1a1d2e,#0d0f1a)',
          zIndex: 5
        }}>
          {/* Hidden audio element for remote audio in audio-only call */}
          {!isVideo && <video ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />}
          <div style={{ width: 90, height: 90, borderRadius: '50%', overflow: 'hidden',
            border: '3px solid rgba(255,255,255,0.2)',
            boxShadow: status === 'connected' ? '0 0 0 12px rgba(99,102,241,0.15)' : 'none',
            transition: 'box-shadow 0.6s ease'
          }}>
            {contact.avatar
              ? <img src={contact.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: 'var(--accent)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700 }}>
                  {(contact.username || contact.name || '?')[0].toUpperCase()}
                </div>
            }
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{contact.username || contact.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', minHeight: 20 }}>{statusLabel}</div>
        </div>
      )}

      {/* Local video PiP */}
      {isVideo && (
        <video ref={localVideoRef} autoPlay playsInline muted
          style={{ position: 'absolute', bottom: 88, right: 16, width: 110, height: 150,
            borderRadius: 12, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.25)', zIndex: 10 }} />
      )}

      {/* Timer for video */}
      {isVideo && status === 'connected' && (
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 20, padding: '4px 14px',
          fontSize: 13, fontWeight: 600, zIndex: 15 }}>
          {fmt(callDuration)}
        </div>
      )}

      {/* Controls bar — always visible */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20,
        padding: '20px 0 28px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
        zIndex: 20
      }}>
        <button onClick={toggleMic} title={isMuted ? 'Unmute' : 'Mute'} style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: isMuted ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.18)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)', transition: 'background 0.2s'
        }}>
          {isMuted ? <FiMicOff size={20} /> : <FiMic size={20} />}
        </button>

        {isVideo && (
          <button onClick={toggleVideo} title={isVideoOff ? 'Enable camera' : 'Disable camera'} style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: isVideoOff ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.18)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)', transition: 'background 0.2s'
          }}>
            {isVideoOff ? <FiVideoOff size={20} /> : <FiVideo size={20} />}
          </button>
        )}

        {/* End call — always big and red, easy to tap on mobile */}
        <button onClick={endCall} title="End call" style={{
          width: 60, height: 60, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: '#ef4444', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
          transition: 'transform 0.15s'
        }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
           onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
          <FiPhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}
