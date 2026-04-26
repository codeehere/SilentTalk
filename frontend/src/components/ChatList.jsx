import { useState, useEffect } from 'react';
import { FiSearch, FiUserPlus, FiX, FiUser, FiMapPin, FiLock, FiArchive, FiTrash2 } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

function AvatarFallback({ name, size = 44 }) {
  const initials = (name || '?')[0].toUpperCase();
  return (
    <div className="avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

export default function ChatList({ activeContactId, onSelectContact, blockedUsers = [], onBlockChange, onUnreadChange, nicknames = {} }) {
  const { user, authFetch, API } = useAuth();
  const { onlineUsers, on, off } = useSocket();
  const [contacts, setContacts] = useState(() => {
    try {
      const cached = localStorage.getItem('st_contacts_cache');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });

  // Sync global unread count
  useEffect(() => {
    if (!onUnreadChange) return;
    const globalUnread = {};
    contacts.forEach(c => {
      if (c.unreadCount > 0) {
        globalUnread[c._id] = c.unreadCount;
      }
    });
    onUnreadChange(globalUnread);
  }, [contacts, onUnreadChange]);
  const [pendingContacts, setPendingContacts] = useState([]);
  const [activeTab, setActiveTab] = useState('chats');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  // Chat state metadata
  const [pinnedChats, setPinnedChats] = useState([]);
  const [lockedChats, setLockedChats] = useState([]);
  const [archivedChats, setArchivedChats] = useState([]);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, contact: null });
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showLockModal, setShowLockModal] = useState(null);
  const [lockPin, setLockPin] = useState('');
  const [lockError, setLockError] = useState('');

  useEffect(() => {
    const handleClick = () => setContextMenu({ show: false, x: 0, y: 0, contact: null });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    fetchContacts();
    const handleMetadata = () => fetchContacts();
    window.addEventListener('chat-metadata-updated', handleMetadata);
    return () => window.removeEventListener('chat-metadata-updated', handleMetadata);
  }, []);

  useEffect(() => {
    const fetchAndAddMissingContact = async (userId) => {
      if (!userId) return;
      try {
        const res = await authFetch(`${API}/api/users/profile/${userId}`);
        if (res.ok) {
          const u = await res.json();
          setContacts(prev => prev.some(c => c._id === u._id) ? prev : [u, ...prev]);
        }
      } catch {}
    };

    const onEvent = (data) => {
      const incomingId = data.groupId || data.senderId || data.from; // group, message, or call
      if (!incomingId) return;
      setContacts(prev => {
        const updated = [...prev];
        const existing = updated.find(c => c._id.toString() === incomingId.toString());
        if (existing) {
          if (incomingId.toString() !== activeContactId?.toString()) {
            existing.unreadCount = (existing.unreadCount || 0) + 1;
          }
        } else {
          fetchAndAddMissingContact(incomingId);
        }
        return updated;
      });
    };

    const onReadAllConfirmed = ({ contactId }) => {
      setContacts(prev => prev.map(c => c._id.toString() === contactId.toString() ? { ...c, unreadCount: 0 } : c));
    };

    const onProfileUpdate = ({ userId, avatar }) => {
      setContacts(prev => prev.map(c => c._id.toString() === userId.toString() ? { ...c, avatar } : c));
    };
    
    on('message:receive', onEvent);
    on('call:incoming', onEvent);
    on('message:read_all_confirmed', onReadAllConfirmed);
    on('user:profile_updated', onProfileUpdate);

    const onMetadataUpdate = () => fetchContacts();
    window.addEventListener('chat-metadata-updated', onMetadataUpdate);

    return () => {
      off('message:receive', onEvent);
      off('call:incoming', onEvent);
      off('message:read_all_confirmed', onReadAllConfirmed);
      off('user:profile_updated', onProfileUpdate);
      window.removeEventListener('chat-metadata-updated', onMetadataUpdate);
    };
  }, [on, off, activeContactId]);

  const fetchContacts = async () => {
    try {
      const [contactsRes, groupsRes] = await Promise.all([
        authFetch(`${API}/api/users/contacts`),
        authFetch(`${API}/api/groups`)
      ]);
      
      if (contactsRes.ok) {
        const data = await contactsRes.json();
        let fetchedContacts = data.contacts || [];

        if (groupsRes.ok) {
          const groups = await groupsRes.json();
          const mappedGroups = groups.map(g => ({
            ...g,
            isGroup: true,
            username: g.name,
            avatar: g.avatarUrl,
            uniqueId: g.inviteCode
          }));
          fetchedContacts = [...fetchedContacts, ...mappedGroups];
        }

        // Prevent active contact from showing unread badge if fetched that way
        if (activeContactId) {
          fetchedContacts = fetchedContacts.map(c => c._id === activeContactId ? { ...c, unreadCount: 0 } : c);
        }
        setContacts(fetchedContacts);
        try { localStorage.setItem('st_contacts_cache', JSON.stringify(fetchedContacts)); } catch (e) {}
        setPendingContacts(data.pendingContacts || []);
        setPinnedChats(data.pinnedChats || []);
        setLockedChats(data.lockedChats || []);
        setArchivedChats(data.archivedChats || []);
      }
    } catch {}
  };

  useEffect(() => {
    if (activeContactId) {
      setContacts(prev => prev.map(c => c._id.toString() === activeContactId.toString() ? { ...c, unreadCount: 0 } : c));
    }
  }, [activeContactId]);

  const handleSearch = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await authFetch(`${API}/api/users/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setSearchResults(await res.json());
    } catch {} finally { setSearching(false); }
  };

  const addContact = async (u) => {
    try {
      const res = await authFetch(`${API}/api/users/contacts/${u._id}`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to add contact');
      }
      setContacts(prev => prev.some(c => c._id === u._id) ? prev : [...prev, u]);
      setSearchResults([]);
      setSearchQ('');
      setShowSearch(false);
      onSelectContact(u);
    } catch (err) {
      alert("Error adding contact: " + err.message);
    }
  };

  const handleAccept = async (e, u) => {
    e.stopPropagation();
    try {
      const res = await authFetch(`${API}/api/users/contacts/${u._id}/accept`, { method: 'POST' });
      if (res.ok) {
        setPendingContacts(prev => prev.filter(c => c._id !== u._id));
        setContacts(prev => [...prev, u]);
        onSelectContact(u);
      }
    } catch {}
  };

  const handleDecline = async (e, u) => {
    e.stopPropagation();
    try {
      const res = await authFetch(`${API}/api/users/contacts/${u._id}/decline`, { method: 'POST' });
      if (res.ok) {
        setPendingContacts(prev => prev.filter(c => c._id !== u._id));
        if (activeContactId === u._id) onSelectContact(null);
      }
    } catch {}
  };

  const isOnline = (id) => onlineUsers.has(id?.toString());
  
  const displayList = (() => {
    if (showSearch && searchQ.length >= 2) return searchResults;
    if (activeTab === 'requests') return pendingContacts;
    if (activeTab === 'blocked') return blockedUsers;
    if (activeTab === 'archived') return contacts.filter(c => archivedChats.includes(c._id));
    
    // Filter out ONLY archived chats from main list, locked chats stay but require PIN
    const mainList = contacts.filter(c => !archivedChats.includes(c._id));
    
    // Sort: Pinned first, then by last message/online if needed
    return [...mainList].sort((a, b) => {
      const aPinned = pinnedChats.includes(a._id);
      const bPinned = pinnedChats.includes(b._id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0; // Keep original order (last message)
    });
  })();

  const handleAction = async (type, contactId) => {
    setContextMenu({ ...contextMenu, show: false });
    try {
      const res = await authFetch(`${API}/api/users/${type}/${contactId}`, { method: 'PUT' });
      if (res.ok) {
        const data = await res.json();
        if (type === 'pin') setPinnedChats(data.pinnedChats);
        if (type === 'lock') setLockedChats(data.lockedChats);
        if (type === 'archive') setArchivedChats(data.archivedChats);
      }
    } catch {}
  };

  const deleteChat = async (id, bothSides) => {
    try {
      await authFetch(`${API}/api/users/contacts/${id}?bothSides=${bothSides}`, { method: 'DELETE' });
      setContacts(prev => prev.filter(c => c._id !== id));
      if (activeContactId === id) onSelectContact(null);
    } catch (err) { alert(err.message); }
  };

  const unblockContact = async (e, u) => {
    e.stopPropagation();
    try {
      const res = await authFetch(`${API}/api/users/unblock/${u._id || u}`, { method: 'POST' });
      if (res.ok) {
        onBlockChange?.(u._id || u, 'unblock');
        fetchContacts();
      }
    } catch {}
  };

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <div className="panel-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <span className="whatsapp-header-title">Messages</span>
        <button className="icon-btn" onClick={() => setShowSearch(s => !s)} title="Add contact">
          {showSearch ? <FiX size={18} /> : <FiUserPlus size={18} />}
        </button>
      </div>

      {!showSearch && (
        <div className="segmented-control" style={{ marginTop: 16 }}>
          <button 
            className={`segment-tab ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
          >Chats</button>
          <button 
            className={`segment-tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
          >
            Requests 
            {pendingContacts.length > 0 && <span style={{ background: 'var(--red)', color: 'white', padding: '2px 6px', borderRadius: 10, fontSize: 10, fontWeight: 'bold' }}>{pendingContacts.length}</span>}
          </button>
          <button 
            className={`segment-tab ${activeTab === 'blocked' ? 'active' : ''}`}
            onClick={() => setActiveTab('blocked')}
          >Blocked</button>
        </div>
      )}

      <div className="search-bar">
        <FiSearch size={15} color="var(--text-muted)" />
        <input
          placeholder={showSearch ? 'Search by username or ID...' : 'Search chats...'}
          value={searchQ}
          onChange={e => showSearch ? handleSearch(e.target.value) : setSearchQ(e.target.value)}
        />
      </div>

      <div className="panel-scroll">
        {activeTab === 'chats' && !showSearch && (
          <div style={{ paddingBottom: 8 }}>
            {archivedChats.length > 0 && (
              <div className="contact-item" onClick={() => setActiveTab('archived')} style={{ cursor: 'pointer', padding: '12px 16px' }}>
                <div className="contact-avatar" style={{ background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <FiArchive size={20} />
                </div>
                <div className="contact-info">
                  <div className="contact-name" style={{ fontWeight: 600 }}>Archived Chats</div>
                  <div className="contact-preview">{archivedChats.length} chat{archivedChats.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            )}
            {archivedChats.length > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '4px 16px' }} />}
          </div>
        )}

        {activeTab === 'archived' && (
           <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
             <button className="icon-btn" onClick={() => setActiveTab('chats')}><FiX size={18} /></button>
             <h3 style={{ margin: 0, fontSize: 16 }}>Archived Chats</h3>
           </div>
        )}

        {displayList.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {showSearch
              ? (searchQ.length < 2 ? 'Type to search for users' : (searching ? 'Searching...' : 'No users found'))
              : 'No conversations yet'
            }
          </div>
        )}

        {displayList.map(contact => {
          const isResult = showSearch && searchResults.includes(contact);
          const alreadyAdded = contacts.some(c => c._id === contact._id);
          return (
            <div
              key={contact._id}
              className={`contact-item ${activeContactId === contact._id ? 'active' : ''} ${pinnedChats.includes(contact._id) ? 'pinned' : ''}`}
              onClick={() => {
                if (activeTab === 'blocked') return;
                if (isResult && !alreadyAdded) addContact(contact);
                else if (activeTab !== 'requests' || isResult) {
                  if (lockedChats.includes(contact._id)) {
                    setShowLockModal({ action: 'open', contact });
                  } else {
                    onSelectContact(contact);
                  }
                }
              }}
              onContextMenu={(e) => {
                if (activeTab !== 'chats' || isResult) return;
                e.preventDefault();
                setContextMenu({ show: true, x: e.clientX, y: e.clientY, contact });
              }}
              style={{ cursor: (activeTab === 'requests' && !isResult) || activeTab === 'blocked' ? 'default' : 'pointer' }}
            >
              <div className="contact-avatar">
                {contact.avatar
                  ? <img src={contact.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                  : <AvatarFallback name={contact.username || contact.email} />
                }
                {isOnline(contact._id) && <span className="online-dot" />}
              </div>
              <div className="contact-info">
                <div className="contact-name">
                  {nicknames[contact._id] || contact.username || contact.email?.split('@')[0] || 'Unknown'}
                  {pinnedChats.includes(contact._id) && <span style={{ marginLeft: 6, fontSize: 10 }}>📌</span>}
                </div>
                <div className="contact-preview">
                  {isResult && !alreadyAdded
                    ? <span style={{ color: 'var(--accent)' }}>+ Add contact</span>
                    : `@${contact.uniqueId}`}
                </div>
              </div>
              {contact.unreadCount > 0 && !isResult && activeTab === 'chats' && (
                <div style={{ background: 'var(--accent)', color: 'white', fontSize: 11, fontWeight: 'bold', padding: '2px 7px', borderRadius: 10, alignSelf: 'center', marginLeft: 8 }}>
                  {contact.unreadCount}
                </div>
              )}
              {isResult && !alreadyAdded && (
                <FiUserPlus size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
              )}
              {!isResult && activeTab === 'requests' && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={(e) => handleAccept(e, contact)} style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Accept</button>
                  <button onClick={(e) => handleDecline(e, contact)} style={{ background: 'var(--bg-lighter)', color: 'var(--text-muted)', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Ignore</button>
                </div>
              )}
              {!isResult && activeTab === 'blocked' && (
                <button onClick={(e) => unblockContact(e, contact)} style={{ background: 'transparent', color: 'var(--green)', border: '1px solid var(--green)', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>Unblock</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Floating Action Button */}
      <div className="fab-container mobile-only">
        <button className="fab-button" onClick={() => setShowSearch(s => !s)}>
          {showSearch ? <FiX size={24} /> : <FiUserPlus size={24} />}
        </button>
      </div>

      {contextMenu.show && (
        <div 
          className="context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button className="context-menu-item" onClick={() => { onSelectContact(contextMenu.contact); /* Profile panel handles nickname */ setContextMenu({ ...contextMenu, show: false }); }}>
            <FiUser size={15} /> View Profile
          </button>
          <button className="context-menu-item" onClick={() => handleAction('pin', contextMenu.contact._id)}>
            <FiMapPin size={15} /> {pinnedChats.includes(contextMenu.contact._id) ? 'Unpin Chat' : 'Pin Chat'}
          </button>
          <button className="context-menu-item" onClick={() => {
            setContextMenu({ ...contextMenu, show: false });
            setShowLockModal({ action: 'toggle', contact: contextMenu.contact });
          }}>
            <FiLock size={15} /> {lockedChats.includes(contextMenu.contact._id) ? 'Unlock Chat' : 'Lock Chat'}
          </button>
          <button className="context-menu-item" onClick={() => handleAction('archive', contextMenu.contact._id)}>
            <FiArchive size={15} /> {archivedChats.includes(contextMenu.contact._id) ? 'Unarchive' : 'Archive Chat'}
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <button className="context-menu-item danger" onClick={() => { setContextMenu({ ...contextMenu, show: false }); setShowDeleteModal(contextMenu.contact); }}>
            <FiTrash2 size={15} /> Delete Chat
          </button>
        </div>
      )}

      {/* Modals */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 className="modal-title">Delete Chat</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
              Are you sure you want to delete your chat with <strong>{showDeleteModal.username || showDeleteModal.email}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowDeleteModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { deleteChat(showDeleteModal._id, false); setShowDeleteModal(null); }}>Delete for me</button>
              <button className="btn btn-danger" onClick={() => { deleteChat(showDeleteModal._id, true); setShowDeleteModal(null); }}>Delete for both</button>
            </div>
          </div>
        </div>
      )}

      {showLockModal && (
        <div className="modal-backdrop" onClick={() => { setShowLockModal(null); setLockPin(''); setLockError(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h3 className="modal-title">Enter Privacy PIN</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 13 }}>
              Please enter your 4-digit Privacy PIN to {showLockModal.action === 'open' ? 'open this chat' : 'toggle lock status'}. 
              <br /><br />
              <span style={{ fontSize: 11, opacity: 0.8 }}>If this is your first time, the PIN you enter will become your permanent Privacy PIN.</span>
            </p>
            <input 
              type="password" 
              className="input" 
              placeholder="••••" 
              maxLength={4}
              value={lockPin} 
              onChange={e => { setLockPin(e.target.value); setLockError(''); }}
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, marginBottom: 10 }}
              autoFocus
            />
            {lockError && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10, textAlign: 'center' }}>{lockError}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => { setShowLockModal(null); setLockPin(''); setLockError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                if (lockPin.length !== 4) return setLockError('PIN must be 4 digits');
                try {
                  const res = await authFetch(`${API}/api/users/verify-pin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: lockPin })
                  });
                  if (res.ok) {
                    if (showLockModal.action === 'open') {
                      onSelectContact(showLockModal.contact);
                    } else if (showLockModal.action === 'toggle') {
                      await handleAction('lock', showLockModal.contact._id);
                    }
                    setShowLockModal(null);
                    setLockPin('');
                    setLockError('');
                  } else {
                    const data = await res.json();
                    setLockError(data.message || 'Incorrect PIN');
                  }
                } catch { setLockError('Network error'); }
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
