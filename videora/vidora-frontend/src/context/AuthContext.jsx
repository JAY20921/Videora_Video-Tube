import React, { createContext, useState, useEffect, useContext } from "react";
import * as authApi from "../api/auth"; // use whatever your api exports

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Try to get current user if API provides it. Silent fail is fine.
  useEffect(() => {
    const fn = async () => {
      try {
        // prefer getCurrentUser or me
        const getCurrent = authApi.getCurrentUser || authApi.getCurrent || authApi.me || authApi.getUser;
        if (getCurrent) {
          const res = await getCurrent();
          // backend might return { user } or user object directly
          setUser(res?.user ?? res?.data ?? res);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fn();
  }, []);

  const handleLogout = async () => {
    try {
      if (authApi.logout) await authApi.logout();
    } catch (e) {
      // ignore
    }
    localStorage.removeItem("accessToken");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
