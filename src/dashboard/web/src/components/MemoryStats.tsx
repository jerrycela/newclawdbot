"use client";

import { Brain, Lightbulb, Target, CheckSquare, MessageSquare, Heart, Sparkles } from "lucide-react";
import { clsx } from "clsx";

interface MemoryStatsProps {
  stats: {
    fact: number;
    goal: number;
    todo: number;
    conversation: number;
    preference: number;
    insight: number;
    total: number;
  };
}

const categoryConfig = {
  fact: { icon: Lightbulb, color: "text-blue-400", label: "Facts" },
  goal: { icon: Target, color: "text-green-400", label: "Goals" },
  todo: { icon: CheckSquare, color: "text-yellow-400", label: "Todos" },
  conversation: { icon: MessageSquare, color: "text-purple-400", label: "Conversations" },
  preference: { icon: Heart, color: "text-pink-400", label: "Preferences" },
  insight: { icon: Sparkles, color: "text-orange-400", label: "Insights" },
};

export function MemoryStats({ stats }: MemoryStatsProps) {
  const categories = Object.entries(categoryConfig) as [
    keyof typeof categoryConfig,
    (typeof categoryConfig)[keyof typeof categoryConfig]
  ][];

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Memory Bank</h2>
        </div>
        <span className="text-xs text-foreground-muted">
          {stats.total} total
        </span>
      </div>

      {/* Stats grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {categories.map(([key, config]) => {
          const Icon = config.icon;
          const count = stats[key];
          const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;

          return (
            <div
              key={key}
              className="flex items-center gap-3 p-2 rounded-lg bg-surface-hover"
            >
              <div
                className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  "bg-background"
                )}
              >
                <Icon className={clsx("w-4 h-4", config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground-muted">
                    {config.label}
                  </span>
                  <span className="text-sm font-mono font-medium text-foreground">
                    {count}
                  </span>
                </div>
                <div className="mt-1 h-1 bg-background rounded-full overflow-hidden">
                  <div
                    className={clsx("h-full rounded-full", config.color.replace("text-", "bg-"))}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
