import { useCallback, useState } from 'react';

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
  } = options;

  const [isConnected] = useState(false);
  const listenersRef = new Map<string, Set<EventCallback>>();

  const subscribe = useCallback((eventType: string, callback: EventCallback) => {
    if (!listenersRef.has(eventType)) {
      listenersRef.set(eventType, new Set());
    }
    listenersRef.get(eventType)!.add(callback);
    return () => {
      listenersRef.get(eventType)?.delete(callback);
    };
  }, []);

  const send = useCallback((data: Record<string, unknown>) => {
    console.log('WebSocket disabled - message not sent:', data);
  }, []);

  return {
    isConnected,
    connect: onConnect || (() => {}),
    disconnect: () => {},
    subscribe,
    send,
  };
}
