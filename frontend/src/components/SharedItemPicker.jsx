import { useState, useEffect } from 'react';
import { FiX, FiCalendar, FiCheckSquare, FiUser, FiSearch, FiPlus } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

export default function SharedItemPicker({ type, onSelect, onClose }) {
  const { authFetch, API } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchItems();
  }, [type]);

  const fetchItems = async () => {
    setLoading(true);
    let endpoint = '';
    if (type === 'event') endpoint = '/api/events';
    else if (type === 'task') endpoint = '/api/tasks';
    else if (type === 'contact') endpoint = '/api/users/contacts';

    try {
      const res = await authFetch(`${API}${endpoint}`);
      if (res.ok) {
        const data = await res.json();
        setItems(type === 'contact' ? data.contacts : data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(it => {
    const q = search.toLowerCase();
    if (type === 'contact') return it.username?.toLowerCase().includes(q) || it.uniqueId?.toLowerCase().includes(q);
    return it.title?.toLowerCase().includes(q) || it.description?.toLowerCase().includes(q);
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: '90%' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="modal-title" style={{ margin: 0 }}>Share {type.charAt(0).toUpperCase() + type.slice(1)}</div>
          <button className="icon-btn" onClick={onClose}><FiX size={20} /></button>
        </div>

        <div className="search-bar" style={{ marginBottom: 15 }}>
          <FiSearch className="search-icon" />
          <input 
            className="search-input" 
            placeholder={`Search ${type}s...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="picker-list" style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No {type}s found</div>
          ) : (
            filteredItems.map(it => (
              <div 
                key={it._id} 
                className="picker-item" 
                onClick={() => onSelect(it)}
                style={{ 
                  padding: '12px 16px', 
                  borderRadius: 12, 
                  background: 'var(--bg-elevated)', 
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              >
                <div style={{ 
                  width: 40, height: 40, borderRadius: 10, 
                  background: type === 'event' ? '#6366f122' : type === 'task' ? '#10b98122' : '#f59e0b22',
                  color: type === 'event' ? '#6366f1' : type === 'task' ? '#10b981' : '#f59e0b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {type === 'event' ? <FiCalendar /> : type === 'task' ? <FiCheckSquare /> : <FiUser />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{type === 'contact' ? it.username : it.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {type === 'contact' ? `@${it.uniqueId}` : it.description?.slice(0, 50) || (type === 'event' ? new Date(it.date).toLocaleDateString() : '')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
