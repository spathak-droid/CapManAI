"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBaseUrl } from "@/lib/api";
import { WebSocketClient, type WebSocketEventCallback } from "@/lib/websocket";

interface RealtimeContextType {
  isConnected: boolean;
  subscribe: (eventType: string, callback: WebSocketEventCallback) => () => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const clientRef = useRef<WebSocketClient | null>(null);
  // Pending subscriptions registered before WebSocket connects
  const pendingListenersRef = useRef<Map<string, Set<WebSocketEventCallback>>>(new Map());
  // Track connection status via polling since WebSocket doesn't emit state-change events to React
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const apiUrl = getApiBaseUrl();
    if (!apiUrl) return;

    // Tear down existing connection
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
      setIsConnected(false);
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    // Only connect when the backend user exists (not just Firebase)
    if (!user) return;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    (async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const client = new WebSocketClient(apiUrl, token);
        clientRef.current = client;

        // Replay any pending subscriptions registered before client was ready
        for (const [eventType, callbacks] of pendingListenersRef.current) {
          for (const cb of callbacks) {
            client.on(eventType, cb);
          }
        }
        pendingListenersRef.current.clear();

        client.connect();

        pollRef.current = setInterval(() => {
          setIsConnected(client.isConnected);
        }, 10000);

        setTimeout(() => setIsConnected(client.isConnected), 500);
      } catch {
        console.warn("[Realtime] WebSocket unavailable — real-time features disabled");
      }
    })();

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [user]);

  const subscribe = useCallback(
    (eventType: string, callback: WebSocketEventCallback): (() => void) => {
      const client = clientRef.current;
      if (client) {
        return client.on(eventType, callback);
      }

      // Client not ready yet — queue the listener for replay when it connects
      let pending = pendingListenersRef.current.get(eventType);
      if (!pending) {
        pending = new Set();
        pendingListenersRef.current.set(eventType, pending);
      }
      pending.add(callback);

      return () => {
        const p = pendingListenersRef.current.get(eventType);
        if (p) {
          p.delete(callback);
          if (p.size === 0) pendingListenersRef.current.delete(eventType);
        }
      };
    },
    [],
  );

  const joinRoom = useCallback((room: string) => {
    clientRef.current?.joinRoom(room);
  }, []);

  const leaveRoom = useCallback((room: string) => {
    clientRef.current?.leaveRoom(room);
  }, []);

  return (
    <RealtimeContext.Provider value={{ isConnected, subscribe, joinRoom, leaveRoom }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}
