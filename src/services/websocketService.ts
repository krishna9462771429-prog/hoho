import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

type EventCallback = (data: Record<string, unknown>) => void;

interface UseWebSocketOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());

  const getWsUrl = useCallback(async () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return `${apiUrl.replace('http', 'ws')}/ws/logs?token=${token}`;
  }, []);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = await getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      console.log('[WebSocket] Connected');
      onConnect?.();
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('[WebSocket] Disconnected');
      onDisconnect?.();

      if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        console.log(`[WebSocket] Reconnecting (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
        reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      onError?.(error);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;
        const callbacks = listenersRef.current.get(type);
        if (callbacks) {
          callbacks.forEach((cb) => cb(data || message));
        }
        const allCallbacks = listenersRef.current.get('*');
        if (allCallbacks) {
          allCallbacks.forEach((cb) => cb(data || message));
        }
      } catch (err) {
        console.error('[WebSocket] Parse error:', err);
      }
    };
  }, [getWsUrl, autoReconnect, reconnectDelay, maxReconnectAttempts, onConnect, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const subscribe = useCallback((eventType: string, callback: EventCallback) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType)!.add(callback);
    return () => {
      listenersRef.current.get(eventType)?.delete(callback);
    };
  }, []);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    isConnected,
    connect,
    disconnect,
    subscribe,
    send,
  };
}
