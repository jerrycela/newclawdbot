"use client";

import { useState, useEffect, useCallback } from "react";

export interface ToolUsage {
  name: string;
  count: number;
  category: "read" | "write" | "search" | "tool" | "mcp" | "system";
}

export interface MemoryStats {
  total: number;
  byType: Record<string, number>;
}

export interface DashboardStats {
  goals: {
    total: number;
    active: number;
    completed: number;
  };
  memory: MemoryStats;
  today: {
    messages: number;
    toolCalls: number;
  };
  topTools: ToolUsage[];
}

interface UseStatsOptions {
  apiUrl: string;
  apiKey?: string;
  refreshInterval?: number; // in milliseconds
}

interface UseStatsReturn {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const defaultStats: DashboardStats = {
  goals: { total: 0, active: 0, completed: 0 },
  memory: { total: 0, byType: {} },
  today: { messages: 0, toolCalls: 0 },
  topTools: [],
};

export function useStats(options: UseStatsOptions): UseStatsReturn {
  const { apiUrl, apiKey, refreshInterval = 30000 } = options;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }
    return headers;
  }, [apiKey]);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${apiUrl}/api/stats`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data) {
        setStats(data.data);
      } else {
        setStats(defaultStats);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Failed to fetch stats:", err);
      // Keep previous stats on error
      if (!stats) {
        setStats(defaultStats);
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, getHeaders, stats]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, []);

  // Periodic refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStats, refreshInterval]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
}
