import { useState, useEffect } from 'react';
import { FiPhone, FiVideo, FiPhoneMissed, FiPhoneIncoming, FiPhoneOutgoing } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

export default function Calls() {
  const { authFetch, API, user } = useAuth();
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    const fetchCalls = async () => {
      const res = await authFetch(`${API}/api/calls`);
      if (res.ok) setCalls(await res.json());
    };
    fetchCalls();
  }, [API, authFetch]);

  return (
    <div className="section-pane">
      <div className="panel-header">
        <span className="panel-title">Call History</span>
      </div>
      <div className="panel-scroll" style={{ padding: '8px 16px' }}>
        {calls.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon"><FiPhone size={28} /></div>
            <h3>No recent calls</h3>
          </div>
        ) : calls.map(c => {
          const isIncoming = c.receiver?._id === user._id;
          const otherPerson = isIncoming ? c.caller : c.receiver;
          
          let Icon = isIncoming ? FiPhoneIncoming : FiPhoneOutgoing;
          let color = isIncoming ? 'var(--green)' : 'var(--text-muted)';
          
          if (c.status === 'missed' || c.status === 'rejected') {
            Icon = FiPhoneMissed;
            color = 'var(--red)';
          }

          return (
            <div key={c._id} className="contact-item" style={{ padding: '12px 10px', background: 'var(--bg-elevated)', borderRadius: 12, marginBottom: 8, border: '1px solid var(--border)' }}>
              <img src={otherPerson?.avatar || ''} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', background: 'var(--bg-surface)' }} />
              <div className="contact-info">
                <div className="contact-name">{otherPerson?.username || 'Unknown'}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon size={12} color={color} />
                  {c.duration ? `${Math.floor(c.duration/60)}:${(c.duration%60).toString().padStart(2,'0')}` : 'Missed'}
                  <span>•</span>
                  {new Date(c.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div>
                {c.callType === 'video' ? <FiVideo size={18} color="var(--accent)" /> : <FiPhone size={18} color="var(--accent)" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
