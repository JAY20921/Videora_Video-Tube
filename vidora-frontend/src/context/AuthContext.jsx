import React, { createContext, useState, useEffect, useContext } from "react";
import * as authApi from "../api/auth"; // import your auth API functions

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch the current user when the app loads
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        if (authApi.getCurrentUser) {
          const res = await authApi.getCurrentUser();
          // Backend may return { user } or the user object directly
          setUser(res?.user ?? res?.data ?? res);
        }
      } catch (err) {
        setUser(null); // silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  // Logout function
  const handleLogout = async () => {
    try {
      if (authApi.logout) await authApi.logout();
    } catch (err) {
      // ignore errors
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

// Hook to use auth context easily
export const useAuth = () => useContext(AuthContext);

export default AuthContext;
