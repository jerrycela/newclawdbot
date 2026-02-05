// Core type definitions for Clawdbot

// ===== Claude Code Events =====
export interface ClaudeEvent {
  type: 'assistant' | 'tool_use' | 'tool_result' | 'system' | 'error';
  timestamp: number;
  sessionId?: string;
  message?: AssistantMessage;
  tool_use?: ToolUse;
  tool_result?: ToolResult;
  error?: ErrorEvent;
}

export interface AssistantMessage {
  content: Array<{ type: string; text?: string }>;
  stop_reason?: string;
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ErrorEvent {
  message: string;
  code?: string;
}

// ===== Telegram Context =====
export interface TelegramContext {
  chatId: number;
  userId: number;
  sessionId: string;
  messageId: number;
  username?: string;
}

// ===== Session Management =====
export interface SessionInfo {
  sessionId: string;
  chatId: number;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
}

// ===== Memory System =====
export type MemoryType = 'fact' | 'goal' | 'todo' | 'conversation' | 'preference' | 'insight';

export interface Memory {
  id: string;
  content: string;
  memoryType: MemoryType;
  importance: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdAt: Date;
  updatedAt?: Date;
  expiresAt?: Date;
}

export interface MemorySearchResult extends Memory {
  similarity: number;
}

// ===== Goals =====
export type GoalStatus = 'active' | 'completed' | 'paused';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  status: GoalStatus;
  deadline?: Date;
  priority: number;
  createdAt: Date;
  completedAt?: Date;
}

// ===== Health Status =====
export interface HealthStatus {
  telegram: {
    status: 'online' | 'offline';
    lastPing?: Date;
  };
  supabase: {
    status: 'connected' | 'disconnected';
    latency: number;
  };
  claude: {
    status: 'ready' | 'busy' | 'error';
    activeSession?: string;
    queueLength?: number;
  };
  uptime: number;
  todayCost: number;
}

// ===== Dashboard Events =====
export interface DashboardEvent {
  timestamp: number;
  type: 'READ' | 'WRITE' | 'TOOL' | 'SEARCH' | 'MCP' | 'SYSTEM';
  tool?: string;
  summary: string;
  sessionId?: string;
}

// ===== Request Queue =====
export interface QueuedRequest {
  message: string;
  sessionId: string;
  context?: TelegramContext;
  priority: 'high' | 'normal' | 'low';
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

// ===== API Responses =====
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
