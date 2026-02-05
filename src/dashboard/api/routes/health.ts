import { Hono } from 'hono';
import { gateway, sessionStore, claudeBridge } from '../../../gateway';
import { getBot } from '../../../telegram';
import { testConnection, isSupabaseConfigured } from '../../../memory/supabase';
import type { HealthStatus } from '../../../types';

const health = new Hono();

/**
 * Ping Telegram bot to check if it's online
 */
async function pingTelegram(): Promise<{ status: 'online' | 'offline'; lastPing: Date }> {
  const bot = getBot();
  if (!bot) {
    return { status: 'offline', lastPing: new Date() };
  }

  try {
    await bot.api.getMe();
    return { status: 'online', lastPing: new Date() };
  } catch {
    return { status: 'offline', lastPing: new Date() };
  }
}

/**
 * Check Supabase connection status
 */
async function checkSupabase(): Promise<{ status: 'connected' | 'disconnected'; latency: number }> {
  if (!isSupabaseConfigured()) {
    return { status: 'disconnected', latency: -1 };
  }

  const result = await testConnection();
  return {
    status: result.connected ? 'connected' : 'disconnected',
    latency: result.latency,
  };
}

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

  // Run health checks in parallel for better performance
  const [telegramStatus, supabaseStatus] = await Promise.all([
    pingTelegram(),
    checkSupabase(),
  ]);

  const healthStatus: HealthStatus = {
    telegram: telegramStatus,
    supabase: supabaseStatus,
    claude: {
      status: claudeStatus.status,
      activeSession: claudeStatus.activeSession,
      queueLength: claudeStatus.queueLength,
    },
    uptime,
    todayCost: claudeBridge.getTodayCost(),
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
