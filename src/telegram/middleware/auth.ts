import type { Context, NextFunction } from 'grammy';
import { config } from '../../utils/config';
import { createChildLogger } from '../../utils/logger';

const logger = createChildLogger('telegram-auth');

/**
 * Middleware to check if user is in the whitelist
 */
export async function authMiddleware(ctx: Context, next: NextFunction) {
  const userId = ctx.from?.id;

  if (!userId) {
    logger.warn('Message without user ID');
    return;
  }

  // If whitelist is empty, allow all users
  if (config.TELEGRAM_ALLOWED_USERS.length === 0) {
    logger.debug({ userId }, 'No whitelist configured, allowing user');
    return next();
  }

  // Check if user is in whitelist
  if (config.TELEGRAM_ALLOWED_USERS.includes(userId)) {
    logger.debug({ userId }, 'User authorized');
    return next();
  }

  // User not authorized
  logger.warn(
    { userId, username: ctx.from?.username },
    'Unauthorized user attempted to access bot'
  );

  await ctx.reply(
    'Sorry, you are not authorized to use this bot. ' +
      'Please contact the administrator if you believe this is an error.'
  );
}
