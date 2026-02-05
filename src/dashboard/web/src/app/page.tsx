"use client";

import { useState, useCallback, useEffect } from "react";
import { StatusBar } from "@/components/StatusBar";
import { LiveFeed } from "@/components/LiveFeed";
import { ActiveGoals } from "@/components/ActiveGoals";
import { MemoryStats } from "@/components/MemoryStats";
import { ToolUsage } from "@/components/ToolUsage";
import { useWebSocket, type ClaudeEvent, type HealthStatus } from "@/hooks/useWebSocket";
import { Bot } from "lucide-react";

// Mock data for demonstration
const mockGoals = [
  {
    id: "1",
    title: "Complete MVP implementation",
    description: "Finish the core functionality of Clawdbot",
    status: "active" as const,
    priority: 9,
    deadline: "2025-02-15",
  },
  {
    id: "2",
    title: "Write documentation",
    status: "active" as const,
    priority: 6,
  },
  {
    id: "3",
    title: "Set up CI/CD pipeline",
    status: "paused" as const,
    priority: 5,
  },
];

const mockMemoryStats = {
  fact: 45,
  goal: 12,
  todo: 8,
  conversation: 156,
  preference: 23,
  insight: 17,
  total: 261,
};

const mockToolUsage = [
  { name: "Read", count: 234, category: "read" as const },
  { name: "Edit", count: 89, category: "write" as const },
  { name: "Grep", count: 67, category: "search" as const },
  { name: "Glob", count: 45, category: "search" as const },
  { name: "Bash", count: 34, category: "write" as const },
  { name: "Write", count: 28, category: "write" as const },
  { name: "WebFetch", count: 12, category: "mcp" as const },
];

export default function Dashboard() {
  const [events, setEvents] = useState<ClaudeEvent[]>([]);
  const [health, setHealth] = useState<HealthStatus>({
    telegram: { status: "offline" },
    supabase: { status: "disconnected", latency: -1 },
    claude: { status: "ready" },
    uptime: 0,
    todayCost: 0,
  });
  const [goals] = useState(mockGoals);
  const [startTime] = useState(Date.now());
  const [currentUptime, setCurrentUptime] = useState(0);

  // Update uptime every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentUptime(Date.now() - startTime + (health.uptime || 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, health.uptime]);

  const handleEvent = useCallback((event: ClaudeEvent) => {
    setEvents((prev) => [...prev.slice(-499), event]);
  }, []);

  const handleHealth = useCallback((newHealth: HealthStatus) => {
    setHealth(newHealth);
  }, []);

  // Determine WebSocket URL based on environment
  const wsUrl =
    typeof window !== "undefined"
      ? `ws://${window.location.hostname}:8081`
      : "ws://localhost:8081";

  const { isConnected } = useWebSocket({
    url: wsUrl,
    onEvent: handleEvent,
    onHealth: handleHealth,
  });

  // Add some demo events for development
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && events.length === 0) {
      const demoEvents: ClaudeEvent[] = [
        {
          timestamp: Date.now() - 30000,
          type: "SYSTEM",
          summary: "Dashboard connected",
        },
        {
          timestamp: Date.now() - 25000,
          type: "READ",
          tool: "Read",
          summary: "src/index.ts",
        },
        {
          timestamp: Date.now() - 20000,
          type: "SEARCH",
          tool: "Grep",
          summary: 'Searching for "handleMessage"',
        },
        {
          timestamp: Date.now() - 15000,
          type: "TOOL",
          tool: "Bash",
          summary: "bun run typecheck",
        },
        {
          timestamp: Date.now() - 10000,
          type: "WRITE",
          tool: "Edit",
          summary: "src/gateway/claude-bridge.ts - Fixed type error",
        },
        {
          timestamp: Date.now() - 5000,
          type: "MCP",
          tool: "memory-store",
          summary: "Stored user preference",
        },
      ];
      setEvents(demoEvents);
    }
  }, [events.length]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Clawdbot Dashboard
            </h1>
            <p className="text-xs text-foreground-muted">
              Real-time monitoring & control
            </p>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <StatusBar
        telegramStatus={health.telegram.status}
        supabaseStatus={health.supabase.status}
        claudeStatus={health.claude.status}
        uptime={currentUptime}
        todayCost={health.todayCost}
        isWebSocketConnected={isConnected}
      />

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Left Column: Live Feed */}
          <div className="lg:col-span-2 min-h-[500px]">
            <LiveFeed events={events} />
          </div>

          {/* Right Column: Panels */}
          <div className="space-y-6">
            <ActiveGoals goals={goals} />
            <MemoryStats stats={mockMemoryStats} />
            <ToolUsage tools={mockToolUsage} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-border px-6 py-3">
        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span>Clawdbot v1.0.0</span>
          <span>
            WebSocket: {isConnected ? "Connected" : "Disconnected"} | Last
            update: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </footer>
    </div>
  );
}
