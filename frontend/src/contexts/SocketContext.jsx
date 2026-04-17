import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('st_token') || localStorage.getItem('token');
    const API = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

    const newSocket = io(API, {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });
    setSocket(newSocket);

    newSocket.on('user:online', ({ userId }) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    });
    newSocket.on('user:offline', ({ userId }) => {
      setOnlineUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [user]);

  const emit = (...args) => socket?.emit(...args);
  const on = (event, cb) => { socket?.on(event, cb); };
  const off = (event, cb) => { socket?.off(event, cb); };
  const joinGroups = (groupIds) => emit('join:groups', groupIds);

  return (
    <SocketContext.Provider value={{ socket, emit, on, off, onlineUsers, joinGroups }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
