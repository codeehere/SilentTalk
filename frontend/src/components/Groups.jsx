import { useState, useEffect } from 'react';
import { FiPlus, FiUsers, FiUserPlus, FiX, FiStar, FiShield, FiTrash2 } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import ChatWindow from './ChatWindow';

// Group chat UI is now unified in ChatWindow

export default function Groups({ onSelectGroup }) {
  const { authFetch, API, user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => { 
    fetchGroups();
    const fetchContacts = async () => {
      const res = await authFetch(`${API}/api/contacts`);
      if (res.ok) setContacts(await res.json());
    };
    fetchContacts();
  }, [API, authFetch]);

  const fetchGroups = async () => {
    const res = await authFetch(`${API}/api/groups`);
    if (res.ok) setGroups(await res.json());
  };

  const createGroup = async () => {
    if (!name.trim() || selectedContacts.length === 0) return;
    const res = await authFetch(`${API}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: desc, memberIds: selectedContacts })
    });
    if (res.ok) { fetchGroups(); setShowCreate(false); setName(''); setDesc(''); setSelectedContacts([]); }
  };

  return (
    <div className="section-pane" style={{ position: 'relative' }}>
      <div className="panel-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <span className="whatsapp-header-title">Groups</span>
        <button className="icon-btn desktop-only" onClick={() => setShowCreate(true)}><FiPlus size={18} /></button>
      </div>
      <div className="panel-scroll">
        {groups.length === 0 && (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon"><FiUsers size={30} /></div>
            <h3>No groups yet</h3>
            <p>Create a group to start collaborating</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>Create Group</button>
          </div>
        )}
        {groups.map(g => (
          <div key={g._id} className="contact-item" onClick={() => onSelectGroup(g)}>
            <div className="avatar-fallback" style={{ width: 44, height: 44 }}>{g.name[0]?.toUpperCase() || '?'}</div>
            <div className="contact-info">
              <div className="contact-name">{g.name}</div>
              <div className="contact-preview">
                {g.members?.length} members · ID: {g.inviteCode || 'N/A'} 
                {g.description ? ` · ${g.description}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Create Group</div>
            <div className="form-group">
              <label className="form-label">Group name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Project Alpha" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this group about?" />
            </div>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Add Members (required)</label>
              <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--bg-surface)' }}>
                {contacts.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>No contacts found</div> : contacts.map(c => (
                  <label key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedContacts.includes(c._id)} onChange={e => {
                      if (e.target.checked) setSelectedContacts([...selectedContacts, c._id]);
                      else setSelectedContacts(selectedContacts.filter(id => id !== c._id));
                    }} style={{ accentColor: 'var(--accent)' }} />
                    <div className="avatar-fallback" style={{ width: 24, height: 24, fontSize: 11 }}>{(c.username || c.uniqueId)[0]?.toUpperCase()}</div>
                    <span style={{ fontSize: 14 }}>{c.username || c.uniqueId}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={createGroup} disabled={!name.trim() || selectedContacts.length === 0}>Create Group</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button */}
      <div className="fab-container mobile-only">
        <button className="fab-button" onClick={() => setShowCreate(true)}>
          <FiPlus size={24} />
        </button>
      </div>
    </div>
  );
}
