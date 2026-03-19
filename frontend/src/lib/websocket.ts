/**
 * WebSocket client with auto-reconnect and event dispatching.
 *
 * Connects to the backend WebSocket endpoint at WS /ws/{token}.
 * Incoming messages are JSON objects: { type: string, data: object }.
 * Dispatches to registered listeners by event type.
 */

export type WebSocketEventCallback = (data: unknown) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<WebSocketEventCallback>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(baseUrl: string, token: string) {
    // Convert http(s) to ws(s)
    this.url = baseUrl
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://");
    this.token = token;
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.intentionalClose = false;

    try {
      this.ws = new WebSocket(`${this.url}/ws/${this.token}`);
    } catch (err) {
      console.error("[WebSocket] Failed to create connection:", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string) as {
          type: string;
          data: unknown;
        };
        this.dispatch(message.type, message.data);
      } catch (err) {
        console.error("[WebSocket] Failed to parse message:", err);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.warn("[WebSocket] Connection error — will retry", err);
      // onclose will fire after onerror, triggering reconnect
    };
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
  }

  /**
   * Register a listener for a specific event type.
   * Returns an unsubscribe function.
   */
  on(eventType: string, callback: WebSocketEventCallback): () => void {
    let callbacks = this.listeners.get(eventType);
    if (!callbacks) {
      callbacks = new Set();
      this.listeners.set(eventType, callbacks);
    }
    callbacks.add(callback);

    return () => {
      callbacks!.delete(callback);
      if (callbacks!.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * Send a JSON message to the server.
   */
  send(action: string, data?: object): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WebSocket] Cannot send — not connected");
      return;
    }
    this.ws.send(JSON.stringify({ action, data: data ?? {} }));
  }

  joinRoom(room: string): void {
    this.send("join_room", { room });
  }

  leaveRoom(room: string): void {
    this.send("leave_room", { room });
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private dispatch(eventType: string, data: unknown): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[WebSocket] Error in listener for "${eventType}":`, err);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[WebSocket] Max reconnect attempts reached. Giving up.");
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
