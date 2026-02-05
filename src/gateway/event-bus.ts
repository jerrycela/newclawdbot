import { EventEmitter } from 'events';
import type { ClaudeEvent, DashboardEvent } from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('event-bus');

class EventBus extends EventEmitter {
  private eventHistory: DashboardEvent[] = [];
  private maxHistory = 500;

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many dashboard connections
  }

  /**
   * Emit a Claude event and convert it to a Dashboard event
   */
  emitClaudeEvent(event: ClaudeEvent) {
    const dashboardEvent = this.convertToDashboardEvent(event);
    if (dashboardEvent) {
      this.addToHistory(dashboardEvent);
      this.emit('dashboard:event', dashboardEvent);
      logger.debug({ event: dashboardEvent }, 'Dashboard event emitted');
    }
  }

  /**
   * Emit a system event
   */
  emitSystemEvent(type: 'startup' | 'shutdown' | 'error' | 'session_rotate', details?: string) {
    const dashboardEvent: DashboardEvent = {
      timestamp: Date.now(),
      type: 'SYSTEM',
      summary: `[${type.toUpperCase()}] ${details || ''}`.trim(),
    };
    this.addToHistory(dashboardEvent);
    this.emit('dashboard:event', dashboardEvent);
    logger.info({ type, details }, 'System event emitted');
  }

  /**
   * Emit a cost tracking event
   */
  emitCostEvent(costUsd: number, sessionId?: string) {
    const dashboardEvent: DashboardEvent = {
      timestamp: Date.now(),
      type: 'SYSTEM',
      summary: `[COST] $${costUsd.toFixed(4)}`,
      sessionId,
    };
    this.addToHistory(dashboardEvent);
    this.emit('dashboard:event', dashboardEvent);
    this.emit('cost:update', { costUsd, sessionId });
    logger.debug({ costUsd, sessionId }, 'Cost event emitted');
  }

  /**
   * Get recent event history for new dashboard connections
   */
  getRecentEvents(limit = 50): DashboardEvent[] {
    return this.eventHistory.slice(-limit);
  }

  private convertToDashboardEvent(event: ClaudeEvent): DashboardEvent | null {
    const timestamp = event.timestamp || Date.now();

    if (event.type === 'tool_use' && event.tool_use) {
      const toolName = event.tool_use.name;
      let type: DashboardEvent['type'] = 'TOOL';
      let summary = toolName;

      // Categorize tool types
      if (toolName === 'Read' || toolName.includes('read')) {
        type = 'READ';
        const input = event.tool_use.input as { file_path?: string };
        summary = `Read ${input.file_path || 'file'}`;
      } else if (toolName === 'Write' || toolName === 'Edit') {
        type = 'WRITE';
        const input = event.tool_use.input as { file_path?: string };
        summary = `${toolName} ${input.file_path || 'file'}`;
      } else if (toolName === 'Grep' || toolName === 'Glob' || toolName.includes('search')) {
        type = 'SEARCH';
        const input = event.tool_use.input as { pattern?: string; query?: string };
        summary = `${toolName} ${input.pattern || input.query || ''}`;
      } else if (toolName.startsWith('mcp__')) {
        type = 'MCP';
        summary = toolName;
      }

      return {
        timestamp,
        type,
        tool: toolName,
        summary,
        sessionId: event.sessionId,
      };
    }

    if (event.type === 'assistant' && event.message?.content) {
      // Don't emit raw assistant messages to dashboard - too noisy
      return null;
    }

    if (event.type === 'error' && event.error) {
      return {
        timestamp,
        type: 'SYSTEM',
        summary: `[ERROR] ${event.error.message}`,
        sessionId: event.sessionId,
      };
    }

    return null;
  }

  private addToHistory(event: DashboardEvent) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }
  }
}

// Singleton instance
export const eventBus = new EventBus();
