import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FiPhone, FiVideo, FiMoreVertical, FiSend, FiPaperclip, FiSmile, FiMic,
  FiCornerUpLeft, FiTrash2, FiCheck, FiX, FiSearch, FiImage, FiSlash,
  FiUserMinus, FiImage as FiWallpaper, FiChevronUp, FiChevronDown,
  FiStopCircle, FiPlay, FiPause, FiFile, FiCalendar, FiCheckSquare, FiUser, FiShoppingBag,
  FiPackage, FiTruck, FiStar, FiExternalLink, FiAlertCircle, FiClock,
  FiMapPin, FiLock, FiArchive
} from 'react-icons/fi';
import { BsCheckAll } from 'react-icons/bs';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { encryptMessage, decryptMessage } from '../lib/crypto';
import UserProfilePanel from './UserProfilePanel';
import WallpaperPicker from './WallpaperPicker';
import AudioPlayer from './AudioPlayer';
import AttachmentMenu from './AttachmentMenu';
import SharedItemPicker from './SharedItemPicker';
import StoreFront from './StoreFront';

const EMOJIS = ['thumbup','heart','laugh','wow','cry','fire','clap','party'];
const EMOJI_CHARS = { thumbup:'👍', heart:'❤️', laugh:'😂', wow:'😮', cry:'😢', fire:'🔥', clap:'👏', party:'🎉' };

// Fix malformed URLs (missing colon)
const fixUrl = (url) => {
  if (!url) return '';
  let fixed = url;
  if (fixed.startsWith('https//')) fixed = fixed.replace('https//', 'https://');
  if (fixed.startsWith('http//')) fixed = fixed.replace('http//', 'http://');
  return fixed;
};

// ── Order Status Config ────────────────────────────────────────────────────
const ORDER_STATUS_CONF = {
  Accepted:         { icon: FiCheck,        color: '#3b82f6', glow: 'rgba(59,130,246,0.4)',  label: 'Accepted'         },
  Packaging:        { icon: FiPackage,      color: '#8b5cf6', glow: 'rgba(139,92,246,0.4)', label: 'Packaging'        },
  'Out for Delivery':{ icon: FiTruck,       color: '#06b6d4', glow: 'rgba(6,182,212,0.4)',  label: 'Out for Delivery' },
  Completed:        { icon: FiStar,         color: '#22c55e', glow: 'rgba(34,197,94,0.4)',  label: 'Delivered!'       },
  Rejected:         { icon: FiAlertCircle,  color: '#ef4444', glow: 'rgba(239,68,68,0.4)',  label: 'Rejected'         },
};
const PHYS_PIPELINE = ['Accepted','Packaging','Out for Delivery','Completed'];
const DIG_PIPELINE  = ['Accepted','Completed'];

function OrderUpdateCard({ orderData: raw }) {
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return null; }
  if (!data) return null;

  const { status, productName, productImg, total, sellerName, isDigital, saasLink, orderRef } = data;
  const conf = ORDER_STATUS_CONF[status] || ORDER_STATUS_CONF['Accepted'];
  const StatusIcon = conf.icon;
  const pipeline = isDigital ? DIG_PIPELINE : PHYS_PIPELINE;
  const currentIdx = pipeline.indexOf(status);
  const isRejected = status === 'Rejected';

  return (
    <div style={{
      background: 'linear-gradient(160deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)',
      border: `1px solid ${conf.color}33`,
      borderRadius: 18,
      overflow: 'hidden',
      width: 285,
      boxShadow: `0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 ${conf.color}22`,
      animation: 'slideUpCard 0.4s cubic-bezier(0.34,1.56,0.64,1)'
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${conf.color}20, ${conf.color}08)`,
        borderBottom: `1px solid ${conf.color}22`,
        padding: '14px 16px',
        display: 'flex', gap: 12, alignItems: 'center'
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: `${conf.color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 16px ${conf.glow}, inset 0 1px 0 ${conf.color}33`
        }}>
          <StatusIcon size={20} color={conf.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
            Order Update
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {productName}
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 20,
          background: `${conf.color}18`, color: conf.color,
          fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0,
          border: `1px solid ${conf.color}33`
        }}>
          {conf.label}
        </div>
      </div>

      {/* Product row */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
        {productImg ? (
          <img src={productImg} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${conf.color}33` }} />
        ) : (
          <div style={{ width: 46, height: 46, borderRadius: 10, background: 'var(--bg-hover)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiPackage size={18} color="var(--text-muted)" />
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            From <strong style={{ color: 'var(--text-secondary)' }}>{sellerName}</strong>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: conf.color, marginTop: 2 }}>${total}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>#{orderRef}</div>
        </div>
      </div>

      {/* Progress tracker — physical, non-rejected only */}
      {!isRejected && !isDigital && (
        <div style={{ padding: '4px 16px 10px', display: 'flex', alignItems: 'flex-start' }}>
          {pipeline.map((step, i) => {
            const done = i <= currentIdx;
            const cur = i === currentIdx;
            const stepConf = ORDER_STATUS_CONF[step] || conf;
            const StepIcon = stepConf.icon;
            return (
              <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: done ? stepConf.color : 'var(--bg-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: '0.35s', border: `2px solid ${done ? stepConf.color : 'var(--border)'}`,
                    boxShadow: cur ? `0 0 14px ${stepConf.glow}` : 'none'
                  }}>
                    <StepIcon size={11} color={done ? '#fff' : 'var(--text-muted)'} />
                  </div>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginTop: 4, color: done ? stepConf.color : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: 48 }}>
                    {step}
                  </div>
                </div>
                {i < pipeline.length - 1 && (
                  <div style={{ height: 2, flex: 1, marginBottom: 20, marginLeft: 2, marginRight: 2, background: done && i < currentIdx ? conf.color : 'var(--border)', transition: '0.5s', borderRadius: 2 }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Digital — accepted note */}
      {!isRejected && isDigital && status === 'Accepted' && (
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiClock size={13} color="#3b82f6" />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Seller is processing your access. A link will appear here once ready.
          </div>
        </div>
      )}

      {/* Rejected notice */}
      {isRejected && (
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <FiAlertCircle size={15} color="#ef4444" style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            This order was not fulfilled. Please contact the seller for alternatives or a refund.
          </div>
        </div>
      )}

      {/* SaaS access button */}
      {status === 'Completed' && isDigital && saasLink && (
        <div style={{ padding: '4px 16px 12px' }}>
          <a href={saasLink} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 0', borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(99,102,241,0.4)'
          }}>
            <FiExternalLink size={14} /> Access Your App
          </a>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        background: `${conf.color}08`,
        borderTop: `1px solid ${conf.color}18`,
        display: 'flex', alignItems: 'center', gap: 5
      }}>
        <FiClock size={10} color="var(--text-muted)" />
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 500 }}>
          Auto-updates with every order status change
        </div>
      </div>

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
              <button className="btn btn-primary" onClick={async () => {
                try {
                  await authFetch(`${API}/api/users/contacts/${showDeleteModal._id}?bothSides=false`, { method: 'DELETE' });
                  window.dispatchEvent(new Event('chat-metadata-updated'));
                  window.location.reload(); // Refresh to clear active chat state
                } catch (err) { alert(err.message); }
              }}>Delete for me</button>
              <button className="btn btn-danger" onClick={async () => {
                try {
                  await authFetch(`${API}/api/users/contacts/${showDeleteModal._id}?bothSides=true`, { method: 'DELETE' });
                  window.dispatchEvent(new Event('chat-metadata-updated'));
                  window.location.reload(); // Refresh to clear active chat state
                } catch (err) { alert(err.message); }
              }}>Delete for both</button>
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
                    if (showLockModal.action === 'toggle') {
                      await authFetch(`${API}/api/users/lock/${showLockModal.contact._id}`, { method: 'PUT' });
                      window.dispatchEvent(new Event('chat-metadata-updated'));
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


function AvatarFallback({ name, size = 36 }) {
  return (
    <div className="avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === 'read') return <BsCheckAll size={14} color="#34B7F1" />;
  if (status === 'delivered') return <BsCheckAll size={14} color="var(--text-muted)" />;
  return <FiCheck size={14} color="var(--text-muted)" />;
}

function highlightText(text, query) {
  if (!query || !text) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 3, padding: '0 2px' }}>{part}</mark>
      : part
  );
}

