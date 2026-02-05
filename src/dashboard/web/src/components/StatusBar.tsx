"use client";

import { clsx } from "clsx";
import {
  Bot,
  Database,
  Brain,
  Clock,
  DollarSign,
  Wifi,
  WifiOff,
} from "lucide-react";

interface StatusBarProps {
  telegramStatus: "online" | "offline";
  supabaseStatus: "connected" | "disconnected";
  claudeStatus: "ready" | "busy" | "error";
  uptime: number;
  todayCost: number;
  isWebSocketConnected: boolean;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

function StatusIndicator({
  status,
  label,
}: {
  status: "online" | "offline" | "connected" | "disconnected" | "ready" | "busy" | "error";
  label: string;
}) {
  const isGood =
    status === "online" || status === "connected" || status === "ready";
  const isBusy = status === "busy";

  return (
    <div className="flex items-center gap-2">
      <div
        className={clsx(
          "w-2 h-2 rounded-full",
          isGood && "bg-success status-pulse",
          isBusy && "bg-warning status-pulse",
          !isGood && !isBusy && "bg-error"
        )}
      />
      <span className="text-xs text-foreground-muted uppercase tracking-wide">
        {label}
      </span>
      <span
        className={clsx(
          "text-xs font-medium",
          isGood && "text-success",
          isBusy && "text-warning",
          !isGood && !isBusy && "text-error"
        )}
      >
        {status}
      </span>
    </div>
  );
}

export function StatusBar({
  telegramStatus,
  supabaseStatus,
  claudeStatus,
  uptime,
  todayCost,
  isWebSocketConnected,
}: StatusBarProps) {
  return (
    <div className="bg-surface border-b border-border px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Connection Status */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            {isWebSocketConnected ? (
              <Wifi className="w-4 h-4 text-success" />
            ) : (
              <WifiOff className="w-4 h-4 text-error" />
            )}
            <span className="text-sm text-foreground-muted">
              {isWebSocketConnected ? "Live" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Center: Service Status */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <StatusIndicator status={telegramStatus} label="Telegram" />
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <StatusIndicator status={supabaseStatus} label="Supabase" />
          </div>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <StatusIndicator status={claudeStatus} label="Claude" />
          </div>
        </div>

        {/* Right: Metrics */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted" />
            <span className="text-sm text-foreground-muted">Uptime:</span>
            <span className="text-sm font-mono text-foreground">
              {formatUptime(uptime)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted" />
            <span className="text-sm text-foreground-muted">Today:</span>
            <span className="text-sm font-mono text-foreground">
              ${todayCost.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
