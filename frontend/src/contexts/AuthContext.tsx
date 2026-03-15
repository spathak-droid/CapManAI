"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { AuthUser } from "@/lib/types";
import { fetchCurrentUser, fetchCurrentUserWithToken, updateProfile } from "@/lib/api";

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
  // Skip onAuthStateChanged fetch when login/register is handling it
  const skipNextAuthChange = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (skipNextAuthChange.current) {
        skipNextAuthChange.current = false;
        return;
      }
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
    skipNextAuthChange.current = true;
    const credential = await signInWithEmailAndPassword(auth, email, password);
    document.cookie =
      "auth_session=true; path=/; max-age=604800; SameSite=Lax";
    try {
      const token = await credential.user.getIdToken();
      const backendUser = await fetchCurrentUserWithToken(token);
      setUser(backendUser);
      setLoading(false);
    } catch (err) {
      console.error("Backend sync failed:", err);
      document.cookie = "auth_session=; path=/; max-age=0";
      await signOut(auth);
      setUser(null);
      setLoading(false);
      throw new Error("Could not sync with server. Check backend and try again.");
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, role: string, name: string) => {
      skipNextAuthChange.current = true;
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const token = await credential.user.getIdToken();
      await fetchCurrentUserWithToken(token);
      const updated = await updateProfile({ name, role });
      setUser(updated);
      setLoading(false);
    },
    [],
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
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
