import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  ADMIN_SESSION_STORAGE_KEY,
  ADMIN_USERS_COLLECTION,
  AdminUser,
  AdminUserRecord,
  hashPassword,
  normalizeUsername,
} from "../adminAuth";

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);

    if (session) {
      try {
        setUser(JSON.parse(session) as AdminUser);
      } catch {
        window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      }
    }

    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const normalizedUsername = normalizeUsername(username);
    const accountRef = doc(db, ADMIN_USERS_COLLECTION, normalizedUsername);
    const accountSnapshot = await getDoc(accountRef);

    if (!accountSnapshot.exists()) {
      throw new Error("Invalid username or password.");
    }

    const account = accountSnapshot.data() as AdminUserRecord;
    const passwordHash = await hashPassword(password);

    if (account.passwordHash !== passwordHash) {
      throw new Error("Invalid username or password.");
    }

    const sessionUser: AdminUser = {
      username: account.username,
      role: "admin",
    };

    setUser(sessionUser);
    window.localStorage.setItem(
      ADMIN_SESSION_STORAGE_KEY,
      JSON.stringify(sessionUser),
    );
  };

  const logout = async () => {
    window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
