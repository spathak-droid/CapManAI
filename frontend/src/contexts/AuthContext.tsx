"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { mutate } from "swr";
import { auth } from "@/lib/firebase";
import type { AuthUser } from "@/lib/types";
import { fetchCurrentUser, updateProfile } from "@/lib/api";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // onAuthStateChanged is the SINGLE source of truth for auth state.
  // login/register set user optimistically, but this always runs as backup.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        document.cookie =
          "auth_session=true; path=/; max-age=604800; SameSite=Lax";
        try {
          const backendUser = await fetchCurrentUser();
          setUser(backendUser);
        } catch {
          setUser(null);
        }
      } else {
        document.cookie = "auth_session=; path=/; max-age=0";
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will fire and set user/loading
  }, []);

  const register = useCallback(
    async (email: string, password: string, role: string, name: string) => {
      await createUserWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged fires here → creates DB user via fetchCurrentUser
      // Wait a moment for it to complete, then update profile
      const backendUser = await fetchCurrentUser();
      const updated = await updateProfile({ name, role });
      setUser(updated);
    },
    [],
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    await mutate(() => true, undefined, { revalidate: false });
  }, []);

  const refetchUser = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const backendUser = await fetchCurrentUser();
      setUser(backendUser);
    } catch {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
