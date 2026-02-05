import { Hono } from 'hono';
import { gateway, sessionStore, claudeBridge } from '../../../gateway';
import type { HealthStatus } from '../../../types';

const health = new Hono();

/**
 * Format uptime in human readable format
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  return `${hours}h ${minutes % 60}m`;
}

/**
 * GET /api/health
 * Returns system health status
 */
health.get('/', async (c) => {
  const detailed = c.req.query('detailed') === 'true';
  const claudeStatus = claudeBridge.getStatus();
  const uptime = gateway.getUptime();

  const healthStatus: HealthStatus = {
    telegram: {
      status: 'online', // TODO: Actually ping the bot
      lastPing: new Date(),
    },
    supabase: {
      status: 'disconnected', // TODO: Check actual connection
      latency: -1,
    },
    claude: {
      status: claudeStatus.status,
      activeSession: claudeStatus.activeSession,
      queueLength: claudeStatus.queueLength,
    },
    uptime,
    todayCost: 0, // TODO: Calculate from logs
  };

  if (detailed) {
    return c.json({
      ...healthStatus,
      uptimeFormatted: formatUptime(uptime),
      activeSessions: sessionStore.getActiveCount(),
      sessions: sessionStore.getAllSessions(),
      memory: process.memoryUsage(),
    });
  }

  return c.json({
    ok: true,
    uptime: formatUptime(uptime),
    telegram: healthStatus.telegram.status,
    supabase: healthStatus.supabase.status,
    claude: healthStatus.claude.status,
    queue: healthStatus.claude.queueLength,
  });
});

/**
 * GET /api/health/ping
 * Simple ping endpoint for uptime monitoring
 */
health.get('/ping', (c) => {
  return c.text('pong');
});

export default health;
