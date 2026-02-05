"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface ClaudeEvent {
  timestamp: number;
  type: "READ" | "WRITE" | "TOOL" | "SEARCH" | "MCP" | "SYSTEM";
  tool?: string;
  summary: string;
  sessionId?: string;
}

export interface HealthStatus {
  telegram: { status: "online" | "offline"; lastPing?: string };
  supabase: { status: "connected" | "disconnected"; latency: number };
  claude: { status: "ready" | "busy" | "error"; queueLength?: number };
  uptime: number;
  todayCost: number;
}

interface UseWebSocketOptions {
  url: string;
  onEvent?: (event: ClaudeEvent) => void;
  onHealth?: (health: HealthStatus) => void;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    onEvent,
    onHealth,
    reconnectInterval = 3000,
    heartbeatInterval = 30000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setReconnectAttempt(0);

        // Start heartbeat
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, heartbeatInterval);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "pong") {
            return;
          }
          if (data.type === "health" && onHealth) {
            onHealth(data.payload);
          } else if (data.type === "event" && onEvent) {
            onEvent(data.payload);
          } else if (onEvent && data.timestamp) {
            // Direct event format
            onEvent(data);
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        // Exponential backoff reconnection
        const delay = Math.min(
          reconnectInterval * Math.pow(2, reconnectAttempt),
          30000
        );
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempt((prev) => prev + 1);
          connect();
        }, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.error("WebSocket connection error:", e);
    }
  }, [url, onEvent, onHealth, reconnectInterval, heartbeatInterval, reconnectAttempt]);

  useEffect(() => {
    connect();

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, reconnectAttempt };
}
