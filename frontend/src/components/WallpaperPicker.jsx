import { useState, useRef } from 'react';
import { FiX, FiUpload, FiTrash2, FiMoon } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

const PRESET_WALLPAPERS = [
  { label: 'Midnight', value: 'linear-gradient(135deg, #0d0f14 0%, #1a1d28 100%)' },
  { label: 'Space', value: 'linear-gradient(160deg, #060616 0%, #1a0d40 50%, #0a1628 100%)' },
  { label: 'Ocean Depth', value: 'linear-gradient(160deg, #050f1a 0%, #0c2235 50%, #081827 100%)' },
  { label: 'Aurora', value: 'linear-gradient(135deg, #0d1b2a 0%, #1a2d1a 40%, #0d2b38 100%)' },
  { label: 'Cosmic', value: 'linear-gradient(135deg, #08060e 0%, #1a0838 50%, #0f0b24 100%)' },
  { label: 'Sunset', value: 'linear-gradient(135deg, #1a0a0a 0%, #2d1a0d 50%, #1a1228 100%)' },
  { label: 'Forest', value: 'linear-gradient(135deg, #071a0d 0%, #0f2d1a 50%, #071a12 100%)' },
  { label: 'Rose', value: 'linear-gradient(135deg, #1a0d14 0%, #2d0f1a 50%, #1a0a1a 100%)' },
];

export default function WallpaperPicker({ contact, currentWallpaper, onClose, onApply }) {
  const { authFetch, API } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentWallpaper || '');
  const [selected, setSelected] = useState(currentWallpaper || '');
  const [dimLevel, setDimLevel] = useState(() => parseFloat(localStorage.getItem('st_wallpaper_dim') || '0.4'));
  const fileRef = useRef();

  const isGlobal = !contact;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await authFetch(`${API}/api/messages/upload`, { method: 'POST', body: form });
      if (res.ok) {
        const { url } = await res.json();
        setSelected(url);
        setPreview(url);
      }
    } catch {}
    setUploading(false);
  };

  const handleApply = async () => {
    try {
      await authFetch(`${API}/api/users/wallpaper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact?._id || null, imageUrl: selected })
      });
      localStorage.setItem('st_wallpaper_dim', dimLevel.toString());
      onApply?.(selected, contact?._id || 'global');
      window.dispatchEvent(new Event('wallpaper-dim-changed'));
      onClose?.();
    } catch {}
  };

  const handleRemove = async () => {
    try {
      await authFetch(`${API}/api/users/wallpaper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact?._id || null, imageUrl: '' })
      });
      onApply?.('', contact?._id || 'global');
      onClose?.();
    } catch {}
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wallpaper-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="modal-title">
            {isGlobal ? '🖼️ Global Wallpaper' : `🖼️ Wallpaper for ${contact?.username || 'this chat'}`}
          </div>
          <button className="icon-btn" onClick={onClose}><FiX size={18} /></button>
        </div>

        {/* Preview */}
        <div className="wallpaper-preview-box" style={{
          background: selected?.startsWith('http') ? `url(${selected}) center/cover no-repeat` : (selected || 'var(--bg-elevated)'),
          position: 'relative',
          overflow: 'hidden'
        }}>
          {selected && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${dimLevel})` }} />}
          {!selected && <span style={{ color: 'var(--text-muted)', fontSize: 13, position: 'relative', zIndex: 1 }}>No wallpaper selected</span>}
        </div>

        {/* Dimness Slider */}
        {selected && (
          <div style={{ marginBottom: 16, background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiMoon size={14} /> Wallpaper Darkness
              </div>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 'bold' }}>{Math.round(dimLevel * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={dimLevel} 
              onChange={e => setDimLevel(parseFloat(e.target.value))} 
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>
        )}

        {/* Upload custom */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Custom Image</div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ width: '100%', gap: 8 }}
          >
            <FiUpload size={15} />
            {uploading ? 'Uploading...' : 'Upload from device'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        {/* Presets */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preset Themes</div>
        <div className="wallpaper-presets">
          {PRESET_WALLPAPERS.map(wp => (
            <div
              key={wp.label}
              className={`wallpaper-preset-item ${selected === wp.value ? 'selected' : ''}`}
              style={{ background: wp.value }}
              onClick={() => { setSelected(wp.value); setPreview(wp.value); }}
              title={wp.label}
            >
              {selected === wp.value && <div className="wallpaper-preset-check">✓</div>}
              <div className="wallpaper-preset-label">{wp.label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {currentWallpaper && (
            <button className="btn btn-danger btn-sm" onClick={handleRemove} style={{ gap: 6 }}>
              <FiTrash2 size={14} /> Remove
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleApply} style={{ flex: 1 }}>Apply</button>
        </div>
      </div>
    </div>
  );
}
