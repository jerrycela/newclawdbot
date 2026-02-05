import pino from 'pino';
import { config } from './config';

const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'embedding', 'authorization'];

function redactSensitive(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      result[key] = redactSensitive(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const logger = pino({
  level: config.LOG_LEVEL,
  formatters: {
    log: (obj) => redactSensitive(obj) as Record<string, unknown>,
  },
  transport: config.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export function createChildLogger(name: string) {
  return logger.child({ module: name });
}