export default function ChatWindow({ contact, isGroup, onStartCall, wallpapers, dimLevel, onWallpaperChange, blockedUsers, onBlockChange, nicknames = {} }) {
  const { user, authFetch, API } = useAuth();
  const { on, off, emit, socket } = useSocket();

  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState('');
  const [contactTyping, setContactTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [emojiTarget, setEmojiTarget] = useState(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [contactPK, setContactPK] = useState('');

  // UI state
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showStoreFront, setShowStoreFront] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [viewMedia, setViewMedia] = useState(null);
  const [matchIndices, setMatchIndices] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showLockModal, setShowLockModal] = useState(null);
  const [lockPin, setLockPin] = useState('');
  const [lockError, setLockError] = useState('');

  // Media upload state
  const [mediaPreviews, setMediaPreviews] = useState([]); // [{ file, objectUrl, mediaType }]
  const [captionInput, setCaptionInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Sharing state
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [sharingType, setSharingType] = useState('event');
  const [storeTargetId, setStoreTargetId] = useState(null);

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const messagesEndRef = useRef(null);
  const typingTimer = useRef(null);
  const typingState = useRef(false);
  const fileInputRef = useRef();
  const searchInputRef = useRef();
  const messageRefs = useRef({});
  const moreMenuTriggerRef = useRef();
  const [moreMenuPos, setMoreMenuPos] = useState({ top: 0, left: 0 });

  const contactId = contact?._id;

  // Determine current wallpaper
  const chatWallpaper = wallpapers?.[contactId] || wallpapers?.['global'] || '';

  // Fetch messages + public key
  useEffect(() => {
    if (!contact) return;
    setMessages([]);
    setShowSearch(false);
    setSearchQuery('');
    const initConv = async () => {
      setLoadingMsgs(true);
      try {
        if (!isGroup) {
          const pkRes = await authFetch(`${API}/api/users/${contact._id}/publicKey`);
          if (pkRes.ok) {
            const { publicKey } = await pkRes.json();
            setContactPK(publicKey);
          }
        }
        const msgRes = await authFetch(`${API}/api/messages/${isGroup ? 'group/' : ''}${contact._id}`);
        if (msgRes.ok) {
          const data = await msgRes.json();
          setMessages(data);
          
          // Mark all fetched unread messages as read locally
          const processed = data.map(m => {
            const isIncoming = m.senderId?._id !== user?._id && m.senderId !== user?._id;
            if (isIncoming && m.status !== 'read') {
              return { ...m, status: 'read' };
            }
            return m;
          });
          setMessages(processed);
          
          // Notify server to mark all as read in DB
          if (!isGroup) {
            emit('message:read_all', { contactId: contact._id });
          }
        }
      } finally {
        setLoadingMsgs(false);
      }
    };
    initConv();
  }, [contact?._id, isGroup]);

  // Scroll to bottom
  useEffect(() => {
    if (!showSearch) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showSearch]);

  // Socket listeners
  useEffect(() => {
    if (!contact) return;
    if (isGroup) {
      emit('join:groups', [contact._id]);
    }

    const handleIncoming = (data) => {
      if ((isGroup && data.groupId === contact._id) || (!isGroup && (data.senderId === contact._id || data.receiverId === contact._id))) {
        setMessages(prev => {
          const exists = prev.some(m => m._id === data.messageId || m.tempId === data.tempId);
          if (exists) return prev;
          return [...prev, {
            ...data,
            senderId: data.senderObj || data.senderId,
            status: 'read', // Marked read locally because chat is open
            _id: data.messageId || data.tempId,
            createdAt: new Date().toISOString()
          }];
        });
        if (data.messageId) {
          emit('message:delivered', { senderId: data.senderId, messageId: data.messageId });
          emit('message:read', { senderId: data.senderId, messageId: data.messageId });
        }
      }
    };

    const handleStatus = ({ messageId, status }) => {
      setMessages(prev => prev.map(m => {
        if (m._id !== messageId && m.tempId !== messageId) return m;
        const ranks = { sending: 0, sent: 1, delivered: 2, read: 3 };
        if (ranks[status] < ranks[m.status]) return m;
        return { ...m, status };
      }));
    };

    const handleConfirmed = ({ tempId, messageId, senderId }) => {
      setMessages(prev => prev.map(m => (m._id === tempId || m.tempId === tempId) ? { ...m, _id: messageId } : m));
      emit('message:delivered', { senderId, messageId });
    };

    const handleDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deletedForEveryone: true, text: '', ciphertext: '', mediaUrl: '' } : m));
    };

    const handleReact = ({ messageId, emoji, reactorId }) => {
      setMessages(prev => prev.map(m => {
        if (m._id !== messageId) return m;
        const reactions = m.reactions || [];
        const existing = reactions.find(r => r.userId === reactorId);
        if (existing) return { ...m, reactions: reactions.map(r => r.userId === reactorId ? { ...r, emoji } : r) };
        return { ...m, reactions: [...reactions, { userId: reactorId, emoji }] };
      }));
    };

    const handleTypingStart = ({ userId }) => {
      if (userId === contact._id) setContactTyping(true);
    };
    const handleTypingStop = ({ userId }) => {
      if (userId === contact._id) setContactTyping(false);
    };

    const handleStatusBulk = ({ readerId, status }) => {
      if (readerId?.toString() === contact?._id?.toString()) {
        setMessages(prev => prev.map(m => {
          const mSenderIdStr = (m.senderId?._id || m.senderId)?.toString();
          const userStr = user?._id?.toString();
          const ranks = { sending: 0, sent: 1, delivered: 2, read: 3 };
          if (mSenderIdStr === userStr && ranks[status] >= ranks[m.status]) {
            return { ...m, status };
          }
          return m;
        }));
      }
    };

    on('message:receive', handleIncoming);
    on('message:status', handleStatus);
    on('message:status_bulk', handleStatusBulk);
    on('message:confirmed', handleConfirmed);
    on('message:deleted', handleDeleted);
    on('message:reacted', handleReact);
    on('typing:user', handleTypingStart);
    on('typing:stopped', handleTypingStop);

    // Order status card in-place patch
    const handleOrderUpdate = ({ messageId, orderData }) => {
      setMessages(prev => prev.map(m =>
        (m._id === messageId || m._id?.toString() === messageId)
          ? { ...m, orderData }
          : m
      ));
    };
    on('message:order_update', handleOrderUpdate);

    return () => {
      off('message:receive', handleIncoming);
      off('message:status', handleStatus);
      off('message:status_bulk', handleStatusBulk);
      off('message:confirmed', handleConfirmed);
      off('message:deleted', handleDeleted);
      off('message:reacted', handleReact);
      off('typing:user', handleTypingStart);
      off('typing:stopped', handleTypingStop);
      off('message:order_update', handleOrderUpdate);
    };
  }, [contact?._id, socket, user]);

  // Search - compute matches
  useEffect(() => {
    if (!showSearch || !searchQuery.trim()) {
      setMatchIndices([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const found = [];
    messages.forEach((msg, i) => {
      const txt = getPlainText(msg).toLowerCase();
      if (txt.includes(q)) found.push(i);
    });
    setMatchIndices(found);
    setSearchIndex(found.length - 1); // Start at most recent
  }, [searchQuery, messages, showSearch]);

  // Scroll to search match
  useEffect(() => {
    if (matchIndices.length === 0) return;
    const idx = matchIndices[searchIndex];
    const msg = messages[idx];
    if (msg && messageRefs.current[msg._id || idx]) {
      messageRefs.current[msg._id || idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchIndex, matchIndices]);

  const decryptText = useCallback((msg) => {
    if (!msg) return '';
    if (msg.isSystemMsg) return msg.text || '';
    if (!msg.ciphertext) return msg.text || '';
    if (!msg.nonce) return msg.text || '[Legacy Message]';
    if (!contactPK) return msg.text || '[Encrypted - Key Needed]';
    
    try {
      return decryptMessage(msg.ciphertext, msg.nonce, contactPK);
    } catch (err) {
      console.error('Decryption failed:', err);
      return msg.text || '[Decryption Error]';
    }
  }, [contactPK]);

  const getPlainText = (msg) => {
    if (msg?.text) return msg.text;
    return decryptText(msg);
  };

  const stopTyping = () => {
    if (typingState.current) {
      typingState.current = false;
      emit('typing:stop', { [isGroup ? 'groupId' : 'to']: contact._id });
    }
  };

  const handleTyping = (val) => {
    setInput(val);
    if (!typingState.current) {
      typingState.current = true;
      emit('typing:start', { [isGroup ? 'groupId' : 'to']: contact._id });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 1500);
  };

  const handleSend = async (overrideText, mediaUrl, mediaType) => {
    const text = overrideText !== undefined ? overrideText : input.trim();
    if (!text && !mediaUrl) return;
    if (!overrideText) setInput('');
    setReplyTo(null);
    stopTyping();

    const tempId = `temp-${Date.now()}`;
    let ciphertext = '';
    let nonce = '';

    if (text) {
      try {
        if (isGroup) {
          ciphertext = typeof text === 'object' ? JSON.stringify(text) : text;
          nonce = '';
        } else if (!contactPK) {
          console.warn('Cannot encrypt: recipient public key missing.');
          ciphertext = '';
          nonce = '';
        } else {
          const payload = typeof text === 'object' ? JSON.stringify(text) : text;
          const enc = encryptMessage(payload, contactPK);
          ciphertext = enc.ciphertext;
          nonce = enc.nonce;
        }
      } catch (err) {
        console.error('Encryption failed:', err);
      }
    }

    const optimistic = {
      _id: tempId, tempId,
      senderId: { _id: user._id },
      ciphertext, nonce,
      text: typeof text === 'object' ? JSON.stringify(text) : (text || ''),
      mediaUrl: mediaUrl || '',
      mediaType: mediaType || '',
      status: 'sent',
      createdAt: new Date().toISOString(),
      replyTo: replyTo || undefined
    };
    setMessages(prev => [...prev, optimistic]);

    const payloadObj = {
      text: typeof text === 'object' ? JSON.stringify(text) : (text || ''),
      ciphertext, nonce,
      [isGroup ? 'groupId' : 'receiverId']: contact._id,
      tempId, mediaUrl: mediaUrl || '', mediaType: mediaType || '', replyTo: replyTo?._id,
      senderObj: { _id: user._id, username: user.username, avatar: user.avatar, uniqueId: user.uniqueId }
    };

    emit('message:send', payloadObj);

    try {
      const res = await authFetch(`${API}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadObj)
      });
      if (res.ok) {
        const saved = await res.json();
        setMessages(prev => prev.map(m => m.tempId === tempId ? { ...m, _id: saved._id, status: saved.status } : m));
        emit('message:confirm', {
          [isGroup ? 'groupId' : 'receiverId']: contact._id,
          messageId: saved._id,
          tempId
        });
      }
    } catch {}
  };

  // ── File/Media handling ──────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    const newPreviews = files.map(file => {
      const objectUrl = URL.createObjectURL(file);
      let mediaType = 'file';
      if (file.type.startsWith('image')) mediaType = 'image';
      else if (file.type.startsWith('video')) mediaType = 'video';
      else if (file.type.startsWith('audio')) mediaType = 'audio';
      return { file, objectUrl, mediaType };
    });
    
    setMediaPreviews(prev => [...prev, ...newPreviews]);
    setCaptionInput(''); // One caption for all might be weird, but we'll apply it to the first file
    e.target.value = '';
  };

  const confirmMediaSend = async () => {
    if (mediaPreviews.length === 0) return;
    setUploading(true);
    setUploadProgress(10);
    
    let currentCaption = captionInput || '';
    
    for (let i = 0; i < mediaPreviews.length; i++) {
      const preview = mediaPreviews[i];
      try {
        setUploadProgress(10 + (80 * (i / mediaPreviews.length))); // Progress per file
        const form = new FormData();
        form.append('file', preview.file);
        const res = await authFetch(`${API}/api/messages/upload`, { method: 'POST', body: form });
        
        if (res.ok) {
          const { url, mediaType } = await res.json();
          // Send the caption only with the first file
          await handleSend(i === 0 ? currentCaption : '', url, mediaType);
        }
      } catch (err) {
        console.error('Failed to upload file:', err);
      }
    }
    
    setUploadProgress(100);
    setUploading(false);
    setUploadProgress(0);
    setMediaPreviews([]);
    setCaptionInput('');
  };

  // ── Voice recording ─────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Upload voice message
        setUploading(true);
        setUploadProgress(20);
        const tempId = `temp-audio-${Date.now()}`;
        setMessages(prev => [...prev, { _id: tempId, tempId, senderId: { _id: user._id }, text: '', mediaType: 'sending_audio', status: 'sending', createdAt: new Date().toISOString() }]);
        
        try {
          const form = new FormData();
          form.append('file', blob, `voice-${Date.now()}.webm`);
          const timer = setInterval(() => setUploadProgress(p => p < 90 ? p + 10 : p), 200);
          const res = await authFetch(`${API}/api/messages/upload`, { method: 'POST', body: form });
          clearInterval(timer);
          setUploadProgress(100);
          if (res.ok) {
            const { url } = await res.json();
            setMessages(prev => prev.filter(m => m._id !== tempId));
            await handleSend('', url, 'audio');
          } else {
            setMessages(prev => prev.filter(m => m._id !== tempId));
          }
        } catch {
          setMessages(prev => prev.filter(m => m._id !== tempId));
        }
        setUploading(false);
        setUploadProgress(0);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      alert('Microphone access denied or not available');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setRecording(false);
    setRecordingTime(0);
  };

  // ── Reactions & Delete ───────────────────────────────────────────────────────
  const handleReact = async (msg, emoji) => {
    setEmojiTarget(null);
    emit('message:react', {
      receiverId: contact.isGroup ? undefined : contact._id,
      groupId: contact.isGroup ? contact._id : undefined,
      messageId: msg._id,
      emoji
    });
    await authFetch(`${API}/api/messages/${msg._id}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji })
    });
  };

  const handleDelete = async (msg, forEveryone) => {
    setEmojiTarget(null);
    authFetch(`${API}/api/messages/${msg._id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteForEveryone: forEveryone })
    }).catch(console.error);

    if (forEveryone) {
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, deletedForEveryone: true, text: '', ciphertext: '', mediaUrl: '' } : m));
      emit('message:delete', { 
        messageId: msg._id, 
        receiverId: contact.isGroup ? undefined : contact._id,
        groupId: contact.isGroup ? contact._id : undefined
      });
    } else {
      setMessages(prev => prev.filter(m => m._id !== msg._id));
    }
  };

  // ── Block/Unblock ─────────────────────────────────────────────────────────────
  const handleBlockAction = async (c, action) => {
    const endpoint = action === 'block' ? 'block' : 'unblock';
    await authFetch(`${API}/api/users/${endpoint}/${c._id}`, { method: 'POST' });
    onBlockChange?.(c._id, action);
    setShowProfilePanel(false);
    setShowMoreMenu(false);
  };

  const handleRemoveContact = async (c) => {
    await authFetch(`${API}/api/users/contacts/${c._id}`, { method: 'DELETE' });
    setShowProfilePanel(false);
  };

  const isMine = (msg) => msg.senderId?._id === user._id || msg.senderId === user._id;

  const isBlockedContact = blockedUsers?.some(b => (b._id || b) === contactId);

  const formatRecordingTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Attachment handling ──────────────────────────────────────────────────────
  const handleAttachmentSelect = (type) => {
    setShowAttachmentMenu(false);
    setSharingType(type);
    
    if (['event', 'task', 'contact'].includes(type)) {
      setShowItemPicker(true);
    } else if (['photo', 'video', 'document'].includes(type)) {
      fileInputRef.current.accept = type === 'photo' ? 'image/*' : type === 'video' ? 'video/*' : '*/*';
      fileInputRef.current.multiple = true;
      fileInputRef.current.click();
    }
  };

  const handleShareItem = async (item) => {
    setShowItemPicker(false);
    let payload = {};
    
    if (sharingType === 'event') {
      payload = { type: 'event', data: { title: item.title, description: item.description, date: item.date, location: item.location, color: item.color } };
    } else if (sharingType === 'task') {
      payload = { type: 'task', data: { title: item.title, description: item.description, priority: item.priority, dueDate: item.dueDate } };
    } else if (sharingType === 'contact') {
      payload = { type: 'contact', data: { username: item.username, uniqueId: item.uniqueId, avatar: item.avatar } };
    }
    
    await handleSend(payload, '', sharingType);
  };

  const handleAddToMyList = async (msg) => {
    try {
      const text = getPlainText(msg);
      if (!text) return;
      const shared = JSON.parse(text);
      
      const endpoint = shared.type === 'event' ? '/api/events' : '/api/tasks';
      const res = await authFetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shared.data)
      });
      
      if (res.ok) {
        alert(`${shared.type.charAt(0).toUpperCase() + shared.type.slice(1)} added to your list!`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to add item to your list.');
    }
  };

  if (!contact) {
    return (
      <div className="chat-window hidden-on-mobile">
        <div className="empty-state">
          <div className="empty-state-icon">
            <FiCheck size={32} color="var(--accent)" />
          </div>
          <h3>End-to-End Encrypted</h3>
          <p>Select a conversation to start chatting securely.</p>
        </div>
      </div>
    );
  }

  const displayedMessages = messages;
  const isSearchMatch = (msg, idx) => {
    if (!showSearch || !searchQuery.trim()) return false;
    return matchIndices.includes(idx);
  };

  return (
    <div
      className={`chat-window ${chatWallpaper ? 'has-chat-wallpaper' : ''}`}
    >
      {chatWallpaper && (
        <div 
          className="chat-wallpaper-layer"
          style={{
            backgroundImage: chatWallpaper.startsWith('http') ? `url(${chatWallpaper})` : chatWallpaper
          }}
        />
      )}
      {chatWallpaper && (
        <div 
          className="chat-wallpaper-overlay" 
          style={{ background: `rgba(0,0,0,${dimLevel})` }}
        />
      )}
      {/* Header */}
      <div className="chat-header">
        <button className="icon-btn mobile-only-back" onClick={() => onStartCall?.(null, 'close')}>
          <FiCornerUpLeft size={18} />
        </button>
        <div
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}
          onClick={() => { setShowProfilePanel(true); setShowMoreMenu(false); }}
        >
          {(contact.avatar || contact.avatarUrl)
            ? <img src={contact.avatar || contact.avatarUrl} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
            : <AvatarFallback name={contact.name || contact.username} size={38} />
          }
          <div className="chat-header-info">
            <div className="chat-header-name">
              {nicknames[contact._id] || contact.name || contact.username || contact.email?.split('@')[0]}
            </div>
            <div className="chat-header-status" style={{ color: contact.isOnline ? 'var(--green)' : undefined }}>
              {isGroup ? `${contact.members?.length || 0} members` : (
                contactTyping
                  ? <span style={{ color: 'var(--accent)' }}>typing…</span>
                  : contact.isOnline ? 'Online' : `@${contact.uniqueId}`
              )}
            </div>
          </div>
        </div>

        <div className="chat-header-actions">
          {/* Search toggle */}
          <button
            className={`icon-btn ${showSearch ? 'active' : ''}`}
            title="Search in chat"
            onClick={() => { setShowSearch(s => !s); setSearchQuery(''); setMatchIndices([]); }}
          >
            <FiSearch size={17} />
          </button>
          <button className="icon-btn" title="Voice call" onClick={() => onStartCall?.(contact, 'audio')}>
            <FiPhone size={18} />
          </button>
          <button className="icon-btn" title="Video call" onClick={() => onStartCall?.(contact, 'video')}>
            <FiVideo size={18} />
          </button>
          {/* More menu trigger */}
          <div style={{ position: 'relative' }}>
            <button 
              ref={moreMenuTriggerRef}
              className="icon-btn" 
              onClick={() => {
                const rect = moreMenuTriggerRef.current.getBoundingClientRect();
                setMoreMenuPos({ top: rect.bottom + 10, left: rect.right - 190 });
                setShowMoreMenu(m => !m);
              }}
            >
              <FiMoreVertical size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="chat-search-bar">
          <FiSearch size={15} color="var(--text-muted)" />
          <input
            ref={searchInputRef}
            className="chat-search-input"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
          {matchIndices.length > 0 && (
            <span className="chat-search-count">
              {matchIndices.length - searchIndex}/{matchIndices.length}
            </span>
          )}
          <button
            className="icon-btn btn-sm"
            disabled={matchIndices.length === 0}
            onClick={() => setSearchIndex(i => Math.max(0, i - 1))}
          >
            <FiChevronUp size={15} />
          </button>
          <button
            className="icon-btn btn-sm"
            disabled={matchIndices.length === 0}
            onClick={() => setSearchIndex(i => Math.min(matchIndices.length - 1, i + 1))}
          >
            <FiChevronDown size={15} />
          </button>
          <button className="icon-btn btn-sm" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
            <FiX size={15} />
          </button>
        </div>
      )}

      {/* Upload progress bar */}
      {uploading && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      {/* Messages area */}
      <div
        className="messages-area"
        onClick={() => { setEmojiTarget(null); setShowMoreMenu(false); }}
        style={chatWallpaper ? {
          backgroundImage: chatWallpaper.startsWith('http') ? `url(${chatWallpaper})` : chatWallpaper,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        } : {}}
      >
        {loadingMsgs ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div className="spinner" style={{ width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : displayedMessages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 'auto', marginBottom: 'auto', color: 'var(--text-muted)' }}>
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderRadius: 20, display: 'inline-block' }}>No messages yet</div>
          </div>
        ) : messages.map((msg, i) => {
          const mine = isMine(msg);
          const text = getPlainText(msg);
          const isHighlighted = isSearchMatch(msg, i);
          const isCurrentMatch = matchIndices[searchIndex] === i;

          return (
            <div
              key={msg._id || i}
              className={`msg-wrapper ${mine ? 'out' : 'in'}`}
              ref={el => { messageRefs.current[msg._id || i] = el; }}
              style={isCurrentMatch ? { outline: '2px solid var(--accent)', borderRadius: 12 } : {}}
            >
              {msg.replyTo && (
                <div className="reply-preview">
                  ↩{' '}
                  {typeof msg.replyTo === 'object'
                    ? (msg.replyTo.text || msg.replyTo.ciphertext?.slice(0, 60) || 'Previous message')
                    : 'Previous message'}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: mine ? 'row-reverse' : 'row' }}>
                <div
                  className={`msg-bubble ${isHighlighted ? 'search-highlight' : ''}`}
                  onContextMenu={e => { 
                    e.preventDefault(); 
                    e.stopPropagation();
                    const menuWidth = 160;
                    const menuHeight = 240;
                    let x = e.clientX;
                    let y = e.clientY;

                    if (x + menuWidth > window.innerWidth) x -= menuWidth;
                    if (y + menuHeight > window.innerHeight) y -= menuHeight;
                    
                    setContextPos({ x, y });
                    setEmojiTarget(msg._id); 
                  }}
                >
                  {isGroup && !mine && msg.senderId && !msg.deletedForEveryone && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>
                      {msg.senderId.username || 'User'}
                    </div>
                  )}
                  {msg.deletedForEveryone
                    ? <span style={{ fontStyle: 'italic', opacity: 0.6 }}>This message was deleted</span>
                    : (
                      <>
                        {/* ── Order Status Update Card ───────────────── */}
                        {msg.mediaType === 'order_update' && (
                          <OrderUpdateCard orderData={msg.orderData} />
                        )}

                        {text && !['event', 'task', 'contact', 'document', 'store', 'order_update'].includes(msg.mediaType) && (
                          <span>{showSearch && searchQuery ? highlightText(text, searchQuery) : text}</span>
                        )}
                        {msg.mediaUrl && (
                          <div style={{ marginTop: text ? 6 : 0 }}>
                            {msg.mediaType === 'image' && (
                              <img
                                src={fixUrl(msg.mediaUrl)}
                                alt=""
                                style={{ maxWidth: 240, borderRadius: 8, display: 'block', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }}
                                onClick={() => setViewMedia({ url: fixUrl(msg.mediaUrl), type: 'image' })}
                              />
                            )}
                            {msg.mediaType === 'video' && (
                              <video
                                src={fixUrl(msg.mediaUrl)}
                                controls
                                style={{ maxWidth: 240, borderRadius: 10, display: 'block', cursor: 'pointer' }}
                                onPlay={e => { e.preventDefault(); setViewMedia({ url: fixUrl(msg.mediaUrl), type: 'video' }); e.target.pause(); }}
                              />
                            )}
                            {msg.mediaType === 'audio' && (
                              <AudioPlayer src={fixUrl(msg.mediaUrl)} isMine={mine} />
                            )}
                            {msg.mediaType === 'sending_audio' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 24, width: 220 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'conic-gradient(var(--accent) ' + uploadProgress + '%, transparent 0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FiMic size={14} color="var(--accent)" />
                                  </div>
                                </div>
                                <div style={{ flex: 1, height: 4, background: 'var(--bg-hover)', borderRadius: 2 }}>
                                  <div style={{ height: '100%', background: 'var(--accent)', width: `${uploadProgress}%`, borderRadius: 2 }} />
                                </div>
                              </div>
                            )}
                            {msg.mediaType === 'file' && (
                              <div className="shared-item-bubble document" style={{ width: 240, border: 'none', background: 'transparent', padding: 0 }}>
                                <div className="shared-item-header">
                                  <div className="shared-item-icon" style={{ background: '#7c3aed22', color: '#7c3aed' }}>
                                    <FiFile size={20} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div className="shared-item-title" style={{ color: 'inherit' }}>{msg.mediaUrl.split('/').pop()}</div>
                                    <div className="shared-item-meta">Document</div>
                                  </div>
                                </div>
                                <a 
                                  href={fixUrl(msg.mediaUrl)} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="shared-item-action" 
                                  style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}
                                >
                                  View Document
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {['event', 'task', 'contact', 'store'].includes(msg.mediaType) && text && (
                          (() => {
                            try {
                              const shared = JSON.parse(text);
                              return (
                                <div className={`shared-item-bubble ${shared.type}`}>
                                  <div className="shared-item-header">
                                    <div className="shared-item-icon" style={{ 
                                      background: shared.type === 'event' ? '#6366f122' : shared.type === 'task' ? '#10b98122' : shared.type === 'store' ? '#f59e0b22' : '#f59e0b22',
                                      color: shared.type === 'event' ? '#6366f1' : shared.type === 'task' ? '#10b981' : shared.type === 'store' ? '#f59e0b' : '#f59e0b'
                                    }}>
                                      {shared.type === 'event' ? <FiCalendar size={20} /> : shared.type === 'task' ? <FiCheckSquare size={20} /> : shared.type === 'store' ? <FiShoppingBag size={20} /> : <FiUser size={20} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div className="shared-item-title">{shared.type === 'contact' ? shared.data.username : shared.data.name || shared.data.title}</div>
                                      <div className="shared-item-meta">
                                        {shared.type === 'contact' ? `@${shared.data.uniqueId}` : shared.type === 'store' ? `$${shared.data.price} • ${shared.data.catalog}` : shared.type === 'event' ? new Date(shared.data.date).toLocaleString() : `Priority: ${shared.data.priority}`}
                                      </div>
                                    </div>
                                  </div>
                                  {shared.data.description && <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{shared.data.description}</div>}
                                  {['event', 'task'].includes(shared.type) && (
                                    <button className="shared-item-action" onClick={() => handleAddToMyList(msg)}>
                                      Add to My {shared.type.charAt(0).toUpperCase() + shared.type.slice(1)}s
                                    </button>
                                  )}
                                  {shared.type === 'store' && (
                                    <button className="shared-item-action" onClick={() => { setStoreTargetId(shared.data.ownerId || (user.isBusiness ? user._id : contact._id)); setShowStoreFront(true); }}>
                                      View Item in Store
                                    </button>
                                  )}
                                  {shared.type === 'contact' && (
                                    <button className="shared-item-action" onClick={() => { setSearchQuery(shared.data.uniqueId); setShowSearch(true); }}>
                                      View Profile
                                    </button>
                                  )}
                                </div>
                              );
                            } catch { return null; }
                          })()
                        )}
                      </>
                    )
                  }
                </div>

                {/* Context menu (emoji + actions) */}
                {emojiTarget === msg._id && createPortal(
                  <div className="vertical-context-menu" style={{
                    display: 'flex', flexDirection: 'column', padding: 8, minWidth: 160, gap: 4,
                    background: 'var(--bg-elevated)', borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                    position: 'fixed', zIndex: 9999, top: contextPos.y, left: contextPos.x
                  }}
                  onClick={e => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                      {EMOJIS.slice(0, 6).map(e => (
                        <button key={e} onClick={() => handleReact(msg, EMOJI_CHARS[e])} style={{ fontSize: 16, cursor: 'pointer', background: 'none', border: 'none', padding: 2 }}>
                          {EMOJI_CHARS[e]}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => { setReplyTo(msg); setEmojiTarget(null); }} className="hover-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text)', textAlign: 'left', padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FiCornerUpLeft size={14} /> Reply
                    </button>
                    <button onClick={() => handleDelete(msg, false)} className="hover-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text)', textAlign: 'left', padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FiTrash2 size={14} /> Delete for me
                    </button>
                    {mine && (
                      <button onClick={() => handleDelete(msg, true)} className="hover-btn" style={{ background: 'transparent', border: 'none', color: 'var(--red)', textAlign: 'left', padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiTrash2 size={14} /> Delete for everyone
                      </button>
                    )}
                  </div>,
                  document.body
                )}
              </div>

              {/* Reactions */}
              {msg.reactions?.length > 0 && (
                <div className="msg-reactions">
                  {Object.entries(
                    msg.reactions.reduce((acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] || 0) + 1 }), {})
                  ).map(([emoji, count]) => (
                    <span key={emoji} className="reaction-chip" onClick={() => handleReact(msg, emoji)}>
                      {emoji} {count > 1 ? count : ''}
                    </span>
                  ))}
                </div>
              )}
              <div className="msg-time">
                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {mine && <span className="msg-status"><StatusIcon status={msg.status} /></span>}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {contactTyping && (
          <div className="msg-wrapper in">
            <div className="msg-bubble" style={{ padding: '10px 16px' }}>
              <div className="typing-dots">
                <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div style={{
          background: 'var(--bg-elevated)',
          borderLeft: '3px solid var(--accent)',
          padding: '8px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            ↩ Replying to: {getPlainText(replyTo).slice(0, 60)}
          </span>
          <button className="icon-btn" onClick={() => setReplyTo(null)}><FiX size={14} /></button>
        </div>
      )}

      {/* Media previews modal */}
      {mediaPreviews.length > 0 && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title">Preview & Send ({mediaPreviews.length})</div>
              <button className="icon-btn" onClick={() => { 
                mediaPreviews.forEach(p => URL.revokeObjectURL(p.objectUrl));
                setMediaPreviews([]); 
              }}>
                <FiX size={18} />
              </button>
            </div>

            {/* Media previews list */}
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', marginBottom: 16, paddingBottom: 8 }}>
              {mediaPreviews.map((preview, idx) => (
                <div key={idx} style={{ background: 'var(--bg-surface)', borderRadius: 10, overflow: 'hidden', textAlign: 'center', minWidth: 160, position: 'relative' }}>
                  <button className="icon-btn" style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', width: 24, height: 24, padding: 0 }} 
                    onClick={() => {
                      URL.revokeObjectURL(preview.objectUrl);
                      setMediaPreviews(prev => prev.filter((_, i) => i !== idx));
                    }}
                  ><FiX size={14} color="#fff" /></button>
                  {preview.mediaType === 'image' && (
                    <img src={preview.objectUrl} alt="" style={{ height: 120, width: '100%', objectFit: 'cover' }} />
                  )}
                  {preview.mediaType === 'video' && (
                    <video src={preview.objectUrl} style={{ height: 120, width: '100%', objectFit: 'cover' }} />
                  )}
                  {preview.mediaType === 'audio' && (
                    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FiMic size={32} color="var(--accent)" />
                    </div>
                  )}
                  {preview.mediaType === 'file' && (
                    <div style={{ height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                      <FiFile size={24} style={{ marginBottom: 4 }} color="var(--accent)" />
                      <div style={{ fontSize: 11, wordBreak: 'break-all', maxHeight: 32, overflow: 'hidden' }}>{preview.file.name}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Caption */}
            <div className="form-group">
              <input
                className="input"
                placeholder="Add a caption (applies to first item)..."
                value={captionInput}
                onChange={e => setCaptionInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmMediaSend(); }}
              />
            </div>

            {/* Progress */}
            {uploading && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden', marginBottom: 12, height: 4 }}>
                <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => { mediaPreviews.forEach(p => URL.revokeObjectURL(p.objectUrl)); setMediaPreviews([]); }}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, gap: 8 }} onClick={confirmMediaSend} disabled={uploading || mediaPreviews.length === 0}>
                <FiSend size={14} /> {uploading ? `Uploading ${Math.round(uploadProgress)}%...` : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input bar */}
      {isBlockedContact ? (
        <div style={{
          padding: '16px 20px',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13
        }}>
          🚫 You have blocked this user. <button
            onClick={() => handleBlockAction(contact, 'unblock')}
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >Unblock</button>
        </div>
      ) : (
        <div className="input-bar">
          {/* Recording indicator */}
          {recording && (
            <div className="recording-indicator">
              <div className="recording-dot" />
              <span>Recording {formatRecordingTime(recordingTime)}</span>
              <button className="btn btn-danger btn-sm" onClick={stopRecording}>
                <FiStopCircle size={14} /> Stop & Send
              </button>
            </div>
          )}

          <div className="input-row">
            <div style={{ position: 'relative' }}>
              {showAttachmentMenu && (
                <AttachmentMenu 
                  onSelect={handleAttachmentSelect} 
                  onClose={() => setShowAttachmentMenu(false)} 
                />
              )}
              <button className="icon-btn" title="Attach" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}>
                <FiPaperclip size={18} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            <textarea
              className="input-field"
              rows={1}
              placeholder="Type a message..."
              value={input}
              onChange={e => handleTyping(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={recording}
            />

            <button className="icon-btn"><FiSmile size={18} /></button>

            {/* Send / Mic button */}
            {input.trim() ? (
              <button className="send-btn" onClick={() => handleSend()}>
                <FiSend size={18} />
              </button>
            ) : (
              <button
                className={`send-btn ${recording ? 'recording' : ''}`}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                title="Hold to record voice message"
              >
                <FiMic size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Profile Panel */}
      {showProfilePanel && (
        <UserProfilePanel
          contact={contact}
          onClose={() => setShowProfilePanel(false)}
          onBlock={onBlockChange}
          onRemove={handleRemoveContact}
          blockedUsers={blockedUsers}
          onViewStore={() => { setStoreTargetId(contact._id); setShowStoreFront(true); }}
        />
      )}

      {/* Wallpaper Picker */}
      {showWallpaperPicker && (
        <WallpaperPicker
          contact={contact}
          currentWallpaper={chatWallpaper}
          onClose={() => setShowWallpaperPicker(false)}
          onApply={(imageUrl, key) => onWallpaperChange?.(key, imageUrl)}
        />
      )}

      {/* Media Lightbox */}
      {viewMedia && (
        <div className="media-lightbox-overlay" onClick={() => setViewMedia(null)}>
          <button className="media-lightbox-close" onClick={() => setViewMedia(null)}>
            <FiX size={24} />
          </button>
          {viewMedia.type === 'video' ? (
            <video src={viewMedia.url} controls autoPlay className="media-lightbox-content" onClick={e => e.stopPropagation()} />
          ) : (
            <img src={viewMedia.url} alt="Media Viewer" className="media-lightbox-content" onClick={e => e.stopPropagation()} />
          )}
        </div>
      )}

      {/* Wallpaper Picker */}
      {showWallpaperPicker && createPortal(
        <WallpaperPicker
          contact={contact}
          currentWallpaper={chatWallpaper}
          onClose={() => setShowWallpaperPicker(false)}
          onApply={(imageUrl, key) => {
            onWallpaperChange?.(key, imageUrl);
            setShowWallpaperPicker(false);
          }}
        />,
        document.body
      )}

      {/* Shared Item Picker */}
      {showItemPicker && (
        <SharedItemPicker 
          type={sharingType} 
          onSelect={handleShareItem} 
          onClose={() => setShowItemPicker(false)} 
        />
      )}

      {/* Store Front Overlay */}
      {showStoreFront && storeTargetId && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'var(--bg-base)' }}>
          <StoreFront 
            contactId={storeTargetId} 
            onClose={() => setShowStoreFront(false)} 
            onBuyItem={(item) => {
              setShowStoreFront(false);
              const url = item.media && item.media.length > 0 ? item.media[0].url : item.imageUrl;
              const payload = { type: 'store', data: { name: item.name, price: item.price, url: url || '', catalog: item.catalog, ownerId: item.userId } };
              handleSend(payload, '', 'store');
            }}
          />
        </div>
      )}

      {/* More Menu Portal */}
      {showMoreMenu && createPortal(
        <div 
          className="more-menu portal-menu" 
          style={{ top: moreMenuPos.top, left: moreMenuPos.left, opacity: 1, zIndex: 10000, position: 'fixed' }}
          onClick={e => e.stopPropagation()}
        >
          <button className="more-menu-item" onClick={() => { setShowWallpaperPicker(true); setShowMoreMenu(false); }}>
            <FiWallpaper size={15} /> Set Wallpaper
          </button>
          
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          
          {/* Chat Actions in Header Menu */}
          <button className="more-menu-item" onClick={() => { setShowMoreMenu(false); /* Handled by user profile panel/search if needed */ setShowProfilePanel(true); }}>
            <FiUser size={15} /> View Profile
          </button>
          
          <button className="more-menu-item" onClick={async () => { await authFetch(`${API}/api/users/pin/${contact._id}`, { method: 'PUT' }); setShowMoreMenu(false); window.dispatchEvent(new Event('chat-metadata-updated')); }}>
            <FiMapPin size={15} /> Toggle Pin
          </button>
          <button className="more-menu-item" onClick={() => { setShowMoreMenu(false); setShowLockModal({ action: 'toggle', contact }); }}>
            <FiLock size={15} /> Toggle Lock
          </button>
          <button className="more-menu-item" onClick={async () => { await authFetch(`${API}/api/users/archive/${contact._id}`, { method: 'PUT' }); setShowMoreMenu(false); window.dispatchEvent(new Event('chat-metadata-updated')); }}>
            <FiArchive size={15} /> Toggle Archive
          </button>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          {isBlockedContact ? (
            <button className="more-menu-item" onClick={() => { handleBlockAction(contact, 'unblock'); setShowMoreMenu(false); }}>
              <FiCheck size={15} /> Unblock User
            </button>
          ) : (
            <button className="more-menu-item danger" onClick={() => { handleBlockAction(contact, 'block'); setShowMoreMenu(false); }}>
              <FiSlash size={15} /> Block User
            </button>
          )}
          <button className="more-menu-item danger" onClick={() => { setShowMoreMenu(false); setShowDeleteModal(contact); }}>
            <FiTrash2 size={15} /> Delete Chat
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
