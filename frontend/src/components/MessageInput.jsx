import { useState, useRef } from 'react';
import { SendHorizontal } from 'lucide-react';

const MessageInput = ({ onSendMessage, onTyping }) => {
  const [inputText, setInputText] = useState('');
  const typingTimeoutRef = useRef(null);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
      if (onTyping) onTyping(false); // Stop typing immediately on send
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleChange = (e) => {
    setInputText(e.target.value);

    // Emit typing status
    if (onTyping) {
      onTyping(true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      // Set new timeout to stop typing after 1.5s of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 1500);
    }
  };

  return (
    <div className="input-area">
      <input
        type="text"
        className="chat-input"
        placeholder="Type a message..."
        value={inputText}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <button 
        className="send-button"
        onClick={handleSend}
        disabled={!inputText.trim()}
      >
        <SendHorizontal size={24} />
      </button>
    </div>
  );
};

export default MessageInput;
