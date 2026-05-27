import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface ApiStatusUpdate {
  api_id: string;
  api_name: string;
  status: string;
  latency_ms: number;
  status_code: number | null;
  timestamp: string;
}

interface LogUpdate {
  id: string;
  api_id: string;
  user_id: string;
  status: string;
  status_code: number | null;
  latency_ms: number;
  error_message: string;
  checked_at: string;
}

interface DiagnosisData {
  id: string;
  api_id: string;
  diagnosis: string;
  severity: string;
  confidence: number;
  suggested_fix: string;
  recommended_action: string;
  provider_used: string;
  created_at: string;
}

interface RecoveryData {
  api_id: string;
  api_name: string;
  latency_ms: number;
  timestamp: string;
}

interface FailureData {
  api_id: string;
  api_name: string;
  error_message: string;
  latency_ms: number;
  status_code: number | null;
  timestamp: string;
}

interface TickerPingData {
  ticker_id: string;
  ticker_name: string;
  status: string;
  latency_ms: number;
  timestamp: string;
}

interface UseRealtimeOptions {
  onApiStatusUpdate?: (data: ApiStatusUpdate) => void;
  onNewLog?: (data: LogUpdate) => void;
  onDiagnosis?: (data: DiagnosisData) => void;
  onFailure?: (data: FailureData) => void;
  onRecovery?: (data: RecoveryData) => void;
  onTickerPing?: (data: TickerPingData) => void;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const [apiStatus, setApiStatus] = useState<Map<string, ApiStatusUpdate>>(new Map());
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel('realtime-updates');

    channel
      .on('broadcast', { event: 'api_status_update' }, (payload) => {
        const data = payload.payload as ApiStatusUpdate;
        setApiStatus((prev) => {
          const next = new Map(prev);
          next.set(data.api_id, data);
          return next;
        });
        options.onApiStatusUpdate?.(data);
      })
      .on('broadcast', { event: 'new_log' }, (payload) => {
        options.onNewLog?.(payload.payload as LogUpdate);
      })
      .on('broadcast', { event: 'failure_detected' }, (payload) => {
        options.onFailure?.(payload.payload as FailureData);
      })
      .on('broadcast', { event: 'recovery_detected' }, (payload) => {
        options.onRecovery?.(payload.payload as RecoveryData);
      })
      .on('broadcast', { event: 'diagnosis_generated' }, (payload) => {
        options.onDiagnosis?.(payload.payload as DiagnosisData);
      })
      .on('broadcast', { event: 'ticker_ping' }, (payload) => {
        options.onTickerPing?.(payload.payload as TickerPingData);
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const broadcast = useCallback((event: string, payload: unknown) => {
    channelRef.current?.send({
      type: 'broadcast',
      event,
      payload,
    });
  }, []);

  return {
    connected,
    apiStatus,
    broadcast,
  };
}

export function useWebSocketRealtime(options: UseRealtimeOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());

  const connect = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const wsUrl = `${apiUrl.replace('http', 'ws')}/ws/logs?token=${session.access_token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setReconnectAttempt(0);
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (reconnectAttempt < 5) {
        setTimeout(() => {
          setReconnectAttempt((p) => p + 1);
          connect();
        }, 3000 * (reconnectAttempt + 1));
      }
    };

    ws.onerror = () => {
      console.error('[WS] Connection error');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type && msg.data) {
          const callbacks = listenersRef.current.get(msg.type);
          callbacks?.forEach((cb) => cb(msg.data));
        }
        const allCallbacks = listenersRef.current.get('*');
        allCallbacks?.forEach((cb) => cb(msg));
      } catch {
        // Ignore parse errors for heartbeats
      }
    };
  }, [reconnectAttempt]);

  const subscribe = useCallback((type: string, callback: (data: unknown) => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(callback);
    return () => {
      listenersRef.current.get(type)?.delete(callback);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

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
    subscribe,
  };
}

export type {
  ApiStatusUpdate,
  LogUpdate,
  DiagnosisData,
  RecoveryData,
  FailureData,
  TickerPingData,
};
