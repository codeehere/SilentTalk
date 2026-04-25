import { useState, useEffect } from 'react';
import { FiX, FiSlash, FiUserMinus, FiCheck, FiShoppingBag, FiStar, FiInfo, FiMessageCircle, FiMail, FiPhone, FiEdit2 } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

function formatLastSeen(dateStr) {
  if (!dateStr) return 'Last seen unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = (now - date) / 1000; // seconds
  if (diff < 60) return 'Last seen just now';
  if (diff < 3600) return `Last seen ${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `Last seen ${Math.floor(diff / 3600)} hr ago`;
  if (diff < 86400 * 7) return `Last seen ${Math.floor(diff / 86400)} days ago`;
  return `Last seen ${date.toLocaleDateString()}`;
}

export default function UserProfilePanel({ contact, onClose, onBlock, onRemove, blockedUsers, onViewStore }) {
  const { authFetch, API } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [nickEditing, setNickEditing] = useState(false);
  const [nickDraft, setNickDraft] = useState('');
  const [nickSaving, setNickSaving] = useState(false);

  const isBlocked = blockedUsers?.some(b => b._id === contact?._id || b === contact?._id);

  useEffect(() => {
    if (!contact || contact.isGroup) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const fetchProfile = async () => {
      try {
        const res = await authFetch(`${API}/api/users/profile/${contact._id}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
        // Load this user's nickname for this contact
        const nRes = await authFetch(`${API}/api/users/nicknames`);
        if (nRes.ok) {
          const { nicknames } = await nRes.json();
          setNickname(nicknames[contact._id] || '');
          setNickDraft(nicknames[contact._id] || '');
        }
      } catch {}
      setLoading(false);
    };
    fetchProfile();
  }, [contact?._id, contact?.isGroup, API, authFetch]);

  const saveNickname = async () => {
    setNickSaving(true);
    try {
      await authFetch(`${API}/api/users/nickname/${contact._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickDraft.trim() })
      });
      setNickname(nickDraft.trim());
      setNickEditing(false);
    } catch {} finally { setNickSaving(false); }
  };

  if (!contact) return null;

  if (contact.isGroup) {
    return (
      <div className="profile-panel-backdrop" onClick={onClose}>
        <div className="profile-panel" onClick={e => e.stopPropagation()}>
          <button className="profile-panel-close" onClick={onClose}>
            <FiX size={20} />
          </button>

          <div className="profile-panel-avatar-wrap">
            <div className="profile-panel-avatar-fallback">{contact.name?.[0]?.toUpperCase() || '?'}</div>
          </div>

          <div className="profile-panel-name">{contact.name}</div>
          <div className="profile-panel-uid" style={{ marginTop: 8 }}>
            Group ID (Invite Code): <strong style={{ color: 'var(--text)' }}>{contact.inviteCode || 'N/A'}</strong>
          </div>

          <div className="profile-panel-online-label">
            {contact.members?.length || 0} members
          </div>

          {contact.description && (
            <div className="profile-panel-bio">"{contact.description}"</div>
          )}

          <div className="profile-panel-divider" />
          
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
            Group chat info
          </div>
        </div>
      </div>
    );
  }

  const displayName = nickname || contact.username || contact.email?.split('@')[0] || 'User';
  const initials = displayName[0].toUpperCase();
  const prof = profile || contact;

  // Render business modal
  if (prof.isBusiness) {
    const biz = prof.businessProfile || {};
    return (
      <div className="business-profile-backdrop" onClick={onClose}>
        <div className="business-profile-modal" onClick={e => e.stopPropagation()}>
          <button className="business-profile-close" onClick={onClose}>
            <FiX size={20} />
          </button>
          
          <div className="business-profile-cover" style={biz.banner ? { backgroundImage: `url(${biz.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}} />
          
          <div className="business-profile-logo-wrapper">
            {biz.logo ? (
              <img src={biz.logo} alt="Logo" className="business-profile-logo" />
            ) : prof.avatar ? (
              <img src={prof.avatar} alt="Logo" className="business-profile-logo" />
            ) : (
              <div className="business-profile-fallback">
                {biz.businessName ? biz.businessName[0].toUpperCase() : initials}
              </div>
            )}
          </div>
          
          <div className="business-profile-content">
            <div className="business-profile-header">
              <div>
                <div className="business-profile-title">
                  {biz.businessName || displayName}
                  <FiStar size={24} fill="var(--accent)" color="var(--accent)" style={{ display: 'inline-block' }} title="Verified Business" />
                </div>
                <div className="business-profile-subtitle">
                  {biz.storeType || 'Retail Store'} &bull; Managed by {biz.ownerName || `@${prof.uniqueId}`}
                </div>
              </div>
            </div>

            <div className={`business-status-badge ${biz.storeStatus === 'open' ? 'open' : 'closed'}`}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
              {biz.storeStatus === 'open' ? 'Currently Accepting Orders' : 'Store Currently Closed'}
            </div>

            {biz.description && (
              <div className="business-profile-desc">
                {biz.description}
              </div>
            )}

            {(biz.contactEmail || biz.contactPhone) && (
              <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                {biz.contactEmail && <div><FiMail size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom', color: 'var(--accent)' }} /> <a href={`mailto:${biz.contactEmail}`} style={{ color: 'inherit', textDecoration: 'none' }}>{biz.contactEmail}</a></div>}
                {biz.contactPhone && <div><FiPhone size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom', color: 'var(--accent)' }} /> <a href={`tel:${biz.contactPhone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{biz.contactPhone}</a></div>}
              </div>
            )}

            {biz.policies && (
              <div className="business-profile-policies">
                <div className="business-profile-policies-title">
                  <FiInfo size={16} /> Store Policies
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {biz.policies}
                </div>
              </div>
            )}

            <div className="business-profile-actions">
              {biz.storeStatus === 'open' ? (
                <button className="business-btn-primary" style={{ gridColumn: '1 / -1' }} onClick={() => { onClose(); onViewStore?.(prof._id); }}>
                  <FiShoppingBag size={20} strokeWidth={2.5} /> Browse Full Storefront
                </button>
              ) : (
                <div style={{ gridColumn: '1 / -1', background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)', padding: 16, borderRadius: 12, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Store is closed right now
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
               <button className="business-btn-secondary" style={{ flex: 1 }} onClick={onClose}>
                 <FiMessageCircle size={18} /> Chat Owner
               </button>
               {!isBlocked ? (
                  <button className="business-btn-secondary" style={{ flex: 1, color: 'var(--red)' }} onClick={() => onBlock?.(contact, 'block')}>
                    <FiSlash size={18} /> Block
                  </button>
               ) : (
                  <button className="business-btn-secondary" style={{ flex: 1, color: 'var(--green)' }} onClick={() => onBlock?.(contact, 'unblock')}>
                    <FiCheck size={18} /> Unblock
                  </button>
               )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Render normal slide-out panel
  return (
    <div className="profile-panel-backdrop" onClick={onClose}>
      <div className="profile-panel" onClick={e => e.stopPropagation()}>
        <button className="profile-panel-close" onClick={onClose}>
          <FiX size={20} />
        </button>

        <div className="profile-panel-avatar-wrap">
          {prof.avatar
            ? <img src={prof.avatar} alt="" className="profile-panel-avatar" />
            : <div className="profile-panel-avatar-fallback">{initials}</div>
          }
          <div className={`profile-panel-status-dot ${prof.isOnline ? 'online' : 'offline'}`} />
        </div>

        <div className="profile-panel-name">
          {displayName}
        </div>
        <div className="profile-panel-uid">@{prof.uniqueId}</div>

        <div className={`profile-panel-online-label ${prof.isOnline ? 'online' : ''}`}>
          {prof.isOnline ? (
            <>
              <span className="status-dot-mini alive" />
              Online now
            </>
          ) : formatLastSeen(prof.lastSeen)}
        </div>

        {prof.bio && (
          <div className="profile-panel-bio">"{prof.bio}"</div>
        )}

        {/* ── Nickname editor ───────────────────── */}
        <div style={{ margin: '14px 0 0', padding: '14px 20px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: nickEditing ? 10 : 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Nickname (only you see this)</span>
            {!nickEditing && (
              <button onClick={() => { setNickDraft(nickname); setNickEditing(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4, borderRadius: 6 }}>
                <FiEdit2 size={14} />
              </button>
            )}
          </div>
          {nickEditing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
                placeholder={contact.username || 'Set a nickname...'}
                value={nickDraft}
                onChange={e => setNickDraft(e.target.value)}
                autoFocus
              />
              <button onClick={saveNickname} disabled={nickSaving} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {nickSaving ? '...' : 'Save'}
              </button>
              <button onClick={() => setNickEditing(false)} style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: nickname ? 'var(--text)' : 'var(--text-muted)', fontStyle: nickname ? 'normal' : 'italic', marginTop: 4 }}>
              {nickname || 'No nickname set'}
            </div>
          )}
        </div>

        <div className="profile-panel-divider" />

        <div className="profile-panel-info-row">
          <span className="profile-panel-info-label">Email</span>
          <span className="profile-panel-info-value">{prof.email || '—'}</span>
        </div>

        <div className="profile-panel-divider" />

        <div className="profile-panel-actions">
          {isBlocked ? (
            <button className="profile-panel-action-btn unblock" onClick={() => onBlock?.(contact, 'unblock')}>
              <FiCheck size={16} /> Unblock
            </button>
          ) : (
            <button className="profile-panel-action-btn block" onClick={() => onBlock?.(contact, 'block')}>
              <FiSlash size={16} /> Block
            </button>
          )}
          <button className="profile-panel-action-btn remove" onClick={() => onRemove?.(contact)}>
            <FiUserMinus size={16} /> Remove
          </button>
        </div>
      </div>
    </div>
  );
}
