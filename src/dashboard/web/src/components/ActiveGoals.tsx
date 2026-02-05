"use client";

import { clsx } from "clsx";
import { Target, CheckCircle2, Circle, PauseCircle, Calendar } from "lucide-react";

interface Goal {
  id: string;
  title: string;
  description?: string;
  status: "active" | "completed" | "paused";
  deadline?: string;
  priority: number;
}

interface ActiveGoalsProps {
  goals: Goal[];
  onToggleStatus?: (id: string, status: Goal["status"]) => void;
}

function PriorityBadge({ priority }: { priority: number }) {
  const color =
    priority >= 8
      ? "text-error bg-error/10"
      : priority >= 5
      ? "text-warning bg-warning/10"
      : "text-info bg-info/10";

  return (
    <span className={clsx("px-1.5 py-0.5 rounded text-xs font-medium", color)}>
      P{priority}
    </span>
  );
}

function StatusIcon({ status }: { status: Goal["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-success" />;
    case "paused":
      return <PauseCircle className="w-4 h-4 text-warning" />;
    default:
      return <Circle className="w-4 h-4 text-primary" />;
  }
}

export function ActiveGoals({ goals, onToggleStatus }: ActiveGoalsProps) {
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedToday = goals.filter(
    (g) =>
      g.status === "completed"
  ).length;

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Active Goals</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <span>{activeGoals.length} active</span>
          <span className="text-success">{completedToday} completed</span>
        </div>
      </div>

      {/* Goals list */}
      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {goals.length === 0 ? (
          <div className="px-4 py-8 text-center text-foreground-muted text-sm">
            No goals yet. Add some goals to track your progress!
          </div>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className={clsx(
                "px-4 py-3 flex items-start gap-3 hover:bg-surface-hover transition-colors",
                goal.status === "completed" && "opacity-60"
              )}
            >
              <button
                onClick={() =>
                  onToggleStatus?.(
                    goal.id,
                    goal.status === "completed" ? "active" : "completed"
                  )
                }
                className="mt-0.5 hover:scale-110 transition-transform"
              >
                <StatusIcon status={goal.status} />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "text-sm font-medium",
                      goal.status === "completed"
                        ? "text-foreground-muted line-through"
                        : "text-foreground"
                    )}
                  >
                    {goal.title}
                  </span>
                  <PriorityBadge priority={goal.priority} />
                </div>

                {goal.description && (
                  <p className="text-xs text-foreground-muted mt-0.5 truncate">
                    {goal.description}
                  </p>
                )}

                {goal.deadline && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-foreground-muted">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(goal.deadline).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
