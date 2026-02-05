"use client";

import { useRef, useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  FileText,
  Edit3,
  Search,
  Terminal,
  Plug,
  Info,
  Filter,
} from "lucide-react";
import type { ClaudeEvent } from "@/hooks/useWebSocket";

interface LiveFeedProps {
  events: ClaudeEvent[];
  maxEvents?: number;
}

const typeConfig: Record<
  ClaudeEvent["type"],
  { icon: typeof FileText; color: string; label: string }
> = {
  READ: { icon: FileText, color: "text-blue-400", label: "Read" },
  WRITE: { icon: Edit3, color: "text-green-400", label: "Write" },
  TOOL: { icon: Terminal, color: "text-purple-400", label: "Tool" },
  SEARCH: { icon: Search, color: "text-yellow-400", label: "Search" },
  MCP: { icon: Plug, color: "text-pink-400", label: "MCP" },
  SYSTEM: { icon: Info, color: "text-gray-400", label: "System" },
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EventBadge({ type }: { type: ClaudeEvent["type"] }) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
        "bg-surface-hover",
        config.color
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export function LiveFeed({ events, maxEvents = 200 }: LiveFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<ClaudeEvent["type"] | null>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  // Handle scroll to detect if user manually scrolled up
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const filteredEvents = filter
    ? events.filter((e) => e.type === filter)
    : events;

  const displayEvents = filteredEvents.slice(-maxEvents);

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <h2 className="text-sm font-semibold text-foreground">Live Feed</h2>
          <span className="text-xs text-foreground-muted">
            ({displayEvents.length} events)
          </span>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-muted mr-1" />
          <button
            onClick={() => setFilter(null)}
            className={clsx(
              "px-2 py-1 rounded text-xs transition-colors",
              filter === null
                ? "bg-primary text-white"
                : "bg-surface-hover text-foreground-muted hover:text-foreground"
            )}
          >
            All
          </button>
          {(["READ", "WRITE", "TOOL", "SEARCH"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? null : type)}
              className={clsx(
                "px-2 py-1 rounded text-xs transition-colors",
                filter === type
                  ? "bg-primary text-white"
                  : "bg-surface-hover text-foreground-muted hover:text-foreground"
              )}
            >
              {typeConfig[type].label}
            </button>
          ))}
        </div>
      </div>

      {/* Events list */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-sm"
      >
        {displayEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-foreground-muted text-sm">
            Waiting for events...
          </div>
        ) : (
          displayEvents.map((event, idx) => (
            <div
              key={`${event.timestamp}-${idx}`}
              className="feed-item-enter flex items-start gap-3 px-2 py-1.5 rounded hover:bg-surface-hover transition-colors"
            >
              <span className="text-foreground-muted text-xs w-16 shrink-0">
                {formatTime(event.timestamp)}
              </span>
              <EventBadge type={event.type} />
              <span className="text-foreground truncate flex-1">
                {event.tool && (
                  <span className="text-primary mr-1">[{event.tool}]</span>
                )}
                {event.summary}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) {
              containerRef.current.scrollTop =
                containerRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-4 px-3 py-1.5 bg-primary text-white text-xs rounded-full shadow-lg hover:bg-primary-hover transition-colors"
        >
          Resume auto-scroll
        </button>
      )}
    </div>
  );
}
