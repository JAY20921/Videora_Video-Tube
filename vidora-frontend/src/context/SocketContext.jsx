import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth(); // If we need to send user info with connections

  useEffect(() => {
    // Connect to the backend
    // Since frontend proxies /api to backend, we can just connect to the current origin
    // or point directly to the backend URL if we have it in an env var.
    // In dev, the Vite proxy handles /api, but websockets usually go to a direct port.
    // Assuming backend is at http://localhost:8000 in dev
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
    
    const newSocket = io(backendUrl, {
      withCredentials: true,
      autoConnect: false,
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
