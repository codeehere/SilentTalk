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
      <div className="main-chat-container">
        <div className="empty-chat-state">
          <div className="action-buttons-container">
            <div className="action-tile">
              <div className="action-icon-box"><FileText size={32} /></div>
              <span className="action-label">Send document</span>
            </div>
            <div className="action-tile">
              <div className="action-icon-box"><UserPlus size={32} /></div>
              <span className="action-label">Add contact</span>
            </div>
            <div className="action-tile">
              <div className="action-icon-box" style={{ color: '#00a884' }}><Bot size={32} /></div>
              <span className="action-label">Ask Meta AI</span>
            </div>
          </div>
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
