import { Hono } from 'hono';
import { memoryService } from '../../../memory';
import { eventBus } from '../../../gateway';
import { createChildLogger } from '../../../utils/logger';

const logger = createChildLogger('api-stats');

const stats = new Hono();

interface ToolUsage {
  name: string;
  count: number;
  category: 'read' | 'write' | 'search' | 'tool' | 'mcp' | 'system';
}

/**
 * GET /api/stats
 * Returns dashboard statistics
 */
stats.get('/', async (c) => {
  try {
    // Get goals count
    const goals = await memoryService.getGoals();
    const activeGoals = goals.filter((g) => g.status === 'active').length;
    const completedGoals = goals.filter((g) => g.status === 'completed').length;

    // Get recent events for tool usage stats
    const recentEvents = eventBus.getRecentEvents(500);

    // Calculate tool usage from events
    const toolCounts = new Map<string, { count: number; category: ToolUsage['category'] }>();

    for (const event of recentEvents) {
      if (event.tool) {
        const existing = toolCounts.get(event.tool) || { count: 0, category: getToolCategory(event.type) };
        toolCounts.set(event.tool, {
          count: existing.count + 1,
          category: existing.category,
        });
      }
    }

    // Convert to sorted array
    const topTools: ToolUsage[] = Array.from(toolCounts.entries())
      .map(([name, data]) => ({ name, count: data.count, category: data.category }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEvents = recentEvents.filter((e) => e.timestamp >= todayStart.getTime());

    const todayToolCalls = todayEvents.filter((e) => e.tool).length;
    const todayMessages = todayEvents.filter((e) => e.type === 'SYSTEM' && e.summary.includes('message')).length;

    // Memory stats placeholder (would need to query Supabase)
    let memoryCount = 0;
    let memoryByType: Record<string, number> = {};

    try {
      // Try to get memory stats if available
      if (memoryService.isAvailable()) {
        // For now, we'll use a simple approach - this could be optimized with a dedicated count query
        const memories = await memoryService.search('', { limit: 1000 });
        memoryCount = memories.length;

        // Count by type
        for (const memory of memories) {
          const type = memory.memoryType;
          memoryByType[type] = (memoryByType[type] || 0) + 1;
        }
      }
    } catch (err) {
      logger.warn({ error: err }, 'Failed to get memory stats');
    }

    return c.json({
      success: true,
      data: {
        goals: {
          total: goals.length,
          active: activeGoals,
          completed: completedGoals,
        },
        memory: {
          total: memoryCount,
          byType: memoryByType,
        },
        today: {
          messages: todayMessages,
          toolCalls: todayToolCalls,
        },
        topTools,
      },
    });
  } catch (err) {
    logger.error({ error: err }, 'Failed to get stats');
    return c.json({
      success: true,
      data: {
        goals: { total: 0, active: 0, completed: 0 },
        memory: { total: 0, byType: {} },
        today: { messages: 0, toolCalls: 0 },
        topTools: [],
      },
    });
  }
});

/**
 * Map event type to tool category
 */
function getToolCategory(type: string): ToolUsage['category'] {
  switch (type) {
    case 'READ':
      return 'read';
    case 'WRITE':
      return 'write';
    case 'SEARCH':
      return 'search';
    case 'MCP':
      return 'mcp';
    case 'SYSTEM':
      return 'system';
    default:
      return 'tool';
  }
}

export default stats;
