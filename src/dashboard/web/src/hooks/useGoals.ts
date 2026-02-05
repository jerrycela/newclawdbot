"use client";

import { useState, useEffect, useCallback } from "react";

export interface Goal {
  id: string;
  title: string;
  description?: string;
  status: "active" | "completed" | "paused";
  deadline?: string;
  priority: number;
  createdAt?: string;
  completedAt?: string;
}

interface UseGoalsOptions {
  apiUrl: string;
  apiKey?: string;
}

interface UseGoalsReturn {
  goals: Goal[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  toggleStatus: (id: string, newStatus: Goal["status"]) => Promise<void>;
  createGoal: (goal: Omit<Goal, "id" | "createdAt" | "completedAt">) => Promise<void>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

export function useGoals(options: UseGoalsOptions): UseGoalsReturn {
  const { apiUrl, apiKey } = options;
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }
    return headers;
  }, [apiKey]);

  const fetchGoals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${apiUrl}/api/goals`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch goals: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setGoals(data.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Failed to fetch goals:", err);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, getHeaders]);

  const toggleStatus = useCallback(
    async (id: string, newStatus: Goal["status"]) => {
      try {
        const response = await fetch(`${apiUrl}/api/goals/${id}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update goal: ${response.status}`);
        }

        // Optimistic update
        setGoals((prev) =>
          prev.map((g) => (g.id === id ? { ...g, status: newStatus } : g))
        );
      } catch (err) {
        console.error("Failed to toggle goal status:", err);
        // Refetch on error to sync state
        await fetchGoals();
      }
    },
    [apiUrl, getHeaders, fetchGoals]
  );

  const createGoal = useCallback(
    async (goal: Omit<Goal, "id" | "createdAt" | "completedAt">) => {
      try {
        const response = await fetch(`${apiUrl}/api/goals`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(goal),
        });

        if (!response.ok) {
          throw new Error(`Failed to create goal: ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.data) {
          setGoals((prev) => [...prev, data.data]);
        }
      } catch (err) {
        console.error("Failed to create goal:", err);
        throw err;
      }
    },
    [apiUrl, getHeaders]
  );

  const updateGoal = useCallback(
    async (id: string, updates: Partial<Goal>) => {
      try {
        const response = await fetch(`${apiUrl}/api/goals/${id}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error(`Failed to update goal: ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.data) {
          setGoals((prev) =>
            prev.map((g) => (g.id === id ? data.data : g))
          );
        }
      } catch (err) {
        console.error("Failed to update goal:", err);
        throw err;
      }
    },
    [apiUrl, getHeaders]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`${apiUrl}/api/goals/${id}`, {
          method: "DELETE",
          headers: getHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Failed to delete goal: ${response.status}`);
        }

        setGoals((prev) => prev.filter((g) => g.id !== id));
      } catch (err) {
        console.error("Failed to delete goal:", err);
        throw err;
      }
    },
    [apiUrl, getHeaders]
  );

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return {
    goals,
    isLoading,
    error,
    refetch: fetchGoals,
    toggleStatus,
    createGoal,
    updateGoal,
    deleteGoal,
  };
}
