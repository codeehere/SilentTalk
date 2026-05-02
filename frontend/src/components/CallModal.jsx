import { useEffect, useRef, useState } from 'react';
import { FiPhoneOff, FiPhone } from 'react-icons/fi';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

export default function CallModal({ contact, callType, onEnd, incoming, incomingOffer, incomingRoomName }) {
  const { emit, on, off } = useSocket();
  const { authFetch, API, user } = useAuth();
  
  const [status, setStatus] = useState(incoming ? 'incoming' : 'connected');
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);
  const callRecordIdRef = useRef(null);

  // Generate a predictable room name for groups, or a unique one for 1-on-1
  const isGroup = !!contact?.isGroup || !!contact?.members;
  const [roomName] = useState(incomingRoomName || `SilentTalk_${isGroup ? contact._id : Math.random().toString(36).substring(2, 12)}`);

  useEffect(() => {
    if (!incoming) {
      // Ring the other party / group
      if (isGroup) {
        emit('call:offer_group', { groupId: contact._id, callType, roomName });
      } else {
        emit('call:offer', { to: contact._id, offer: {}, callType, roomName });
      }
      
      // Start duration timer
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      
      // Log call record
      authFetch(`${API}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: contact._id, callType })
      }).then(res => res.json()).then(data => { callRecordIdRef.current = data._id; }).catch(()=>{});
    }

    const handleEnd = () => endCallLocally('completed');
    const handleRejected = () => endCallLocally('rejected');

    on('call:ended', handleEnd);
    on('call:rejected', handleRejected);

    return () => {
      off('call:ended', handleEnd);
      off('call:rejected', handleRejected);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptCall = () => {
    setStatus('connected');
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  const endCallLocally = (finalStatus = 'completed') => {
    if (callRecordIdRef.current) {
      authFetch(`${API}/api/calls/${callRecordIdRef.current}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: finalStatus, duration: callDuration })
      }).catch(()=>{});
    }
    onEnd();
  };

  const endCall = () => {
    if (!isGroup) {
       emit('call:end', { to: contact._id });
    }
    endCallLocally();
  };

  const rejectCall = () => {
    if (!isGroup) emit('call:reject', { to: contact._id });
    endCallLocally('rejected');
  };

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

  const jitsiDomain = "meet.jit.si";
  const displayName = encodeURIComponent(user?.username || user?.email?.split('@')[0] || 'Guest');
  const jitsiUrl = `https://${jitsiDomain}/${roomName}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false&config.disableDeepLinking=true`;

  return (
    <div className="call-modal" style={{ padding: 0, overflow: 'hidden', background: '#000', borderRadius: '16px' }}>
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 999 }}>
        <button className="call-btn call-btn-end" style={{ width: 44, height: 44 }} onClick={endCall}>
          <FiPhoneOff size={20} />
        </button>
      </div>

      <iframe 
        allow="camera; microphone; display-capture; autoplay; clipboard-write" 
        src={jitsiUrl} 
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '16px' }}
      />
    </div>
  );
}
