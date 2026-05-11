import { useEffect, useRef, useState, useCallback } from 'react';
import { FiPhoneOff, FiPhone, FiMic, FiMicOff, FiVideo, FiVideoOff, FiVolume2, FiVolumeX, FiCircle, FiUserPlus } from 'react-icons/fi';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80',               username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443',              username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp',username: 'openrelayproject', credential: 'openrelayproject' },
];

// Phones have earpiece + loudspeaker; laptops have one output — speaker toggle is mobile only
const isMobileDevice = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export default function CallModal({ contact, callType, onEnd, incoming, incomingOffer }) {
  const { emit, on, off } = useSocket();
  const { authFetch, API } = useAuth();

  const [status, setStatus]             = useState(incoming ? 'incoming' : 'calling');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted]           = useState(false);
  const [isVideoOff, setIsVideoOff]     = useState(false);
  const [isSpeaker, setIsSpeaker]       = useState(false);
  const [remoteStreams, setRemoteStreams]= useState({}); // { userId: MediaStream }
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [contactsList, setContactsList] = useState([]);

  const timerRef        = useRef(null);
  const callRecordIdRef = useRef(null);
  const pcsRef          = useRef(new Map());   // Map<userId, RTCPeerConnection>
  const pendingIceRef   = useRef(new Map());   // Map<userId, RTCIceCandidate[]>
  const localStreamRef  = useRef(null);
  const localVideoRef   = useRef(null);
  const endCallRef      = useRef(null);
  const endedRef        = useRef(false);

  const isVideo = callType === 'video';
  const isGroup = !!contact?.isGroup || !!contact?.members;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  }, []);

  const showToast = (msg) => {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:40px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;padding:10px 20px;border-radius:24px;z-index:999999;font-size:14px;font-weight:600;box-shadow:0 10px 30px rgba(124,106,247,.4);';
    t.innerText = `✨ ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => { if (document.body.contains(t)) document.body.removeChild(t); }, 2500);
  };

  // ── Get local media ───────────────────────────────────────────────────────────
  const getMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.warn('[CallModal] Media error:', err.message);
      return null;
    }
  }, [isVideo]);

  // ── Create RTCPeerConnection for a specific remote userId ─────────────────────
  const createPeerConnection = useCallback((targetUserId, stream) => {
    const key = targetUserId.toString();
    // Reuse existing PC if already created
    if (pcsRef.current.has(key)) return pcsRef.current.get(key);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcsRef.current.set(key, pc);
    pendingIceRef.current.set(key, []);

    if (stream) stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (e) => {
      if (e.streams?.[0]) setRemoteStreams(prev => ({ ...prev, [key]: e.streams[0] }));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) emit('call:ice', { to: targetUserId, candidate: e.candidate });
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') { setStatus('connected'); startTimer(); }
      if (s === 'disconnected') {
        setRemoteStreams(prev => { const n = { ...prev }; delete n[key]; return n; });
      }
      if (s === 'failed') {
        try { pc.restartIce?.(); } catch {}
        setTimeout(() => {
          if (pc.connectionState === 'failed') {
            pcsRef.current.delete(key);
            setRemoteStreams(prev => { const n = { ...prev }; delete n[key]; return n; });
            if (pcsRef.current.size === 0) endCallRef.current?.('completed');
          }
        }, 4000);
      }
    };
    return pc;
  }, [emit, startTimer]);

  // ── Drain buffered ICE candidates for a peer ──────────────────────────────────
  const drainPendingIce = useCallback(async (key) => {
    const pc = pcsRef.current.get(key.toString());
    const candidates = pendingIceRef.current.get(key.toString()) || [];
    for (const c of candidates) {
      try { await pc?.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingIceRef.current.set(key.toString(), []);
  }, []);

  // ── End call ─────────────────────────────────────────────────────────────────
  const endCallLocally = useCallback((finalStatus = 'completed') => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearInterval(timerRef.current);
    pcsRef.current.forEach(pc => { try { pc.close(); } catch {} });
    pcsRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      localStreamRef.current = null;
    }
    if (callRecordIdRef.current) {
      authFetch(`${API}/api/calls/${callRecordIdRef.current}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: finalStatus })
      }).catch(() => {});
    }
    onEnd();
  }, [authFetch, API, onEnd]);

  useEffect(() => { endCallRef.current = endCallLocally; }, [endCallLocally]);

  // ── Outgoing call setup ───────────────────────────────────────────────────────
  useEffect(() => {
    if (incoming) return;
    let cancelled = false;
    (async () => {
      const stream = await getMedia();
      if (cancelled) return;
      if (isGroup) {
        emit('call:offer_group', { groupId: contact._id, callType });
        setStatus('connected'); startTimer(); return;
      }
      const pc = createPeerConnection(contact._id, stream);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit('call:offer', { to: contact._id, offer, callType });
      } catch (err) { console.error('[CallModal] Offer error:', err); }

      authFetch(`${API}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: contact._id, callType })
      }).then(r => r.json()).then(d => { callRecordIdRef.current = d._id; }).catch(() => {});
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket event listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const handleAnswered = async ({ answer, from }) => {
      const key = (from || contact._id).toString();
      const pc = pcsRef.current.get(key);
      if (!pc || !answer) return;
      setStatus('connecting');
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await drainPendingIce(key);
        // 'connected' fires via onconnectionstatechange — same time on both sides
      } catch (err) { console.warn('[CallModal] setRemoteDescription failed:', err); }
    };

    const handleIce = async ({ candidate, from }) => {
      if (!candidate) return;
      const key = (from || contact._id).toString();
      const pc  = pcsRef.current.get(key);
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        const arr = pendingIceRef.current.get(key) || [];
        arr.push(candidate);
        pendingIceRef.current.set(key, arr);
      }
    };

    // A peer is asking us to connect directly to a new participant (mesh)
    const handleConnectPeer = async ({ inviteUserId, callType: ct }) => {
      const stream = localStreamRef.current;
      if (!stream) return;
      const pc = createPeerConnection(inviteUserId, stream);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit('call:offer', { to: inviteUserId, offer, callType: ct });
      } catch (err) { console.error('[CallModal] mesh offer error:', err); }
    };

    const handleEnd      = () => endCallRef.current?.('completed');
    const handleRejected = () => endCallRef.current?.('rejected');

    on('call:answered',     handleAnswered);
    on('call:ice',          handleIce);
    on('call:ended',        handleEnd);
    on('call:rejected',     handleRejected);
    on('call:connect_peer', handleConnectPeer);
    return () => {
      off('call:answered',     handleAnswered);
      off('call:ice',          handleIce);
      off('call:ended',        handleEnd);
      off('call:rejected',     handleRejected);
      off('call:connect_peer', handleConnectPeer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, off, createPeerConnection, drainPendingIce, emit]);

  // ── Accept incoming call ──────────────────────────────────────────────────────
  const acceptCall = async () => {
    setStatus('connecting');
    const stream = await getMedia();
    const pc = createPeerConnection(contact._id, stream);
    if (incomingOffer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        await drainPendingIce(contact._id);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emit('call:answer', { to: contact._id, answer });
      } catch (err) { console.error('[CallModal] acceptCall error:', err); }
    }
  };

  const endCall = () => {
    // Notify every connected peer individually
    const targets = pcsRef.current.size > 0
      ? [...pcsRef.current.keys()]
      : [contact._id.toString()];
    targets.forEach(peerId => emit('call:end', { to: peerId }));
    endCallLocally();
  };

  const rejectCall = () => {
    emit('call:reject', { to: contact._id });
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

  const toggleSpeaker = async () => {
    const next = !isSpeaker;
    setIsSpeaker(next);
    if (!('setSinkId' in HTMLMediaElement.prototype)) {
      showToast('Use your device volume/speaker button'); return;
    }
    const els = document.querySelectorAll('.call-remote-video');
    try {
      if (next) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const out = devices.filter(d => d.kind === 'audiooutput');
        const spk = out.find(d => /speaker|loud/i.test(d.label))
          || out.find(d => d.deviceId === 'default') || out[0];
        if (spk) els.forEach(el => el.setSinkId?.(spk.deviceId));
      } else {
        els.forEach(el => el.setSinkId?.(''));
      }
    } catch (err) { console.warn('[CallModal] setSinkId failed:', err.message); }
  };

  const handleAddParticipantClick = async () => {
    try {
      const res = await authFetch(`${API}/api/users/contacts`);
      if (res.ok) { const d = await res.json(); setContactsList(d.contacts || []); setShowAddParticipant(true); }
    } catch {}
  };

  // ── Add participant: pure WebRTC mesh, no Jitsi ───────────────────────────────
  const handleInviteParticipant = async (newContact) => {
    setShowAddParticipant(false);
    const stream = localStreamRef.current;
    if (!stream) { showToast('No local stream'); return; }

    // 1. Connect ourselves to the new participant
    const pc = createPeerConnection(newContact._id, stream);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      emit('call:offer', { to: newContact._id, offer, callType });
    } catch (err) { console.error('[CallModal] invite offer error:', err); return; }

    // 2. Tell every existing peer to also connect directly to the new participant (full mesh)
    pcsRef.current.forEach((_, existingKey) => {
      if (existingKey === newContact._id.toString()) return;
      emit('call:invite_to_group', { to: existingKey, inviteUserId: newContact._id, callType });
    });

    showToast(`Connecting ${newContact.username || 'participant'}…`);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const statusLabel =
    status === 'calling'    ? 'Calling…'    :
    status === 'connecting' ? 'Connecting…' :
    status === 'connected'  ? fmt(callDuration) : '…';

  const remotePeers = Object.entries(remoteStreams); // [[userId, MediaStream], …]

  const AddParticipantOverlay = () => (
    <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.8)', zIndex:200,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--bg-elevated)', padding:20, borderRadius:16,
        width:'90%', maxWidth:360, maxHeight:'80%', overflowY:'auto', border:'1px solid var(--border)' }}>
        <h3 style={{ marginTop:0, marginBottom:16, color:'var(--text-primary)' }}>Add to Call</h3>
        {contactsList.map(c => (
          <div key={c._id} onClick={() => handleInviteParticipant(c)}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0',
              borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
            <img src={c.avatar || `https://ui-avatars.com/api/?name=${c.username||c.email}`}
              style={{ width:40, height:40, borderRadius:'50%' }} alt="" />
            <div style={{ color:'var(--text-primary)', fontWeight:600 }}>{c.username || c.email}</div>
          </div>
        ))}
        <button onClick={() => setShowAddParticipant(false)}
          style={{ marginTop:16, width:'100%', padding:12, borderRadius:8,
            background:'var(--border)', border:'none', color:'var(--text-primary)', cursor:'pointer', fontWeight:600 }}>
          Cancel
        </button>
      </div>
    </div>
  );

  const ControlBar = ({ compact = false }) => (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0,
      display:'flex', justifyContent:'center', alignItems:'center',
      gap: compact ? 10 : 14, flexWrap:'wrap',
      padding: compact ? '12px 10px 20px' : '20px 10px 28px',
      background:'linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 100%)',
      zIndex:20
    }}>
      <button onClick={handleAddParticipantClick} title="Add someone" style={{
        width:50, height:50, borderRadius:'50%', border:'none', cursor:'pointer',
        background:'rgba(255,255,255,.18)', color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        backdropFilter:'blur(8px)', transition:'background .2s'
      }}><FiUserPlus size={20} /></button>

      {isMobileDevice && (
        <button onClick={toggleSpeaker} title={isSpeaker ? 'Speaker: Loud' : 'Speaker: Earpiece'} style={{
          width:50, height:50, borderRadius:'50%', border:'none', cursor:'pointer',
          background: isSpeaker ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.18)',
          color: isSpeaker ? '#000' : '#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          backdropFilter:'blur(8px)', transition:'background .2s'
        }}>{isSpeaker ? <FiVolume2 size={20}/> : <FiVolumeX size={20}/>}</button>
      )}

      <button onClick={toggleMic} title={isMuted ? 'Unmute' : 'Mute'} style={{
        width:50, height:50, borderRadius:'50%', border:'none', cursor:'pointer',
        background: isMuted ? 'rgba(239,68,68,.9)' : 'rgba(255,255,255,.18)',
        color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
        backdropFilter:'blur(8px)', transition:'background .2s'
      }}>{isMuted ? <FiMicOff size={20}/> : <FiMic size={20}/>}</button>

      {isVideo && (
        <button onClick={toggleVideo} title={isVideoOff ? 'Enable camera' : 'Disable camera'} style={{
          width:50, height:50, borderRadius:'50%', border:'none', cursor:'pointer',
          background: isVideoOff ? 'rgba(239,68,68,.9)' : 'rgba(255,255,255,.18)',
          color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
          backdropFilter:'blur(8px)', transition:'background .2s'
        }}>{isVideoOff ? <FiVideoOff size={20}/> : <FiVideo size={20}/>}</button>
      )}

      <button onClick={() => showToast('Call Recording — Coming Soon!')} title="Record" style={{
        width:50, height:50, borderRadius:'50%', border:'none', cursor:'pointer',
        background:'rgba(255,255,255,.18)', color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        backdropFilter:'blur(8px)'
      }}><FiCircle size={20}/></button>

      <button onClick={endCall} title="End call" style={{
        width:60, height:60, borderRadius:'50%', border:'none', cursor:'pointer',
        background:'#ef4444', color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 4px 20px rgba(239,68,68,.5)', transition:'transform .15s'
      }} onMouseDown={e => e.currentTarget.style.transform='scale(0.94)'}
         onMouseUp={e   => e.currentTarget.style.transform='scale(1)'}>
        <FiPhoneOff size={24}/>
      </button>
    </div>
  );

  // ── Incoming ring ─────────────────────────────────────────────────────────────
  if (status === 'incoming') {
    return (
      <div className="call-modal incoming-ring">
        <div className="audio-call-layout">
          <div className="call-avatar-ring incoming-pulse">
            {contact.avatar
              ? <img src={contact.avatar} alt="" style={{ width:110, height:110, borderRadius:'50%', objectFit:'cover' }}/>
              : <div className="avatar-fallback" style={{ width:110, height:110, fontSize:40 }}>
                  {(contact.username||contact.name||contact.email||'?')[0].toUpperCase()}
                </div>
            }
          </div>
          <div className="call-name">{contact.username||contact.name||contact.email}</div>
          <div className="call-status-text">Incoming {callType} call{isGroup?' (Group)':''}</div>
        </div>
        <div className="call-controls">
          <div className="call-btn-wrap">
            <button className="call-btn" style={{ background:'var(--green)', color:'#fff' }} onClick={acceptCall}>
              <FiPhone size={24}/>
            </button>
            <span className="call-btn-label">Accept</span>
          </div>
          <div className="call-btn-wrap">
            <button className="call-btn call-btn-end" onClick={rejectCall}>
              <FiPhoneOff size={24}/>
            </button>
            <span className="call-btn-label">Decline</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Active call — multi-party video grid ──────────────────────────────────────
  const isMultiParty = remotePeers.length > 1;

  return (
    <div className="call-modal" style={{ padding:0, overflow:'hidden', background:'#000' }}>

      {/* ── Multi-party video grid ── */}
      {isVideo && isMultiParty && (
        <div style={{
          display:'grid', width:'100%', height:'100%',
          gridTemplateColumns: remotePeers.length <= 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap:2, position:'absolute', inset:0
        }}>
          {remotePeers.map(([uid, stream]) => (
            <RemoteVideoTile key={uid} stream={stream}/>
          ))}
        </div>
      )}

      {/* ── Single remote video (1-on-1) ── */}
      {isVideo && !isMultiParty && remotePeers.length === 1 && (
        <video className="call-remote-video" autoPlay playsInline
          ref={el => { if (el && remotePeers[0]?.[1]) el.srcObject = remotePeers[0][1]; }}
          style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }}/>
      )}

      {/* Hidden audio for audio-only calls */}
      {!isVideo && remotePeers.map(([uid, stream]) => (
        <video key={uid} className="call-remote-video" autoPlay playsInline
          ref={el => { if (el) el.srcObject = stream; }}
          style={{ display:'none' }}/>
      ))}

      {/* Calling / audio-only / pre-connected overlay */}
      {(!isVideo || status !== 'connected') && (
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center', gap:16,
          color:'#fff', position:'absolute', inset:0, justifyContent:'center',
          background: isVideo ? 'rgba(0,0,0,.55)' : 'linear-gradient(160deg,#1a1d2e,#0d0f1a)',
          zIndex:5
        }}>
          <div style={{ width:90, height:90, borderRadius:'50%', overflow:'hidden',
            border:'3px solid rgba(255,255,255,.2)',
            boxShadow: status==='connected' ? '0 0 0 12px rgba(99,102,241,.15)' : 'none',
            transition:'box-shadow .6s'
          }}>
            {contact.avatar
              ? <img src={contact.avatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <div style={{ width:'100%', height:'100%', background:'var(--accent)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, fontWeight:700 }}>
                  {(contact.username||contact.name||'?')[0].toUpperCase()}
                </div>
            }
          </div>
          <div style={{ fontSize:18, fontWeight:700 }}>{contact.username||contact.name}</div>
          {isMultiParty && status==='connected' && (
            <div style={{ fontSize:12, color:'rgba(255,255,255,.5)' }}>
              {remotePeers.length + 1} people in call
            </div>
          )}
          <div style={{ fontSize:13, color:'rgba(255,255,255,.6)', minHeight:20 }}>{statusLabel}</div>
        </div>
      )}

      {/* Local video PiP */}
      {isVideo && (
        <video ref={localVideoRef} autoPlay playsInline muted
          style={{ position:'absolute', bottom:88, right:16, width:110, height:150,
            borderRadius:12, objectFit:'cover', border:'2px solid rgba(255,255,255,.25)', zIndex:10 }}/>
      )}

      {/* Timer */}
      {isVideo && status==='connected' && (
        <div style={{ position:'absolute', top:16, left:'50%', transform:'translateX(-50%)',
          background:'rgba(0,0,0,.55)', color:'#fff', borderRadius:20, padding:'4px 14px',
          fontSize:13, fontWeight:600, zIndex:15 }}>
          {fmt(callDuration)}
        </div>
      )}

      <ControlBar compact={isMultiParty}/>
      {showAddParticipant && <AddParticipantOverlay/>}
    </div>
  );
}

// Small component to attach stream ref to video element
function RemoteVideoTile({ stream }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return (
    <video ref={ref} className="call-remote-video" autoPlay playsInline
      style={{ width:'100%', height:'100%', objectFit:'cover', background:'#111' }}/>
  );
}
