import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const socketRef = useRef(null);

  const connect = (token) => {
    // Disconnect existing socket before creating a new one
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const API = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

    const newSocket = io(API, {
      auth: { token },
      reconnectionAttempts: Infinity,      // Keep retrying indefinitely
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,         // Cap at 10 s between retries
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('user:online', ({ userId }) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    });
    newSocket.on('user:offline', ({ userId }) => {
      setOnlineUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
    });

    return newSocket;
  };

  // Initial connection when user logs in
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const token = localStorage.getItem('st_token') || localStorage.getItem('token');
    const s = connect(token);

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Re-authenticate the socket whenever AuthContext silently refreshes the token.
  // Without this, the socket keeps the old expired JWT and can't reconnect after
  // the 15-minute access token window closes.
  useEffect(() => {
    const handleTokenRefreshed = (e) => {
      const newToken = e.detail?.token;
      if (!newToken || !socketRef.current) return;
      // Update the socket's auth token and force a reconnect
      socketRef.current.auth = { token: newToken };
      if (!socketRef.current.connected) {
        socketRef.current.connect();
      }
    };

    window.addEventListener('st:token_refreshed', handleTokenRefreshed);
    return () => window.removeEventListener('st:token_refreshed', handleTokenRefreshed);
  }, []);

  const emit = (...args) => socketRef.current?.emit(...args);
  const on = (event, cb) => { socketRef.current?.on(event, cb); };
  const off = (event, cb) => { socketRef.current?.off(event, cb); };
  const joinGroups = (groupIds) => emit('join:groups', groupIds);

  return (
    <SocketContext.Provider value={{ socket, emit, on, off, onlineUsers, joinGroups }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
