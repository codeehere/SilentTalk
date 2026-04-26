import { useState, useEffect } from 'react';
import { FiUser, FiShield, FiKey, FiCamera, FiImage, FiCalendar, FiCheckSquare, FiShare2, FiChevronLeft, FiBriefcase, FiShoppingBag } from 'react-icons/fi';
import { MdPalette } from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { exportPublicKey } from '../lib/crypto';
import WallpaperPicker from './WallpaperPicker';
import ImageCropper from './ImageCropper';

const THEME_PREVIEWS = {
  dark:    ['#0d0f14','#13161e','#7c6af7'],
  light:   ['#f5f5fa','#ffffff','#6d5be6'],
  cosmic:  ['#080616','#0f0b24','#c084fc'],
  ocean:   ['#050f1a','#081827','#38bdf8']
};

export default function Settings({ wallpapers = {}, onWallpaperChange, onViewChange }) {
  const { user, authFetch, API, updateUser } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState(user?.settings?.notifications ?? true);
  const [readReceipts, setReadReceipts] = useState(user?.settings?.readReceipts ?? true);
  const [lastSeenVisible, setLastSeenVisible] = useState(user?.settings?.lastSeenVisible ?? true);
  const [privacyPin, setPrivacyPin] = useState('');
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Business fields
  const [isBusiness, setIsBusiness] = useState(user?.isBusiness || false);
  const [businessName, setBusinessName] = useState(user?.businessProfile?.businessName || '');
  const [ownerName, setOwnerName] = useState(user?.businessProfile?.ownerName || '');
  const [storeStatus, setStoreStatus] = useState(user?.businessProfile?.storeStatus || 'closed');
  const [storeType, setStoreType] = useState(user?.businessProfile?.storeType || 'Retail');
  const [contactEmail, setContactEmail] = useState(user?.businessProfile?.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(user?.businessProfile?.contactPhone || '');
  const [policies, setPolicies] = useState(user?.businessProfile?.policies || '');
  const [acceptedPayments, setAcceptedPayments] = useState(user?.businessProfile?.acceptedPayments || ['Cash on Delivery']);
  const [logoCropSrc, setLogoCropSrc] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerCropSrc, setBannerCropSrc] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [busSaving, setBusSaving] = useState(false);
  const [busSaved, setBusSaved] = useState(false);

  const ALL_PAYMENT_METHODS = [
    { id: 'UPI',                label: 'UPI',               icon: '📲', desc: 'PhonePe, GPay, Paytm' },
    { id: 'Credit / Debit Card', label: 'Card',             icon: '💳', desc: 'Visa, Mastercard, Rupay' },
    { id: 'Cash on Delivery',   label: 'Cash on Delivery', icon: '💵', desc: 'Pay when you receive' },
    { id: 'Bank Transfer',      label: 'Bank Transfer',    icon: '🏦', desc: 'NEFT / IMPS / SWIFT' },
    { id: 'PayPal',             label: 'PayPal',           icon: '🅿️', desc: 'International payments' },
    { id: 'Crypto',             label: 'Crypto',           icon: '₿',  desc: 'BTC, ETH, USDT' },
    { id: 'Wallet',             label: 'Wallet',           icon: '👛', desc: 'Paytm, Amazon Pay' },
  ];

  const togglePayment = (id) => {
    setAcceptedPayments(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const saveBusinessProfile = async () => {
    setBusSaving(true);
    try {
      const res = await authFetch(`${API}/api/store/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBusiness, businessProfile: { businessName, ownerName, storeStatus, storeType, contactEmail, contactPhone, policies, acceptedPayments } })
      });
      if (res.ok) {
        const data = await res.json();
        updateUser({ ...user, ...data });
        setBusSaved(true);
        setTimeout(() => setBusSaved(false), 2000);
      }
    } finally { setBusSaving(false); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`${API}/api/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, bio, settings: { notifications, readReceipts, lastSeenVisible } })
      });
      if (res.ok) {
        const data = await res.json();
        updateUser(data.user);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally { setSaving(false); }
  };
  
  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarCropSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = null; // reset
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoCropSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const handleBannerSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBannerCropSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const uploadAvatar = (blob) => {
    setAvatarCropSrc(null);
    setAvatarUploading(true);
    setUploadProgress(0);
    
    const form = new FormData();
    form.append('avatar', blob, 'avatar.jpg');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/users/avatar`, true);
    
    // Get token natively or from localStorage
    const token = localStorage.getItem('st_token') || localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setAvatarUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const { avatarUrl } = JSON.parse(xhr.responseText);
        updateUser({ avatar: avatarUrl });
      } else {
        const error = JSON.parse(xhr.responseText || '{}');
        alert(error.message || 'Failed to upload avatar');
      }
    };

    xhr.onerror = () => {
      setAvatarUploading(false);
      alert('Network error during upload');
    };

    xhr.send(form);
  };

  const uploadLogo = (blob) => {
    setLogoCropSrc(null);
    setLogoUploading(true);
    setUploadProgress(0);
    
    const form = new FormData();
    form.append('image', blob, 'logo.jpg');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/store/profile/logo`, true);
    
    const token = localStorage.getItem('st_token') || localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setLogoUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const JSONResponse = JSON.parse(xhr.responseText || '{}');
        const logoUrl = JSONResponse.logoUrl;
        updateUser({ businessProfile: { ...user?.businessProfile, logo: logoUrl } });
      } else {
        alert('Upload failed');
      }
    };

    xhr.onerror = () => {
      setLogoUploading(false);
      alert('Network error during upload');
    };

    xhr.send(form);
  };

  const uploadBanner = (blob) => {
    setBannerCropSrc(null);
    setBannerUploading(true);
    setUploadProgress(0);
    
    const form = new FormData();
    form.append('image', blob, 'banner.jpg');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/store/profile/banner`, true);
    
    const token = localStorage.getItem('st_token') || localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      setBannerUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const JSONResponse = JSON.parse(xhr.responseText || '{}');
        const bannerUrl = JSONResponse.bannerUrl;
        updateUser({ businessProfile: { ...user?.businessProfile, banner: bannerUrl } });
      } else {
        alert('Upload failed');
      }
    };

    xhr.send(form);
  };

  const initials = (user?.username || user?.email || 'U')[0].toUpperCase();

  return (
    <div className="chat-window">
      <div className="chat-header">
        {/* Mobile back button */}
        <button
          className="icon-btn mobile-only-back"
          style={{ marginRight: 4 }}
          onClick={() => onViewChange?.('chats')}
          title="Back"
        >
          <FiChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>Settings</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-base)' }}>
        <div style={{ padding: '20px 28px', maxWidth: 840, margin: '0 auto' }}>

        {/* Mobile Hub Navigation - Desktop hidden */}
        <div className="settings-section mobile-only">
          <div className="settings-section-title">Features</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <button className="hub-btn" onClick={() => onViewChange?.('events')}>
              <div className="hub-icon event-hub"><FiCalendar size={22} /></div>
              <span>Events</span>
            </button>
            <button className="hub-btn" onClick={() => onViewChange?.('tasks')}>
              <div className="hub-icon task-hub"><FiCheckSquare size={22} /></div>
              <span>Tasks</span>
            </button>
            <button className="hub-btn" onClick={() => onViewChange?.('request')}>
              <div className="hub-icon req-hub"><FiShare2 size={22} /></div>
              <span>Request</span>
            </button>
          </div>
        </div>

        {/* Profile section */}
        <div className="settings-section">
          <div className="settings-section-title">
            <FiUser size={14} style={{ display: 'inline', marginRight: 6 }} />Profile
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
            <div style={{ position: 'relative', cursor: 'pointer' }}>
              {avatarUploading ? (
                <div style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid var(--border)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle cx="36" cy="36" r="34" fill="none" stroke="transparent" strokeWidth="2" />
                    <circle cx="36" cy="36" r="34" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="213" strokeDashoffset={213 - (213 * uploadProgress) / 100} style={{ transition: 'stroke-dashoffset 0.2s linear' }} />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', zIndex: 1 }}>{uploadProgress}%</span>
                </div>
              ) : user?.avatar ? (
                <img src={user.avatar} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)' }} />
              ) : (
                <div className="avatar-fallback" style={{ width: 72, height: 72, fontSize: 28 }}>{initials}</div>
              )}
              <label style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                <FiCamera size={20} color="#fff" />
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarSelect} />
              </label>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.username || 'Set a username'}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>@{user?.uniqueId}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{user?.email}</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Display name</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your name" />
          </div>
          <div className="form-group">
            <label className="form-label">Bio</label>
            <input className="input" value={bio} onChange={e => setBio(e.target.value)} placeholder="A short bio..." maxLength={200} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>

        {/* Theme */}
        <div className="settings-section">
          <div className="settings-section-title">
            <MdPalette size={14} style={{ display: 'inline', marginRight: 6 }} />Appearance
          </div>
          <div className="theme-grid">
            {themes.map(t => {
              const [c1, c2, accent] = THEME_PREVIEWS[t];
              return (
                <div key={t} className={`theme-option ${theme === t ? 'selected' : ''}`} onClick={() => setTheme(t)}>
                  <div className="theme-preview">
                    <div className="theme-preview-bar" style={{ background: c1 }} />
                    <div className="theme-preview-bar" style={{ background: c2 }} />
                    <div style={{ width: 16, background: accent }} />
                  </div>
                  <div className="theme-label">{t.charAt(0).toUpperCase() + t.slice(1)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Privacy */}
        <div className="settings-section">
          <div className="settings-section-title">
            <FiShield size={13} style={{ display: 'inline', marginRight: 6 }} />Privacy &amp; Notifications
          </div>
          {[
            { label: 'Notifications', desc: 'Receive message notifications', val: notifications, set: setNotifications },
            { label: 'Read Receipts', desc: "Let others know you've read their messages", val: readReceipts, set: setReadReceipts },
            { label: 'Last Seen', desc: 'Show when you were last active', val: lastSeenVisible, set: setLastSeenVisible }
          ].map(({ label, desc, val, set }) => (
            <div key={label} className="settings-row">
              <div>
                <div className="settings-row-label">{label}</div>
                <div className="settings-row-desc">{desc}</div>
              </div>
              <div className={`toggle ${val ? 'on' : ''}`} onClick={() => set(!val)} />
            </div>
          ))}
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div>
              <div className="settings-row-label">Privacy PIN</div>
              <div className="settings-row-desc">Set a 4-digit PIN to secure your locked chats.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input 
                className="input" 
                type="password" 
                placeholder="••••" 
                maxLength={4} 
                value={privacyPin} 
                onChange={e => setPrivacyPin(e.target.value.replace(/\D/g, ''))} 
                style={{ width: 80, textAlign: 'center', letterSpacing: 4 }} 
              />
              <button className="btn btn-secondary" onClick={async () => {
                try {
                  const res = await authFetch(`${API}/api/users/privacy-pin`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: privacyPin })
                  });
                  if (res.ok) {
                    alert('Privacy PIN saved successfully!');
                    setPrivacyPin('');
                  } else {
                    const d = await res.json();
                    alert(d.message);
                  }
                } catch (e) { alert(e.message); }
              }}>Save PIN</button>
            </div>
          </div>
        </div>

        {/* Business Settings */}
        <div className="settings-section">
          <div className="settings-section-title">
            <FiBriefcase size={14} style={{ display: 'inline', marginRight: 6 }} />Professional Account
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Business Account</div>
              <div className="settings-row-desc">Enable store features and public catalog</div>
            </div>
            <div className={`toggle ${isBusiness ? 'on' : ''}`} onClick={async () => {
              const newValue = !isBusiness;
              setIsBusiness(newValue);
              if (!newValue) {
                try {
                  const res = await authFetch(`${API}/api/store/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isBusiness: false })
                  });
                  if (res.ok) {
                    const data = await res.json();
                    updateUser({ ...user, ...data });
                  }
                } catch {}
              }
            }} />
          </div>
          
          {isBusiness && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                {/* Banner Upload */}
                <div style={{ position: 'relative', cursor: 'pointer', flex: 1, height: 80, borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {bannerUploading ? (
                     <span style={{ fontSize: 12, fontWeight: 700 }}>{uploadProgress}%</span>
                  ) : user?.businessProfile?.banner ? (
                     <img src={user?.businessProfile?.banner} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                  ) : (
                     <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><FiImage /> Upload Profile Banner</div>
                  )}
                  <label style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                     <FiCamera size={18} color="#fff" />
                     <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerSelect} />
                  </label>
                </div>

                {/* Logo Upload */}
                <div style={{ position: 'relative', cursor: 'pointer', width: 80, height: 80, borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {logoUploading ? (
                     <span style={{ fontSize: 12, fontWeight: 700 }}>{uploadProgress}%</span>
                  ) : user?.businessProfile?.logo ? (
                     <img src={user?.businessProfile?.logo} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                  ) : (
                     <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>Logo</div>
                  )}
                  <label style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                     <FiCamera size={18} color="#fff" />
                     <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoSelect} />
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input className="input" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="form-group">
                <label className="form-label">Owner Name</label>
                <input className="input" value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your Name" />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Support Email</label>
                  <input className="input" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="hello@store.com" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Support Phone</label>
                  <input className="input" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+1 234 567 890" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Store Category</label>
                <select className="input" value={storeType} onChange={e => setStoreType(e.target.value)}>
                  <option value="Retail">Retail</option>
                  <option value="Food & Dining">Food & Dining</option>
                  <option value="Clothing">Clothing</option>
                  <option value="Digital Goods">Digital Goods</option>
                  <option value="Services">Services</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Store Visibility</label>
                <select className="input" value={storeStatus} onChange={e => setStoreStatus(e.target.value)}>
                  <option value="open">Store is Open</option>
                  <option value="closed">Store is Closed</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Store Policies</label>
                <textarea className="input" value={policies} onChange={e => setPolicies(e.target.value)} placeholder="Returns, shipping rules..." rows={3} />
              </div>

              {/* ── Accepted Payment Methods ── */}
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: 12, display: 'block' }}>Accepted Payment Methods</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {ALL_PAYMENT_METHODS.map(({ id, label, icon, desc }) => {
                    const active = acceptedPayments.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => togglePayment(id)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                          gap: 4, padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                          background: active ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                          borderTop: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          borderLeft: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          borderRight: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          borderBottom: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          textAlign: 'left', transition: '0.18s',
                          transform: active ? 'scale(1.03)' : 'scale(1)'
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text)' }}>{label}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>{desc}</span>
                        {active && (
                          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 6px', borderRadius: 4, marginTop: 2 }}>ENABLED</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button className="btn btn-primary btn-sm" onClick={saveBusinessProfile} disabled={busSaving}>
                {busSaving ? 'Saving...' : busSaved ? 'Saved!' : 'Save Business Info'}
              </button>
            </div>
          )}
        </div>

        {/* Wallpaper */}
        <div className="settings-section">
          <div className="settings-section-title">
            <FiImage size={13} style={{ display: 'inline', marginRight: 6 }} />Chat Wallpaper
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Global Wallpaper</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Applies to all chats without a custom wallpaper</div>
              {wallpapers?.global && (
                <div style={{ marginTop: 8, width: 48, height: 28, borderRadius: 6,
                  background: wallpapers.global.startsWith('http') ? `url(${wallpapers.global}) center/cover` : wallpapers.global,
                  border: '1px solid var(--border)'
                }} />
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowWallpaperPicker(true)}>
              {wallpapers?.global ? 'Change' : 'Set Wallpaper'}
            </button>
          </div>
        </div>

        {/* E2EE */}
        <div className="settings-section">
          <div className="settings-section-title">
            <FiKey size={13} style={{ display: 'inline', marginRight: 6 }} />Security
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiShield size={14} color="var(--green)" /> End-to-End Encrypted
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
              Your messages are encrypted using NaCl Curve25519. The server never has access to your private key or message content.
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', wordBreak: 'break-all', background: 'var(--bg-surface)', padding: '8px 10px', borderRadius: 6 }}>
              Public Key: {exportPublicKey().slice(0, 32)}...
            </div>
          </div>
        </div>

      </div>

      {showWallpaperPicker && (
        <WallpaperPicker
          contact={null}
          currentWallpaper={wallpapers?.global || ''}
          onClose={() => setShowWallpaperPicker(false)}
          onApply={(imageUrl, key) => onWallpaperChange?.(key, imageUrl)}
        />
      )}

      {avatarCropSrc && (
        <ImageCropper
          imageSrc={avatarCropSrc}
          aspect={1}
          onCropComplete={uploadAvatar}
          onCancel={() => setAvatarCropSrc(null)}
        />
      )}

      {logoCropSrc && (
        <ImageCropper
          imageSrc={logoCropSrc}
          aspect={1}
          onCropComplete={uploadLogo}
          onCancel={() => setLogoCropSrc(null)}
        />
      )}
      
      {bannerCropSrc && (
        <ImageCropper
          imageSrc={bannerCropSrc}
          aspect={3}
          onCropComplete={uploadBanner}
          onCancel={() => setBannerCropSrc(null)}
        />
      )}
      </div>
    </div>
  );
}
