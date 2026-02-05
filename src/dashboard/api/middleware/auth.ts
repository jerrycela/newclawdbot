import type { Context, Next } from 'hono';
import { config } from '../../../utils/config';
import { AppError, ErrorCode } from '../../../utils/errors';

/**
 * Middleware to authenticate dashboard API requests
 */
export async function dashboardAuth(c: Context, next: Next) {
  // If no API_SECRET is configured, allow all requests
  if (!config.API_SECRET) {
    return next();
  }

  const apiKey = c.req.header('X-API-Key') || c.req.query('apiKey');

  if (!apiKey || apiKey !== config.API_SECRET) {
    throw new AppError('Unauthorized access', ErrorCode.TELEGRAM_UNAUTHORIZED, 401);
  }

  await next();
}
