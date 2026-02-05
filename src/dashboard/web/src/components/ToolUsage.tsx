"use client";

import { Wrench } from "lucide-react";
import { clsx } from "clsx";

interface ToolUsageProps {
  tools: Array<{
    name: string;
    count: number;
    category: "read" | "write" | "search" | "tool" | "mcp" | "system";
  }>;
}

const categoryColors: Record<string, string> = {
  read: "bg-blue-500",
  write: "bg-green-500",
  search: "bg-yellow-500",
  tool: "bg-purple-500",
  mcp: "bg-pink-500",
  system: "bg-gray-500",
};

export function ToolUsage({ tools }: ToolUsageProps) {
  const maxCount = Math.max(...tools.map((t) => t.count), 1);
  const sortedTools = [...tools].sort((a, b) => b.count - a.count).slice(0, 8);
  const totalCalls = tools.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Tool Usage (24h)
          </h2>
        </div>
        <span className="text-xs text-foreground-muted">
          {totalCalls} calls
        </span>
      </div>

      {/* Tool bars */}
      <div className="p-4 space-y-3">
        {sortedTools.length === 0 ? (
          <div className="text-center text-foreground-muted text-sm py-4">
            No tool usage yet
          </div>
        ) : (
          sortedTools.map((tool) => {
            const percentage = (tool.count / maxCount) * 100;

            return (
              <div key={tool.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium truncate">
                    {tool.name}
                  </span>
                  <span className="text-foreground-muted font-mono">
                    {tool.count}
                  </span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-500",
                      categoryColors[tool.category]
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="px-4 pb-3 flex items-center justify-center gap-4 text-xs">
        {Object.entries(categoryColors).map(([category, color]) => (
          <div key={category} className="flex items-center gap-1.5">
            <div className={clsx("w-2 h-2 rounded-full", color)} />
            <span className="text-foreground-muted capitalize">{category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
