import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import Stories from './components/Stories';
import Groups from './components/Groups';
import Events from './components/Events';
import Tasks from './components/Tasks';
import RequestChatPanel from './components/RequestChatPanel';
import Settings from './components/Settings';
import CallModal from './components/CallModal';
import LandingPage from './components/LandingPage';
import Calls from './components/Calls';
import StoreManager from './components/StoreManager';
import BuyerOrders from './components/BuyerOrders';
import {
  FiBook, FiUsers, FiCalendar, FiCheckSquare, FiShare2, FiPhone,
  FiLock, FiUsers as FiUsersIcon, FiShield, FiAlertTriangle, FiArrowRight, FiZap
} from 'react-icons/fi';
import './index.css';

function AppInner() {
  const { user, loading, authFetch, API, updateUser } = useAuth();
  const [activeView, setActiveView] = useState('chats');
  const [activeContact, setActiveContact] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [globalUnread, setGlobalUnread] = useState({});

  // Wallpapers: { [contactId | 'global']: imageUrl | gradient }
  const [wallpapers, setWallpapers] = useState({});
  const [dimLevel, setDimLevel] = useState(() => parseFloat(localStorage.getItem('st_wallpaper_dim') || '0.4'));
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [nicknames, setNicknames] = useState({});

  // Beta modal — show every session until user explicitly dismisses this specific version
  const [showBetaModal, setShowBetaModal] = useState(() => {
    return localStorage.getItem('st_beta_seen') !== 'v2.6';
  });

  const dismissBeta = () => {
    localStorage.setItem('st_beta_seen', 'v2.6');
    setShowBetaModal(false);
  };

  const { on, off, emit } = useSocket();

  // Sync public key if missing
  useEffect(() => {
    if (user && !user.publicKey) {
      const syncKey = async () => {
        try {
          const publicKey = (await import('./lib/crypto')).exportPublicKey();
          const res = await authFetch(`${API}/api/auth/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicKey })
          });
          if (res.ok) {
            const data = await res.json();
            updateUser(data.user);
          }
        } catch (err) {
          console.error('Failed to sync E2EE key:', err);
        }
      };
      syncKey();
    }
  }, [user, updateUser, authFetch, API]);

  // Load wallpapers & blocked users on mount
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const [wpRes, blRes] = await Promise.all([
          authFetch(`${API}/api/users/wallpaper`),
          authFetch(`${API}/api/users/blocked`)
        ]);
        if (wpRes.ok) {
          const { wallpapers: wp } = await wpRes.json();
          setWallpapers(wp || {});
        }
        if (blRes.ok) {
          const { blockedUsers: bl } = await blRes.json();
          setBlockedUsers(bl || []);
        }

        const nickRes = await authFetch(`${API}/api/users/nicknames`);
        if (nickRes.ok) {
          const nData = await nickRes.json();
          setNicknames(nData.nicknames || {});
        }
      } catch {}
    };
    loadData();

    // Fetch and join group rooms for global notifications
    const joinGroups = async () => {
      try {
        const res = await authFetch(`${API}/api/groups`);
        if (res.ok) {
          const groups = await res.json();
          if (groups && groups.length > 0) {
            emit('join:groups', groups.map(g => g._id));
          }
        }
      } catch {}
    };
    joinGroups();

    window.addEventListener('chat-metadata-updated', loadData);
    return () => window.removeEventListener('chat-metadata-updated', loadData);
  }, [user, API, authFetch, emit]);

  // Incoming call listener
  useEffect(() => {
    if (!user) return;
    const handleIncomingCall = async (data) => {
      // Check if blocked
      if (!data.groupId && blockedUsers.some(b => (b._id || b)?.toString() === data.from?.toString())) {
        // Automatically reject
        emit('call:reject', { to: data.from });
        return;
      }
      try {
        if (data.groupId) {
          const res = await fetch(`${API}/api/groups/${data.groupId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('st_token')}` }
          });
          if (res.ok) {
            const group = await res.json();
            group.isGroup = true;
            setActiveCall({ contact: group, callType: data.callType, incoming: true, offer: data.offer, roomName: data.roomName });
          }
        } else {
          const res = await fetch(`${API}/api/users/profile/${data.from}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('st_token')}` }
          });
          if (res.ok) {
            const contact = await res.json();
            setActiveCall({ contact, callType: data.callType, incoming: true, offer: data.offer, roomName: data.roomName });
          }
        }
      } catch {}
    };
    on('call:incoming', handleIncomingCall);
    return () => off('call:incoming', handleIncomingCall);
  }, [user, on, off, blockedUsers, emit]);

  // Notifications and Unread Handling
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const handleReceive = (data) => {
      // Don't notify for our own messages
      if (data.senderId === user._id) return;
      
      const contactId = data.groupId || data.senderId;
      const isChatActive = activeContact?._id === contactId;
      
      // Notify if chat is not open or document is hidden
      if (!isChatActive || document.hidden) {
        if ("Notification" in window && Notification.permission === "granted" && user.settings?.notifications !== false) {
          try {
            new Notification(data.groupId ? "New Group Message" : "New Message", {
              body: "You received a new secure message.",
              icon: "/vite.svg"
            });
            // Try to play sound (might be blocked by browser without interaction)
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => {});
          } catch(e) {}
        }
      }
    };
    on('message:receive', handleReceive);
    return () => off('message:receive', handleReceive);
  }, [user, activeContact, on, off]);

  // ── Order Socket Notifications ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    
    const handleSaasReady = (data) => {
      // Show a persistent in-app toast for SaaS access ready
      const toast = document.createElement('div');
      toast.id = 'saas-ready-toast';
      toast.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:99999;
        background:linear-gradient(135deg,#3b82f6,#6366f1);
        color:#fff;padding:16px 20px;border-radius:16px;
        box-shadow:0 8px 32px rgba(99,102,241,0.5);
        max-width:320px;cursor:pointer;
        animation:slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);
        font-family:var(--font-body);
      `;
      toast.innerHTML = `
        <div style="font-weight:800;font-size:15px;margin-bottom:6px;">☁️ SaaS Access Ready!</div>
        <div style="font-size:13px;opacity:0.9;margin-bottom:10px;">${data.productName} — your access has been approved!</div>
        <div style="font-size:12px;background:rgba(255,255,255,0.15);padding:6px 12px;border-radius:8px;font-weight:700;">
          👆 Tap to view in My Orders
        </div>
      `;
      toast.onclick = () => { setActiveView('myorders'); document.body.removeChild(toast); };
      document.body.appendChild(toast);
      setTimeout(() => { if (document.body.contains(toast)) document.body.removeChild(toast); }, 12000);
    };

    const handleStatusUpdate = (data) => {
      if (data.status === 'Accepted' || data.status === 'Out for Delivery' || data.status === 'Completed') {
        const icons = { Accepted: '✅', 'Out for Delivery': '🚚', Completed: '🎉' };
        const msgs = { Accepted: 'Order accepted!', 'Out for Delivery': 'Your order is on its way!', Completed: 'Order delivered!' };
        const toast = document.createElement('div');
        toast.style.cssText = `
          position:fixed;bottom:24px;right:24px;z-index:99999;
          background:var(--bg-elevated);border:1px solid var(--border);
          color:var(--text);padding:14px 18px;border-radius:14px;
          box-shadow:var(--shadow-lg);max-width:280px;cursor:pointer;
          animation:slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);
          font-family:var(--font-body);
        `;
        toast.innerHTML = `
          <div style="font-weight:700;font-size:14px;">${icons[data.status]} ${msgs[data.status]}</div>
          <div style="font-size:12px;color:#9ba3c0;margin-top:4px;">${data.productName}</div>
        `;
        toast.onclick = () => { setActiveView('myorders'); if (document.body.contains(toast)) document.body.removeChild(toast); };
        document.body.appendChild(toast);
        setTimeout(() => { if (document.body.contains(toast)) document.body.removeChild(toast); }, 6000);
      }
    };

    on('order:saas_ready', handleSaasReady);
    on('order:status_update', handleStatusUpdate);
    return () => { off('order:saas_ready', handleSaasReady); off('order:status_update', handleStatusUpdate); };
  }, [user, on, off]);

  const handleWallpaperChange = (key, imageUrl) => {
    setWallpapers(prev => ({ ...prev, [key]: imageUrl }));
  };

  // SEO: Dynamic Titles
  useEffect(() => {
    const defaultTitle = "SilentTalk - Encrypted Secure Messaging";
    const viewNames = {
      chats: activeContact ? `Chat with ${activeContact.username || activeContact.name}` : "Chats",
      tasks: "Tasks",
      events: "Events",
      stories: "Stories",
      calls: "Calls",
      settings: "Settings",
      request: "Message Requests",
      store: "Store Manager"
    };

    const currentTitle = viewNames[activeView] || "Home";
    document.title = `${currentTitle} | SilentTalk`;
    
    return () => { document.title = defaultTitle; };
  }, [activeView, activeContact]);

  useEffect(() => {
    const syncDim = () => {
      setDimLevel(parseFloat(localStorage.getItem('st_wallpaper_dim') || '0.4'));
    };
    window.addEventListener('wallpaper-dim-changed', syncDim);
    return () => window.removeEventListener('wallpaper-dim-changed', syncDim);
  }, []);

  useEffect(() => {
    const handleProfileUpdate = ({ userId, avatar }) => {
      if (activeContact?._id === userId) {
        setActiveContact(prev => ({ ...prev, avatar }));
      }
    };
    on('user:profile_updated', handleProfileUpdate);
    return () => off('user:profile_updated', handleProfileUpdate);
  }, [activeContact, on, off]);

  const handleBlockChange = (contactId, action) => {
    if (action === 'block') {
      setBlockedUsers(prev => [...prev, { _id: contactId }]);
    } else {
      setBlockedUsers(prev => prev.filter(b => (b._id || b) !== contactId));
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ marginBottom: 12, color: 'var(--accent)', display: 'flex', justifyContent: 'center' }}>
            <FiLock size={36} />
          </div>
          <div>Loading SilentTalk…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    const isLogin = window.location.search.includes('type=');
    if (!isLogin && window.location.pathname === '/') {
      return <LandingPage onGoToLogin={(type) => { window.location.search = `?type=${type}`; }} />;
    }
    return <Login type={new URLSearchParams(window.location.search).get('type') || 'normal'} />;
  }

  // Full-width views collapse the middle panel column entirely
  const FULL_WIDTH_VIEWS = ['tasks', 'events', 'stories', 'store', 'myorders'];
  const isFullWidth = FULL_WIDTH_VIEWS.includes(activeView);
  const isSettings  = activeView === 'settings';

  const renderPanel = () => {
    if (isFullWidth) return null; // No panel rendered at all for full-width views
    switch (activeView) {
      case 'groups':   return <Groups onSelectGroup={g => { setActiveContact({...g, isGroup: true}); setActiveView('chats'); }} />;
      case 'request':  return <RequestChatPanel />;
      case 'calls':    return <Calls />;
      case 'settings': return <Settings wallpapers={wallpapers} onWallpaperChange={handleWallpaperChange} />;
      default: return (
        <ChatList
          activeContactId={activeContact?._id}
          onSelectContact={c => { setActiveContact(c); setActiveView('chats'); }}
          blockedUsers={blockedUsers}
          onBlockChange={handleBlockChange}
          onUnreadChange={setGlobalUnread}
          nicknames={nicknames}
        />
      );
    }
  };

  const renderMain = () => {
    if (isSettings) return null;
    const goBack = () => setActiveView('chats');
    if (activeView === 'tasks')    return <Tasks onBack={goBack} />;
    if (activeView === 'events')   return <Events onBack={goBack} />;
    if (activeView === 'stories')  return <Stories onBack={goBack} />;
    if (activeView === 'store')    return <StoreManager onBack={goBack} />;
    if (activeView === 'myorders') return <BuyerOrders onBack={goBack} />;

    const ICONS = {
      groups:  <FiUsers size={28} color="var(--accent)" />,
      request: <FiShare2 size={28} color="var(--accent)" />,
      calls:   <FiPhone size={28} color="var(--accent)" />
    };
    const NAMES = { groups:'Groups', request:'Request Chat', calls:'Calls' };
    if (activeView !== 'chats') return (
      <div className="chat-window hidden-on-mobile" style={{ gridColumn: '3 / 4' }}>
        <div className="empty-state">
          <div className="empty-state-icon">{ICONS[activeView]}</div>
          <h3>{NAMES[activeView]}</h3>
          <p>Use the panel on the left to manage your {NAMES[activeView]?.toLowerCase()}.</p>
        </div>
      </div>
    );
    return (
      <ChatWindow
        contact={activeContact}
        isGroup={activeContact?.isGroup}
        onStartCall={(contact, callType) => {
          if (callType === 'close') setActiveContact(null);
          else setActiveCall({ contact, callType, incoming: false });
        }}
        wallpapers={wallpapers}
        dimLevel={dimLevel}
        onWallpaperChange={handleWallpaperChange}
        blockedUsers={blockedUsers}
        onBlockChange={handleBlockChange}
        nicknames={nicknames}
      />
    );
  };

  const globalWallpaper = wallpapers['global'];
  const chatWallpaper = activeContact ? wallpapers[activeContact._id] : null;
  const hasGlobalWP = !!globalWallpaper;
  const showGlobalOverlay = hasGlobalWP && !chatWallpaper;

  // Grid layout:
  //  normal:      64px | 320px | 1fr
  //  full-width:  64px | 0     | 1fr  (tasks/events/stories take the whole right side)
  //  settings:    64px | 0     | 1fr  (settings fills everything)
  const gridColumns = (isFullWidth || isSettings)
    ? '64px 0px 1fr'
    : '64px 320px 1fr';

  return (
    <div
      className={`app-shell ${hasGlobalWP ? 'has-wallpaper' : ''} ${chatWallpaper ? 'has-chat-wallpaper-active' : ''}`}
      style={{
        '--wallpaper-url': globalWallpaper?.startsWith('http') ? `url(${globalWallpaper})` : globalWallpaper,
        '--wallpaper-dim': dimLevel,
        gridTemplateColumns: gridColumns,
      }}
    >
      {showGlobalOverlay && <div className="app-shell-overlay" />}

      <Sidebar
        activeView={activeView}
        onViewChange={(v) => { setActiveView(v); if (v !== 'chats') setActiveContact(null); }}
        unread={{ chats: Object.values(globalUnread).reduce((sum, val) => sum + val, 0) }}
      />

      {/* Middle column — hidden for full-width and settings views */}
      {!isFullWidth && !isSettings && renderPanel()}
      {(isFullWidth || isSettings) && <div style={{ width: 0, overflow: 'hidden' }} />}

      {/* Main/right column */}
      {isSettings
        ? <Settings wallpapers={wallpapers} onWallpaperChange={handleWallpaperChange} onViewChange={setActiveView} />
        : isFullWidth
          ? <div className="chat-window feature-fullwidth" style={{ gridColumn: '3 / 4' }}>{renderMain()}</div>
          : renderMain()
      }

      {/* Active call overlay */}
      {activeCall && (
        <CallModal
          contact={activeCall.contact}
          callType={activeCall.callType}
          incoming={activeCall.incoming}
          incomingOffer={activeCall.offer}
          incomingRoomName={activeCall.roomName}
          onEnd={() => setActiveCall(null)}
        />
      )}

      {/* ── Beta Warning Modal ───────────────────────────────────────────── */}
      {showBetaModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'fadeIn 0.3s ease'
        }}>
          <style>{`
            @keyframes betaSlideUp {
              0%   { transform: translateY(100%); opacity: 0; }
              100% { transform: translateY(0); opacity: 1; }
            }
            @keyframes betaPulseRing {
              0%   { transform: scale(0.8); opacity: 0; }
              60%  { opacity: 0.25; }
              100% { transform: scale(2.4); opacity: 0; }
            }
            @keyframes betaTagBounce {
              0%, 100% { transform: translateY(0); }
              50%       { transform: translateY(-3px); }
            }
          `}</style>

          <div style={{
            background: 'linear-gradient(160deg, #1a1d2e 0%, #13161e 100%)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: '24px 24px 0 0',
            width: '100%', maxWidth: 500,
            maxHeight: '90dvh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
            animation: 'betaSlideUp 0.45s cubic-bezier(0.34,1.56,0.64,1)',
          }}>

            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: 40, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.15)' }} />
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: 'auto', padding: '16px 24px 8px', flex: 1 }}>

              {/* Icon + heading row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {[0.3, 0.65].map((d, i) => (
                    <div key={i} style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      border: '1.5px solid rgba(245,158,11,0.35)',
                      animation: 'betaPulseRing 2.2s ease-out infinite',
                      animationDelay: `${d}s`
                    }} />
                  ))}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'rgba(245,158,11,0.15)',
                    border: '1.5px solid rgba(245,158,11,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(245,158,11,0.25)'
                  }}>
                    <FiShield size={22} color="#f59e0b" />
                  </div>
                </div>
                <div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 20, padding: '2px 10px', fontSize: 9.5, fontWeight: 900,
                    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5,
                    animation: 'betaTagBounce 2s ease-in-out infinite'
                  }}>
                    <FiZap size={9} /> Beta
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#f0f2ff', lineHeight: 1.2 }}>
                    Welcome to SilentTalk
                  </div>
                </div>
              </div>

              {/* Body text */}
              <p style={{ margin: '0 0 14px', fontSize: 13, color: '#9ba3c0', lineHeight: 1.6 }}>
                We upgraded our E2EE encryption engine. Some users may have been{' '}
                <strong style={{ color: '#f472b6' }}>logged out</strong> or see{' '}
                <strong style={{ color: '#f472b6' }}>[Encrypted message]</strong>.{' '}
                Simply log back in — your account is safe.
              </p>

              {/* Compact bullet list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {[
                  { icon: FiAlertTriangle, color: '#f59e0b', text: 'Forced logout is due to the new cross-device key sync — log in again to fix.' },
                  { icon: FiShield, color: '#3b82f6', text: 'Old session messages may stay locked. All new messages decrypt correctly.' },
                  { icon: FiZap, color: '#8b5cf6', text: 'Developer is not responsible for beta-phase disruptions.' },
                ].map(({ icon: Icon, color, text }, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <Icon size={13} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#9ba3c0', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>

              {/* Report row */}
              <div style={{
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10, padding: '9px 12px', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <FiAlertTriangle size={12} color="#ef4444" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#9ba3c0', lineHeight: 1.5 }}>
                  Suspicious activity? Email{' '}
                  <a href="mailto:krishnatrishan085@gmail.com" style={{ color: '#f472b6', fontWeight: 700, textDecoration: 'none' }}>
                    krishnatrishan085@gmail.com
                  </a>
                </span>
              </div>

              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#4a5070', lineHeight: 1.5 }}>
                Beta platform — do not store sensitive personal or financial information.
              </p>
            </div>

            {/* Sticky CTA — always visible */}
            <div style={{ padding: '12px 24px 24px', flexShrink: 0 }}>
              <button
                onClick={dismissBeta}
                style={{
                  width: '100%', padding: '14px 20px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#000', fontWeight: 800, fontSize: 14, letterSpacing: 0.3,
                  borderRadius: 14, cursor: 'pointer', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 6px 20px rgba(245,158,11,0.4)',
                  transition: 'opacity 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                I Understand — Let Me In <FiArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ThemeProvider>
          <AppInner />
        </ThemeProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
