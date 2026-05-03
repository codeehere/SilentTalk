import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FiPhone, FiVideo, FiMoreVertical, FiSend, FiPaperclip, FiSmile, FiMic,
  FiCornerUpLeft, FiTrash2, FiCheck, FiX, FiSearch, FiImage, FiSlash,
  FiUserMinus, FiImage as FiWallpaper, FiChevronUp, FiChevronDown,
  FiStopCircle, FiPlay, FiPause, FiFile, FiCalendar, FiCheckSquare, FiUser, FiShoppingBag,
  FiPackage, FiTruck, FiStar, FiExternalLink, FiAlertCircle, FiClock,
  FiMapPin, FiLock, FiArchive, FiZap
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
  const [contactPK, setContactPK] = useState(contact?.publicKey || '');

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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
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
    setCurrentPage(1);
    setHasMoreMessages(false);
    setContactPK(contact.publicKey || '');
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
        const msgRes = await authFetch(`${API}/api/messages/${isGroup ? 'group/' : ''}${contact._id}?page=1&limit=40`);
        if (msgRes.ok) {
          const data = await msgRes.json();
          // If we got exactly 40, there may be more
          setHasMoreMessages(data.length === 40);
          
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

  // Load older messages (pagination)
  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMoreMessages || !contact) return;
    setLoadingOlder(true);
    const nextPage = currentPage + 1;
    try {
      const msgRes = await authFetch(`${API}/api/messages/${isGroup ? 'group/' : ''}${contact._id}?page=${nextPage}&limit=40`);
      if (msgRes.ok) {
        const older = await msgRes.json();
        setHasMoreMessages(older.length === 40);
        setCurrentPage(nextPage);
        setMessages(prev => [...older, ...prev]);
      }
    } catch {}
    setLoadingOlder(false);
  };

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
    window.dispatchEvent(new CustomEvent('message-sent', { detail: { contactId: contact._id, text: typeof text === 'object' ? 'Message' : (text || (mediaUrl ? 'Media' : '')) } }));

    const payloadObj = {
      text: (ciphertext && !isGroup) ? '' : (typeof text === 'object' ? JSON.stringify(text) : (text || '')),
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
      if (type === 'photo') {
        fileInputRef.current.accept = 'image/*';
      } else if (type === 'video') {
        fileInputRef.current.accept = 'video/*';
      } else {
        // Documents: PDF, text, office docs etc.
        fileInputRef.current.accept = 'application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';
      }
      fileInputRef.current.multiple = type !== 'document';
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
      <div className="chat-window hidden-on-mobile" style={{ position:'relative', overflow:'hidden', background:'linear-gradient(to bottom, #130815, #1d0f1b)' }}>
        <style>{`
          /* Sakura Falling Container */
          .sakura-container {
            position: absolute;
            top: -10%;
            pointer-events: auto; /* Allow interactions */
            will-change: transform, opacity;
            z-index: 1;
            /* Container handles the absolute fall and rotation */
          }

          /* The Petal Itself - Handles shape and interaction transforms */
          .sakura-petal {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #fbcfe8 0%, #f472b6 100%);
            border-radius: 15px 2px 15px 2px;
            box-shadow: inset 2px 2px 4px rgba(255,255,255,0.4), 0 0 8px rgba(244, 114, 182, 0.3);
            transform-style: preserve-3d;
            transition: transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.5s ease;
            will-change: transform;
            cursor: pointer;
          }

          /* Falling Animation with 3D Rotation (Absolute Physics) */
          @keyframes sakura-fall {
            0% { 
              transform: translateY(-5vh) translateX(0) rotate3d(1, 1, 0, 0deg); 
              opacity: 0; 
            }
            10% { opacity: var(--max-opacity, 0.6); }
            80% { opacity: var(--max-opacity, 0.6); }
            100% { 
              transform: translateY(105vh) translateX(var(--drift, 15vw)) rotate3d(var(--rx, 1), var(--ry, 1), var(--rz, 0), var(--rot, 720deg)); 
              opacity: 0; 
            }
          }
          
          @keyframes sakura-sway {
            0%, 100% { transform: translateX(0px); }
            50% { transform: translateX(var(--sway, 45px)); }
          }

          /* Glow Orbs for calmness */
          .calm-orb {
            position: absolute;
            border-radius: 50%;
            filter: blur(60px);
            opacity: 0.4;
            pointer-events: none;
            will-change: transform;
          }
          
          @keyframes orb-float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(30px, -40px) scale(1.1); }
          }

          /* Centre card */
          .au-card {
            position: absolute; inset: 0;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 0; pointer-events: none; user-select: none;
            z-index: 10;
          }

          @keyframes au-card-in {
            0%   { transform: translateY(16px); opacity: 0; }
            100% { transform: translateY(0px);  opacity: 1; }
          }

          @keyframes ring-pulse-sakura {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.12); opacity: 0.9; }
          }

          @keyframes sakura-shimmer {
            0%   { background-position: 200% center; }
            100% { background-position: -200% center; }
          }

          /* ── Deployment Info Box ── */
          .deployment-box {
            position: absolute;
            bottom: 24px;
            right: 24px;
            background: rgba(30, 15, 30, 0.5);
            border: 1px solid rgba(244, 114, 182, 0.2);
            border-radius: 12px;
            padding: 14px 18px;
            color: #fff;
            z-index: 20;
            backdrop-filter: blur(12px);
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            height: 48px;
            width: 300px;
            display: flex;
            flex-direction: column;
            cursor: default;
          }

          .deployment-box:hover {
            height: 340px;
            background: rgba(40, 20, 40, 0.8);
            border-color: rgba(244, 114, 182, 0.5);
            box-shadow: 0 12px 48px rgba(244, 114, 182, 0.2);
          }

          .deploy-header {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            font-weight: 600;
            color: rgba(251, 207, 232, 0.9);
            height: 20px;
          }

          .deploy-details {
            margin-top: 20px;
            opacity: 0;
            transition: opacity 0.3s ease;
            transition-delay: 0s;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .deployment-box:hover .deploy-details {
            opacity: 1;
            transition-delay: 0.15s;
          }

          .deploy-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #f472b6;
            margin-bottom: 6px;
          }

          .deploy-text {
            font-size: 12px;
            color: rgba(251, 207, 232, 0.7);
            line-height: 1.6;
          }

          /* ── Next Update Glowing Box ── */
          .next-update-wrap {
            position: absolute;
            bottom: 24px;
            right: 340px;
            width: 150px;
            height: 48px;
            border-radius: 12px;
            background: rgba(30, 15, 30, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 20;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            cursor: default;
          }
          
          .next-update-wrap::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: conic-gradient(transparent, transparent, transparent, #00e5ff, #a78bfa, transparent);
            animation: border-flow 3s linear infinite;
          }

          .next-update-inner {
            position: absolute;
            inset: 1.5px;
            background: rgba(30, 15, 30, 0.95);
            border-radius: 10.5px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            z-index: 1;
            padding: 0 16px;
            width: calc(100% - 3px);
            height: calc(100% - 3px);
            box-sizing: border-box;
          }

          @keyframes border-flow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>

        {/* ── Background Glow Orbs ─────────────────────────────────── */}
        <div className="calm-orb" style={{ top: '20%', left: '15%', width: 300, height: 300, background: '#f472b6', animation: 'orb-float 15s ease-in-out infinite' }} />
        <div className="calm-orb" style={{ bottom: '15%', right: '10%', width: 400, height: 400, background: '#a78bfa', animation: 'orb-float 20s ease-in-out infinite reverse' }} />

        {/* ── Sakura Petals (Leaves) ──────────────────────────────── */}
        {[...Array(35)].map((_, i) => {
          const left = Math.random() * 100;
          const size = Math.random() * 6 + 4; // 4px to 10px (smaller leaves)
          const dur = Math.random() * 8 + 8; // 8s to 16s fall
          const delay = Math.random() * 15; // stagger starts
          const swayDur = Math.random() * 3 + 3; // 3s to 6s sway
          const swayDelay = Math.random() * 2;
          
          // Absolute Physics Properties
          const drift = Math.random() > 0.5 ? `${Math.random() * 25}vw` : `-${Math.random() * 25}vw`;
          const sway = Math.random() > 0.5 ? `${Math.random() * 60 + 20}px` : `-${Math.random() * 60 + 20}px`;
          const rot = `${Math.random() * 1080 + 360}deg`;
          const rx = Math.random() * 1.5;
          const ry = Math.random() * 1.5;
          const rz = Math.random() * 0.5;
          const maxOpacity = Math.random() * 0.35 + 0.25; // 0.25 to 0.6 transparency
          
          return (
            <div 
              key={i} 
              className="sakura-container" 
              style={{
                left: `${left}%`,
                width: size,
                height: size,
                '--drift': drift,
                '--rot': rot,
                '--rx': rx,
                '--ry': ry,
                '--rz': rz,
                '--max-opacity': maxOpacity,
                animation: `sakura-fall ${dur}s linear infinite ${delay}s`
              }} 
            >
              <div 
                className="sakura-petal"
                style={{
                  '--sway': sway,
                  animation: `sakura-sway ${swayDur}s ease-in-out infinite alternate ${swayDelay}s`
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  // Calculate dynamic flutter based on random wind physics
                  const randomX = (Math.random() - 0.5) * 120; // Blown away horizontally
                  const randomY = -Math.random() * 60 - 30; // Float upwards
                  const randomRot = Math.random() * 360 + 180; // Wild spin
                  
                  el.style.transform = `translate3d(${randomX}px, ${randomY}px, 40px) rotate3d(1, 1, 1, ${randomRot}deg) scale(1.6)`;
                  el.style.opacity = '1';
                  
                  // Fall back into place naturally
                  setTimeout(() => {
                    if (el) {
                      el.style.transform = 'translate3d(0, 0, 0) rotate3d(0, 0, 0, 0deg) scale(1)';
                      el.style.opacity = 'inherit';
                    }
                  }, 700);
                }}
              />
            </div>
          );
        })}

        {/* ── Centre card ──────────────────────────────────────────── */}
        <div className="au-card">
          <div style={{ position:'relative', width:80, height:80, marginBottom:28, animation:'au-card-in .8s ease both' }}>
            <div style={{
              width:80, height:80, borderRadius:'50%',
              background:'linear-gradient(135deg, rgba(244,114,182,0.15) 0%, rgba(167,139,250,0.15) 100%)',
              border:'1.5px solid rgba(244,114,182,0.4)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 0 30px rgba(244,114,182,0.2)',
              animation:'ring-pulse-sakura 4s ease-in-out infinite',
              backdropFilter: 'blur(8px)'
            }}>
              {/* Lock Icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(244,114,182,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          </div>

          <div style={{
            fontSize:28, fontWeight:800, letterSpacing:1,
            background:'linear-gradient(90deg, #fbcfe8, #f472b6, #c084fc, #fbcfe8)',
            backgroundSize:'300% 100%',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            backgroundClip:'text',
            animation:'sakura-shimmer 6s linear infinite, au-card-in .9s ease .1s both',
            marginBottom:8,
          }}>SilentTalk</div>

          <div style={{
            fontSize:13, letterSpacing:1,
            animation:'au-card-in 1s ease .2s both',
            marginBottom:6,
            color: 'rgba(251, 207, 232, 0.7)'
          }}>A space for calm connection</div>

          <div style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'5px 14px', borderRadius:20, marginTop:4,
            background:'rgba(244,114,182,0.08)', border:'1px solid rgba(244,114,182,0.2)',
            animation:'au-card-in 1s ease .35s both',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(244,114,182,0.8)" stroke="none">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            <span style={{ fontSize:11, color:'rgba(244,114,182,0.8)', letterSpacing:1.5, fontWeight:600, textTransform:'uppercase' }}>
              End-to-end encrypted
            </span>
          </div>
        </div>

        {/* ── Deployment Info Box ──────────────────────────────────── */}
        <div className="deployment-box">
          <div className="deploy-header">
            <FiZap size={15} color="#f472b6" />
            <span>v2.5 Deployed May 3, 2026</span>
          </div>
          <div className="deploy-details">
            <div className="deploy-section">
              <div className="deploy-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <FiStar size={12} /> Newly Added
              </div>
              <div className="deploy-text">
                • Cross-Device E2EE Sync & Multi-Login<br/>
                • Live Session IP & Location Tracking<br/>
                • Primary Account Creator Protection
              </div>
            </div>
            <div className="deploy-section">
              <div className="deploy-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <FiClock size={12} /> Previous
              </div>
              <div className="deploy-text">
                • Unlimited Group Calling via Jitsi<br/>
                • Interactive Sakura Physics Animation<br/>
                • E-Commerce Store & Media Previews
              </div>
            </div>
            <div className="deploy-section">
              <div className="deploy-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <FiSend size={12} /> Upcoming
              </div>
              <div className="deploy-text">
                • AI Message Summaries & Context<br/>
                • Offline Message Sync Support
              </div>
            </div>
          </div>
        </div>

        {/* ── Next Update Glowing Box ──────────────────────────────── */}
        <div className="next-update-wrap">
          <div className="next-update-inner">
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
               <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Next Update</div>
               <div style={{ fontSize: 13, color: '#00e5ff', fontWeight: 800, textShadow: '0 0 10px rgba(0,229,255,0.5)' }}>Late May 2026</div>
             </div>
          </div>
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
        onContextMenu={(e) => {
          e.preventDefault();
          let left = e.clientX;
          let top = e.clientY;
          // Ensure menu stays within viewport (approx 220px width, 380px height)
          if (left > window.innerWidth - 220) left -= 220;
          if (top > window.innerHeight - 380) top -= 380;
          setMoreMenuPos({ top, left });
          setShowMoreMenu(true);
        }}
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
        ) : (
        <>
          {/* Load older messages button */}
          {hasMoreMessages && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <button
                onClick={loadOlderMessages}
                disabled={loadingOlder}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '7px 20px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  cursor: loadingOlder ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
              >
                {loadingOlder
                  ? <><div style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Loading…</>
                  : '⬆ Load older messages'
                }
              </button>
            </div>
          )}
          {messages.map((msg, i) => {
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
        </>
        )}

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
          style={{ top: moreMenuPos.top, left: moreMenuPos.left, width: 200, opacity: 1, zIndex: 10000, position: 'fixed' }}
          onClick={e => e.stopPropagation()}
        >
          <button className="more-menu-item" onClick={() => { setShowMoreMenu(false); onStartCall?.(null, 'close'); }}>
            <FiX size={15} /> Close Chat
          </button>
          
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

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
