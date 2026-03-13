/**
 * useHoneySocket.js
 * React hook for connecting to HoneyVault's real-time WebSocket feed
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export function useHoneySocket(onEvent) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  const connect = useCallback(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to HoneyVault');
        setConnected(true);
        setReconnectCount(0);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onEventRef.current?.(data);
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('[WS] Disconnected — reconnecting in 3s...');
        setTimeout(() => {
          setReconnectCount(c => c + 1);
        }, 3000);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
      };
    } catch (e) {
      console.error('[WS] Failed to connect:', e);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect, reconnectCount]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, send };
}
