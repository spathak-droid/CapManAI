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
  const clientRef = useRef<WebSocketClient | null>(null);
  // Track connection status via polling since WebSocket doesn't emit state-change events to React
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const apiUrl = getApiBaseUrl();
    if (!apiUrl) return;

    const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
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

      if (!firebaseUser) return;

      try {
        const token = await firebaseUser.getIdToken();
        const client = new WebSocketClient(apiUrl, token);
        clientRef.current = client;
        client.connect();

        // Poll connection status every 2 seconds to keep React state in sync
        pollRef.current = setInterval(() => {
          setIsConnected(client.isConnected);
        }, 2000);

        // Also set immediately after a short delay to catch the initial connect
        setTimeout(() => setIsConnected(client.isConnected), 500);
      } catch (err) {
        console.error("[Realtime] Failed to initialize WebSocket:", err);
      }
    });

    return () => {
      unsubscribeAuth();
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const subscribe = useCallback(
    (eventType: string, callback: WebSocketEventCallback): (() => void) => {
      const client = clientRef.current;
      if (!client) {
        // Return no-op unsubscribe if not connected
        return () => {};
      }
      return client.on(eventType, callback);
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
