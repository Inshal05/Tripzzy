import React, { createContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // ⚡ Use the base URL WITHOUT the "/api" suffix if your backend serves both REST + socket
    const baseURL = import.meta.env.VITE_BASE_URL.replace(/\/api$/, '');

    // ✅ Configure the socket
    const socketInstance = io(baseURL, {
      path: '/socket.io',               // Important for Render/WebSocket proxy
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 15000,
      withCredentials: true,
    });

    socketInstance.on('connect', () => {
      console.log('✅ Connected to Socket Server:', socketInstance.id);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message);
    });

    socketInstance.on('disconnect', (reason) => {
      console.warn('⚠️ Socket disconnected:', reason);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
