import { useState, useRef, useEffect } from 'react';
import { Search, MoreVertical, Paperclip, Smile, Send, FileText, UserPlus, Bot } from 'lucide-react';

const MainChat = ({ activeContact, messages, currentUserId, onSendMessage, onTyping, typingUsers }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  if (!activeContact) {
    return (
      <div className="main-chat-container" style={{ position: 'relative', overflow: 'hidden', background: '#0d0d0f' }}>
        {/* ── Fire animation styles ─────────────────────────────────────────── */}
        <style>{`
          /* Compositor-only properties: transform + opacity = zero repaints */
          @keyframes flicker1 {
            0%,100%{ transform: scaleX(1) scaleY(1) translateY(0); opacity:.9; }
            25%     { transform: scaleX(.9) scaleY(1.08) translateY(-4px); opacity:1; }
            50%     { transform: scaleX(1.05) scaleY(.95) translateY(2px); opacity:.85; }
            75%     { transform: scaleX(.95) scaleY(1.05) translateY(-3px); opacity:.95; }
          }
          @keyframes flicker2 {
            0%,100%{ transform: scaleX(1) scaleY(1) translateY(0) rotate(-2deg); opacity:.8; }
            33%     { transform: scaleX(.88) scaleY(1.1) translateY(-6px) rotate(2deg); opacity:.95; }
            66%     { transform: scaleX(1.08) scaleY(.92) translateY(3px) rotate(-1deg); opacity:.75; }
          }
          @keyframes flicker3 {
            0%,100%{ transform: scaleX(1) scaleY(1) translateY(0) rotate(1deg); opacity:.7; }
            40%     { transform: scaleX(.92) scaleY(1.12) translateY(-8px) rotate(-3deg); opacity:.9; }
            70%     { transform: scaleX(1.06) scaleY(.9) translateY(4px) rotate(2deg); opacity:.6; }
          }
          @keyframes emberRise {
            0%   { transform: translateY(0) translateX(0) scale(1); opacity:.9; }
            100% { transform: translateY(-220px) translateX(var(--ex,0)) scale(.1); opacity:0; }
          }
          @keyframes glowPulse {
            0%,100%{ opacity:.5; transform: scale(1); }
            50%     { opacity:.8; transform: scale(1.08); }
          }
          @keyframes waver {
            0%,100%{ transform: scaleX(1); }
            50%     { transform: scaleX(1.03); }
          }
          .fire-wrap {
            position: absolute;
            bottom: 0; left: 50%;
            transform: translateX(-50%);
            width: 220px; height: 320px;
            will-change: transform;
          }
          /* Base log glow */
          .fire-glow {
            position: absolute;
            bottom: 0; left: 50%;
            transform: translateX(-50%);
            width: 180px; height: 40px;
            background: radial-gradient(ellipse at 50% 100%, #ff6a00 0%, #ff3d00 30%, transparent 75%);
            border-radius: 50%;
            animation: glowPulse 1.6s ease-in-out infinite;
            will-change: transform, opacity;
          }
          /* Flame layers — each a round-top teardrop */
          .flame {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform-origin: center bottom;
            border-radius: 50% 50% 20% 20% / 60% 60% 40% 40%;
            will-change: transform, opacity;
          }
          .flame-1 {
            width: 100px; height: 200px;
            margin-left: -50px;
            background: linear-gradient(to top, #ff6a00, #ff9100 40%, #ffca28 80%, #fff9c4);
            animation: flicker1 1.1s ease-in-out infinite;
          }
          .flame-2 {
            width: 80px; height: 170px;
            margin-left: -40px;
            background: linear-gradient(to top, #ff3d00, #ff6d00 40%, #ffa000 80%, #ffe57f);
            animation: flicker2 1.4s ease-in-out infinite;
            opacity: .85;
          }
          .flame-3 {
            width: 55px; height: 130px;
            margin-left: -28px;
            background: linear-gradient(to top, #e64a19, #ff5722 40%, #ffc107 80%, #ffffff88);
            animation: flicker3 .9s ease-in-out infinite;
            opacity: .7;
          }
          /* Inner hot core */
          .flame-core {
            position: absolute;
            bottom: 30px;
            left: 50%;
            margin-left: -18px;
            width: 36px; height: 60px;
            background: linear-gradient(to top, #fff9c4, #fffde7, transparent);
            border-radius: 50% 50% 30% 30% / 60% 60% 40% 40%;
            animation: flicker1 .7s ease-in-out infinite reverse;
            will-change: transform, opacity;
          }
          /* Embers */
          .ember {
            position: absolute;
            bottom: 25px;
            width: 4px; height: 4px;
            border-radius: 50%;
            background: #ff6d00;
            will-change: transform, opacity;
          }
          .ember-1 { left: 95px;  animation: emberRise 2.0s ease-out infinite;       --ex:12px;  animation-delay:.1s;  }
          .ember-2 { left: 110px; animation: emberRise 2.5s ease-out infinite;       --ex:-18px; animation-delay:.7s;  background:#ffa000; }
          .ember-3 { left: 120px; animation: emberRise 1.8s ease-out infinite;       --ex:8px;   animation-delay:1.1s; }
          .ember-4 { left: 90px;  animation: emberRise 2.2s ease-out infinite;       --ex:-10px; animation-delay:1.6s; background:#ff3d00; width:3px;height:3px;}
          .ember-5 { left: 130px; animation: emberRise 2.8s ease-out infinite;       --ex:20px;  animation-delay:.4s;  width:3px;height:3px;}
          /* Floor log */
          .fire-log {
            position: absolute;
            bottom: 0; left: 50%;
            transform: translateX(-50%);
            width: 160px; height: 28px;
            background: linear-gradient(to bottom, #3e2723, #1a0f0a);
            border-radius: 50% 50% 10% 10% / 30% 30% 10% 10%;
            box-shadow: 0 4px 20px rgba(255,100,0,.4);
            animation: waver 3s ease-in-out infinite;
            will-change: transform;
          }
          /* Ground glow spread */
          .fire-ground {
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 120px;
            background: radial-gradient(ellipse at 50% 100%, rgba(255,100,0,.18) 0%, transparent 70%);
            will-change: opacity;
            animation: glowPulse 2s ease-in-out infinite .3s;
          }
          /* Label */
          .fire-label {
            position: absolute;
            bottom: 44px; left: 50%;
            transform: translateX(-50%);
            color: rgba(255,180,80,.6);
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 3px;
            text-transform: uppercase;
            white-space: nowrap;
            user-select: none;
            animation: glowPulse 2.4s ease-in-out infinite;
            will-change: opacity;
          }
        `}</style>

        {/* Ground radial glow */}
        <div className="fire-ground" />

        {/* Fire scene */}
        <div className="fire-wrap">
          {/* Ambient glow at base */}
          <div className="fire-glow" />

          {/* Flame layers (back → front) */}
          <div className="flame flame-1" />
          <div className="flame flame-2" />
          <div className="flame flame-3" />
          <div className="flame-core" />

          {/* Embers rising */}
          <div className="ember ember-1" />
          <div className="ember ember-2" />
          <div className="ember ember-3" />
          <div className="ember ember-4" />
          <div className="ember ember-5" />

          {/* Log */}
          <div className="fire-log" />
        </div>

        {/* Text */}
        <div style={{
          position: 'absolute', bottom: 90, left: 0, right: 0,
          textAlign: 'center', color: 'rgba(255,200,100,.5)',
          fontSize: 13, fontWeight: 600, letterSpacing: 2,
          textTransform: 'uppercase', userSelect: 'none'
        }}>
          Select a chat to begin
        </div>
      </div>
    );
  }

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
      if (onTyping) onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleChange = (e) => {
    setInputText(e.target.value);
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 1500);
    }
  };

  return (
    <div className="main-chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-user">
          <div className="chat-header-avatar">
            <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'500'}}>
              {activeContact.name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="chat-header-info">
            <h3>{activeContact.name}</h3>
            <span className="chat-header-status">
              {activeContact.isOnline ? 'online' : 'click here for contact info'}
            </span>
          </div>
        </div>
        <div className="chat-header-actions">
          <Search size={20} cursor="pointer" />
          <MoreVertical size={20} cursor="pointer" />
        </div>
      </div>

      {/* Messages */}
      <div className="messages-list-whatsapp">
        {messages.map((msg, idx) => {
          const isMine = msg.userId === currentUserId;
          const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={idx} className={`message-whatsapp ${isMine ? 'mine' : 'other'}`}>
              <div style={{ paddingBottom: '10px' }}>{msg.text}</div>
              <div className="message-whatsapp-time">{time}</div>
            </div>
          );
        })}
        {typingUsers.has(activeContact.uniqueId) && (
          <div className="message-whatsapp other" style={{ width: '80px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: '#8696a0', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></span>
              <span style={{ width: '6px', height: '6px', backgroundColor: '#8696a0', borderRadius: '50%', animation: 'pulse 1.5s infinite 0.2s' }}></span>
              <span style={{ width: '6px', height: '6px', backgroundColor: '#8696a0', borderRadius: '50%', animation: 'pulse 1.5s infinite 0.4s' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="input-area-whatsapp">
        <button className="input-icon-btn"><Smile size={24} /></button>
        <button className="input-icon-btn"><Paperclip size={24} /></button>
        <div className="input-wrapper">
          <input 
            type="text" 
            placeholder="Type a message" 
            value={inputText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
        </div>
        {inputText.trim() ? (
          <button className="input-icon-btn" onClick={handleSend}><Send size={24} color="#aebac1" /></button>
        ) : (
          <button className="input-icon-btn"><MoreVertical size={24} /></button>
        )}
      </div>
    </div>
  );
};

export default MainChat;
