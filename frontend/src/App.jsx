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

  // Beta modal — show once on first login ever
  const [showBetaModal, setShowBetaModal] = useState(() => {
    return !localStorage.getItem('st_beta_seen');
  });

  const dismissBeta = () => {
    localStorage.setItem('st_beta_seen', '1');
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

    window.addEventListener('chat-metadata-updated', loadData);
    return () => window.removeEventListener('chat-metadata-updated', loadData);
  }, [user]);

  // Incoming call listener
  useEffect(() => {
    if (!user) return;
    const handleIncomingCall = async (data) => {
      // Check if blocked
      if (blockedUsers.some(b => (b._id || b)?.toString() === data.from?.toString())) {
        // Automatically reject
        emit('call:reject', { to: data.from });
        return;
      }
      try {
        const res = await fetch(`${API}/api/users/profile/${data.from}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('st_token')}` }
        });
        if (res.ok) {
          const contact = await res.json();
          setActiveCall({ contact, callType: data.callType, incoming: true, offer: data.offer });
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
          onEnd={() => setActiveCall(null)}
        />
      )}

      {/* ── Beta Warning Modal (first login only) ───────────────────────── */}
      {showBetaModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
          animation: 'fadeIn 0.4s ease'
        }}>
          <style>{`
            @keyframes betaShieldPop {
              0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
              60%  { transform: scale(1.15) rotate(5deg); }
              80%  { transform: scale(0.95) rotate(-3deg); }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes betaCardIn {
              0%   { transform: translateY(50px) scale(0.96); opacity: 0; }
              100% { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes betaPulseRing {
              0%   { transform: scale(0.8); opacity: 0; }
              60%  { opacity: 0.25; }
              100% { transform: scale(2.4); opacity: 0; }
            }
            @keyframes betaTagBounce {
              0%, 100% { transform: translateY(0); }
              50%       { transform: translateY(-4px); }
            }
          `}</style>

          <div style={{
            background: 'linear-gradient(160deg, #1a1d2e 0%, #13161e 100%)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 28,
            padding: '48px 40px 36px',
            maxWidth: 460, width: '100%',
            textAlign: 'center',
            boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.1)',
            animation: 'betaCardIn 0.55s cubic-bezier(0.34,1.56,0.64,1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Ambient top glow */}
            <div style={{
              position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
              width: 280, height: 280,
              background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />

            {/* Pulsing rings */}
            <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {[0.3, 0.6].map((delay, i) => (
                <div key={i} style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '2px solid rgba(245,158,11,0.35)',
                  animation: `betaPulseRing 2.2s ease-out infinite`,
                  animationDelay: `${delay}s`
                }} />
              ))}
              {/* Shield icon center */}
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08))',
                border: '2px solid rgba(245,158,11,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(245,158,11,0.3)',
                animation: 'betaShieldPop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.15s both'
              }}>
                <FiShield size={32} color="#f59e0b" />
              </div>
            </div>

            {/* BETA tag */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 900,
              letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase',
              animation: 'betaTagBounce 2s ease-in-out infinite'
            }}>
              <FiZap size={11} /> Beta Version
            </div>

            <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 900, color: '#f0f2ff', lineHeight: 1.2 }}>
              Welcome to SilentTalk
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: 14, color: '#9ba3c0', lineHeight: 1.7 }}>
              This platform is currently in <strong style={{ color: '#fbbf24' }}>public beta</strong> and built for educational exploration of encrypted messaging, e-commerce, and productivity tools.
            </p>

            {/* Warning cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, textAlign: 'left' }}>
              {[
                { icon: FiAlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: 'Not intended for production or commercial use at this stage.' },
                { icon: FiShield, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', text: 'All messages are end-to-end encrypted — the server cannot read your chats.' },
                { icon: FiZap, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)', text: 'Features may change, reset, or be unavailable during beta development.' },
              ].map(({ icon: Icon, color, bg, border, text }, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  background: bg, border: `1px solid ${border}`,
                  borderRadius: 12, padding: '12px 14px'
                }}>
                  <Icon size={16} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#9ba3c0', lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Policies blurb */}
            <p style={{ margin: '0 0 24px', fontSize: 12, color: '#5a6280', lineHeight: 1.6 }}>
              By continuing you acknowledge this is a <strong style={{ color: '#9ba3c0' }}>demonstration platform</strong>. Do not store sensitive personal, financial, or confidential information.
            </p>

            <button
              onClick={dismissBeta}
              style={{
                width: '100%', padding: '15px 20px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#000', fontWeight: 800, fontSize: 15, letterSpacing: 0.3,
                borderRadius: 14, cursor: 'pointer',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 8px 24px rgba(245,158,11,0.4)',
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform='scale(1.02)'; e.currentTarget.style.boxShadow='0 10px 30px rgba(245,158,11,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(245,158,11,0.4)'; }}
            >
              I Understand — Let Me In <FiArrowRight size={17} />
            </button>
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
