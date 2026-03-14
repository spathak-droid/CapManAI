"use client";

import { useEffect, useRef } from "react";
import { useRealtime } from "@/contexts/RealtimeContext";
import type { WebSocketEventCallback } from "@/lib/websocket";

/**
 * Custom hook for subscribing to a realtime WebSocket event.
 * Automatically subscribes on mount and unsubscribes on unmount.
 *
 * @param eventType - The event type to listen for (e.g. "leaderboard_update")
 * @param callback - Handler called with the event data
 */
export function useRealtimeEvent(
  eventType: string,
  callback: WebSocketEventCallback,
): void {
  const { subscribe } = useRealtime();
  const callbackRef = useRef(callback);

  // Keep callback ref up to date without re-subscribing
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const unsubscribe = subscribe(eventType, (data: unknown) => {
      callbackRef.current(data);
    });
    return unsubscribe;
  }, [eventType, subscribe]);
}
