import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from "react";
import * as authApi from "../api/auth"; // import your auth API functions

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch the current user when the app loads
  useEffect(() => {
    let isMounted = true;
    const fetchCurrentUser = async () => {
      try {
        if (authApi.getCurrentUser) {
          const res = await authApi.getCurrentUser();
          // Backend may return { user } or the user object directly
          if (isMounted) {
            setUser(res?.user ?? res?.data ?? res);
          }
        }
      } catch {
        if (isMounted) setUser(null); // silent fail
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCurrentUser();
    return () => {
      isMounted = false;
    };
  }, []);

  // Logout function
  const handleLogout = useCallback(async () => {
    try {
      if (authApi.logout) await authApi.logout();
    } catch {
      // ignore errors
    }
    localStorage.removeItem("accessToken");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, loading, handleLogout }),
    [user, loading, handleLogout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context easily
export const useAuth = () => useContext(AuthContext);

export default AuthContext;
