import { FiMessageCircle, FiBook, FiUsers, FiCalendar, FiCheckSquare, FiShare2, FiSettings, FiLogOut, FiPhone, FiShoppingBag, FiPackage } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { id: 'chats',    icon: FiMessageCircle, label: 'Chats' },
  { id: 'groups',   icon: FiUsers,         label: 'Groups' },
  { id: 'stories',  icon: FiBook,          label: 'Stories' },
  { id: 'calls',    icon: FiPhone,         label: 'Calls' },
  { id: 'events',   icon: FiCalendar,      label: 'Events',  desktopOnly: true },
  { id: 'tasks',    icon: FiCheckSquare,   label: 'Tasks',   desktopOnly: true },
  { id: 'request',  icon: FiShare2,        label: 'Request', desktopOnly: true },
  { id: 'myorders', icon: FiPackage,       label: 'Orders' },
];

export default function Sidebar({ activeView, onViewChange, unread = {} }) {
  const { user, logout } = useAuth();

  const currentNav = user?.isBusiness
    ? [...NAV, { id: 'store', icon: FiShoppingBag, label: 'Store', desktopOnly: true }]
    : NAV;
  const initials = (user?.username || user?.email || 'U')[0].toUpperCase();

  return (
    <div className="icon-rail">
      <div className="rail-logo desktop-only" title="SilentTalk" onClick={() => onViewChange('chats')}>ST</div>

      {currentNav.map(({ id, icon: Icon, label, desktopOnly }) => (
        <button
          key={id}
          className={`rail-btn ${activeView === id ? 'active' : ''} ${desktopOnly ? 'desktop-only' : ''}`}
          title={label}
          onClick={() => onViewChange(id)}
        >
          <div className="rail-icon-wrapper">
            <Icon size={20} className="rail-icon" />
            {unread[id] > 0 && <span className="rail-badge">{unread[id] > 9 ? '9+' : unread[id]}</span>}
          </div>
          <span className="rail-label mobile-only">{label}</span>
        </button>
      ))}

      <div className="rail-spacer desktop-only" />

      <button className={`rail-btn ${activeView === 'settings' ? 'active' : ''}`} title="Settings" onClick={() => onViewChange('settings')}>
        <div className="rail-icon-wrapper">
          <FiSettings size={20} className="rail-icon" />
        </div>
        <span className="rail-label mobile-only">Settings</span>
      </button>

      {/* Logout — shown on both desktop and mobile */}
      <button className="rail-btn" title="Logout" onClick={logout} style={{ color: 'var(--text-muted)' }}>
        <div className="rail-icon-wrapper">
          <FiLogOut size={19} className="rail-icon" />
        </div>
        <span className="rail-label mobile-only">Logout</span>
      </button>

      <div className="desktop-only" style={{ marginTop: 4 }}>
        {user?.avatar
          ? <img className="rail-avatar" src={user.avatar} alt="" onClick={() => onViewChange('settings')} />
          : <div
              className="rail-avatar"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, cursor: 'pointer', borderRadius: '50%', width: 36, height: 36 }}
              onClick={() => onViewChange('settings')}
            >{initials}</div>
        }
      </div>
    </div>
  );
}
