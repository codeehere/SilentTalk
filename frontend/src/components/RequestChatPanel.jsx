import { useState, useEffect } from 'react';
import { FiShare2, FiClock, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

export default function RequestChatPanel() {
  const { authFetch, API, user } = useAuth();
  const { on, off, emit } = useSocket();
  const [requests, setRequests] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [duration, setDuration] = useState(30);
  const [message, setMessage] = useState('');
  const [targetSearch, setTargetSearch] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [shadowMessages, setShadowMessages] = useState(null);
  const [activeShadow, setActiveShadow] = useState(null);

  const fetchShadowMessages = async (id) => {
    const res = await authFetch(`${API}/api/request-chat/${id}/messages`);
    if (res.ok) {
      setShadowMessages(await res.json());
      setActiveShadow(id);
    } else {
      const err = await res.json();
      alert(err.message || 'Failed to fetch shadow messages');
    }
  };

  useEffect(() => {
    fetchRequests();
    const handleIncoming = ({ requestId }) => { fetchRequests(); };
    on('request-chat:incoming', handleIncoming);
    on('request-chat:granted', handleIncoming);
    return () => { off('request-chat:incoming', handleIncoming); off('request-chat:granted', handleIncoming); };
  }, []);

  const fetchRequests = async () => {
    const res = await authFetch(`${API}/api/request-chat`);
    if (res.ok) setRequests(await res.json());
  };

  const searchUsers = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setTargetSearch([]); return; }
    const res = await authFetch(`${API}/api/users/search?q=${encodeURIComponent(q)}`);
    if (res.ok) setTargetSearch(await res.json());
  };

  const sendRequest = async () => {
    if (!targetId) return;
    const res = await authFetch(`${API}/api/request-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, accessDuration: duration, message })
    });
    if (res.ok) {
      const data = await res.json();
      emit('request-chat:new', { targetId, requestId: data._id });
      fetchRequests(); setShowCreate(false); setTargetId(''); setMessage(''); setSearchQ(''); setTargetSearch([]);
    }
  };

  const accept = async (id) => {
    const res = await authFetch(`${API}/api/request-chat/${id}/accept`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      emit('request-chat:accepted', { requesterId: requests.find(r => r._id === id)?.requesterId?._id, requestId: id, shadowToken: data.shadowToken, expiresAt: data.expiresAt });
      fetchRequests();
    }
  };

  const deny = async (id) => {
    await authFetch(`${API}/api/request-chat/${id}/deny`, { method: 'POST' });
    fetchRequests();
  };

  const revoke = async (id) => {
    await authFetch(`${API}/api/request-chat/${id}/revoke`, { method: 'POST' });
    emit('request-chat:revoked', { targetId: requests.find(r => r._id === id)?.targetId?._id, requestId: id });
    fetchRequests();
  };

  const isMine = (r) => r.requesterId?._id === user._id || r.requesterId === user._id;

  return (
    <div className="section-pane">
      <div className="panel-header">
        <span className="panel-title">Request Chat</span>
        <button className="icon-btn" onClick={() => setShowCreate(true)} title="Send request"><FiShare2 size={18} /></button>
      </div>

      <div style={{ padding: '8px 16px 12px', fontSize: 13, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <FiAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent)' }} />
        Grant another user temporary, time-limited access to view your conversations. You can revoke access at any time.
      </div>

      <div className="panel-scroll" style={{ padding: '12px 16px' }}>
        {requests.length === 0 && (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}><FiShare2 size={30} /></div>
            <h3>No requests</h3>
            <p>Send a chat access request to another user</p>
          </div>
        )}
        {requests.map(r => (
          <div key={r._id} className="request-card">
            <div className="request-card-header">
              <div className="avatar-fallback" style={{ width: 36, height: 36 }}>
                {isMine(r) ? (r.targetId?.username || '?')[0] : (r.requesterId?.username || '?')[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {isMine(r) ? `To: ${r.targetId?.username || r.targetId?.uniqueId}` : `From: ${r.requesterId?.username || r.requesterId?.uniqueId}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span className={`status-badge status-${r.status === 'accepted' ? 'accepted' : r.status === 'denied' || r.status === 'revoked' ? 'denied' : 'pending'}`}>
                {r.status}
              </span>
            </div>
            {r.message && <div className="request-msg">"{r.message}"</div>}
            <div className="request-duration">
              <FiClock size={12} /> {r.accessDuration} min access
            </div>
            {r.expiresAt && r.status === 'accepted' && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Expires: {new Date(r.expiresAt).toLocaleString()}
              </div>
            )}
            <div className="request-actions">
              {!isMine(r) && r.status === 'pending' && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => accept(r._id)}><FiCheck size={13} /> Accept</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deny(r._id)}><FiX size={13} /> Deny</button>
                </>
              )}
              {isMine(r) && r.status === 'accepted' && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => fetchShadowMessages(r._id)}>Access Chats</button>
                  <button className="btn btn-danger btn-sm" onClick={() => revoke(r._id)}>Revoke</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeShadow && (
        <div className="modal-backdrop" onClick={() => { setActiveShadow(null); setShadowMessages(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Shadow Session</span>
              <button className="icon-btn" onClick={() => { setActiveShadow(null); setShadowMessages(null); }}><FiX size={20} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)', borderRadius: 12, padding: 16 }}>
              {shadowMessages?.length === 0 ? (
                 <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>No messages found.</div>
              ) : (
                shadowMessages?.map(msg => (
                  <div key={msg._id} style={{ marginBottom: 12, display: 'flex', gap: 10 }}>
                    <img src={msg.senderId?.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{msg.senderId?.username}</div>
                      <div style={{ background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 12, fontSize: 14 }}>
                        {msg.ciphertext ? <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>[Encrypted message]</span> : msg.text}
                        {msg.mediaUrl && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--accent)' }}>[Media Attached]</div>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Request Chat Access</div>
            <div className="form-group">
              <label className="form-label">Search user</label>
              <input className="input" placeholder="Search by username or ID…" value={searchQ} onChange={e => searchUsers(e.target.value)} autoFocus />
              {targetSearch.length > 0 && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
                  {targetSearch.map(u => (
                    <div key={u._id} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.15s' }}
                      onClick={() => { setTargetId(u._id); setSearchQ(`${u.username || u.uniqueId}`); setTargetSearch([]); }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <div className="avatar-fallback" style={{ width: 32, height: 32 }}>{(u.username || '?')[0]}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.username}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{u.uniqueId}</div>
                      </div>
                      {targetId === u._id && <FiCheck size={16} color="var(--accent)" style={{ marginLeft: 'auto' }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Access Duration: <strong style={{ color: 'var(--accent)' }}>{duration} minutes</strong></label>
              <input type="range" min={1} max={1440} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>1 min</span><span>24 hours</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Message (optional)</label>
              <textarea className="input" rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Why are you requesting access?" style={{ resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={sendRequest} disabled={!targetId}>Send Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
