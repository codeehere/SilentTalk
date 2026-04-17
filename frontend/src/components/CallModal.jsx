import { useEffect, useRef, useState, useCallback } from 'react';
import { FiPhoneOff, FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhone } from 'react-icons/fi';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

export default function CallModal({ contact, callType, onEnd, incoming, incomingOffer }) {
  const { emit, on, off } = useSocket();
  const { authFetch, API } = useAuth();
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const [status, setStatus] = useState(incoming ? 'incoming' : 'calling');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);
  const callRecordIdRef = useRef(null);
  // Stable refs for callbacks used inside socket handlers
  const onEndRef = useRef(onEnd);
  const authFetchRef = useRef(authFetch);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { authFetchRef.current = authFetch; }, [authFetch]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
  }, []);

  const getMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch {
      alert(`Could not access ${callType === 'video' ? 'camera/microphone' : 'microphone'}. Please check permissions.`);
      onEndRef.current();
      return null;
    }
  }, [callType]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = e => {
      if (e.candidate) emit('call:ice', { to: contact._id, candidate: e.candidate });
    };

    pc.ontrack = e => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setStatus('connected');
        if (!timerRef.current) {
          timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
        }
      } else if (state === 'failed' || state === 'disconnected') {
        setStatus('failed');
        setTimeout(() => onEndRef.current(), 2000);
      }
    };

    return pc;
  }, [contact._id, emit]);

  const initCall = useCallback(async () => {
    setStatus('calling');
    const stream = await getMedia();
    if (!stream) return;

    const pc = createPeerConnection();
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Log call record
    try {
      const res = await authFetchRef.current(`${API}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: contact._id, callType })
      });
      if (res.ok) {
        const data = await res.json();
        callRecordIdRef.current = data._id;
      }
    } catch {}

    emit('call:offer', { to: contact._id, offer, callType });
  }, [callType, contact._id, createPeerConnection, emit, getMedia, API]);

  // Stable acceptCall using a ref so it can be called from socket handlers
  const acceptCallRef = useRef(null);
  const acceptCall = useCallback(async () => {
    setStatus('connecting');
    const stream = await getMedia();
    if (!stream) return;

    const pc = createPeerConnection();
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    emit('call:answer', { to: contact._id, answer });
  }, [contact._id, createPeerConnection, emit, getMedia, incomingOffer]);
  acceptCallRef.current = acceptCall;

  const updateCallRecord = useCallback((statusOverride, duration) => {
    if (!callRecordIdRef.current) return;
    const finalStatus = statusOverride || (duration > 0 ? 'completed' : 'missed');
    authFetchRef.current(`${API}/api/calls/${callRecordIdRef.current}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: finalStatus, duration })
    }).catch(() => {});
  }, [API]);

  useEffect(() => {
    if (!incoming) initCall();

    const handleAnswer = async ({ answer }) => {
      if (pcRef.current && pcRef.current.signalingState !== 'closed') {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setStatus('connected');
          if (!timerRef.current) {
            timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
          }
        } catch {}
      }
    };

    const handleIce = async ({ candidate }) => {
      try {
        if (pcRef.current && candidate && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch {}
    };

    const handleEnd = () => {
      setCallDuration(d => { updateCallRecord(null, d); return d; });
      cleanup();
      onEndRef.current();
    };

    const handleRejected = () => {
      setStatus('rejected');
      setCallDuration(d => { updateCallRecord('rejected', d); return d; });
      setTimeout(() => onEndRef.current(), 1800);
    };

    on('call:answered', handleAnswer);
    on('call:ice', handleIce);
    on('call:ended', handleEnd);
    on('call:rejected', handleRejected);

    return () => {
      off('call:answered', handleAnswer);
      off('call:ice', handleIce);
      off('call:ended', handleEnd);
      off('call:rejected', handleRejected);
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endCall = () => {
    emit('call:end', { to: contact._id });
    setCallDuration(d => { updateCallRecord(d > 0 ? 'completed' : 'missed', d); return d; });
    cleanup();
    onEndRef.current();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setMuted(m => !m);
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setCamOff(c => !c);
    }
  };

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="call-modal">
      {callType === 'video' ? (
        <div className="video-call-layout">
          {/* Remote full video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="video-remote-full"
          />
          {/* Local PiP */}
          <div className="video-local-pip">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="video-local-feed"
            />
          </div>
          {/* Overlay info */}
          <div className="call-overlay-info">
            <div className="call-name">{contact.username || contact.email}</div>
            <div className="call-status-text">{getStatusText(status, callDuration, formatDuration)}</div>
          </div>
        </div>
      ) : (
        /* Audio call layout */
        <div className="audio-call-layout">
          <div className="call-avatar-ring">
            {contact.avatar
              ? <img src={contact.avatar} alt="" style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover' }} />
              : <div className="avatar-fallback" style={{ width: 110, height: 110, fontSize: 40 }}>
                  {(contact.username || '?')[0].toUpperCase()}
                </div>
            }
          </div>
          <div className="call-name">{contact.username || contact.email}</div>
          <div className="call-status-text">{getStatusText(status, callDuration, formatDuration)}</div>
        </div>
      )}

      {/* Controls */}
      <div className="call-controls">
        {status === 'incoming' ? (
          <>
            <div className="call-btn-wrap">
              <button className="call-btn" style={{ background: 'var(--green)', color: '#fff' }} onClick={acceptCall}>
                <FiPhone size={24} />
              </button>
              <span className="call-btn-label">Accept</span>
            </div>
            <div className="call-btn-wrap">
              <button className="call-btn call-btn-end" onClick={() => { emit('call:reject', { to: contact._id }); onEndRef.current(); }}>
                <FiPhoneOff size={24} />
              </button>
              <span className="call-btn-label">Decline</span>
            </div>
          </>
        ) : (
          <>
            <div className="call-btn-wrap">
              <button className="call-btn call-btn-mute" onClick={toggleMute}>
                {muted ? <FiMicOff size={22} /> : <FiMic size={22} />}
              </button>
              <span className="call-btn-label">{muted ? 'Unmute' : 'Mute'}</span>
            </div>
            {callType === 'video' && (
              <div className="call-btn-wrap">
                <button className="call-btn call-btn-cam" onClick={toggleCam}>
                  {camOff ? <FiVideoOff size={22} /> : <FiVideo size={22} />}
                </button>
                <span className="call-btn-label">{camOff ? 'Show Cam' : 'Hide Cam'}</span>
              </div>
            )}
            <div className="call-btn-wrap">
              <button className="call-btn call-btn-end" onClick={endCall}>
                <FiPhoneOff size={24} />
              </button>
              <span className="call-btn-label">End</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function getStatusText(status, duration, fmt) {
  switch (status) {
    case 'calling':     return 'Calling…';
    case 'connecting':  return 'Connecting…';
    case 'connected':   return fmt(duration);
    case 'incoming':    return 'Incoming call';
    case 'rejected':    return 'Call rejected';
    case 'failed':      return 'Call failed';
    default:            return '';
  }
}
