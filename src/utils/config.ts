import { z } from 'zod';

const envSchema = z.object({
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_ALLOWED_USERS: z.string().default('').transform(s =>
    s ? s.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id)) : []
  ),

  // Claude Code
  CLAUDE_SESSION_PREFIX: z.string().default('clawdbot'),
  CLAUDE_MAX_TURNS: z.coerce.number().int().positive().default(50),
  CLAUDE_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),

  // Supabase
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),

  // Server
  API_PORT: z.coerce.number().int().positive().default(8080),
  DASHBOARD_PORT: z.coerce.number().int().positive().default(3000),
  WS_HEARTBEAT_INTERVAL: z.coerce.number().int().positive().default(30000),

  // Security
  API_SECRET: z.string().min(16).optional(),
  CORS_ORIGINS: z.string().default('').transform(s =>
    s ? s.split(',').map(o => o.trim()) : ['http://localhost:3000']
  ),

  // Monitoring
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  TELEGRAM_ADMIN_CHAT_ID: z.coerce.number().int().optional(),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Configuration validation failed:');
    result.error.issues.forEach(issue => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });

    // In development, continue with defaults for optional fields
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Running with partial configuration in development mode');
      return envSchema.parse({
        ...process.env,
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || 'placeholder-token',
      });
    }

    throw new Error('Invalid configuration');
  }

  return result.data;
}

export const config = loadConfig();

export type Config = typeof config;
