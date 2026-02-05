import { Bot, GrammyError, HttpError } from 'grammy';
import { config } from '../utils/config';
import { createChildLogger } from '../utils/logger';
import { authMiddleware } from './middleware/auth';
import { handleMessage } from './handlers/message';
import { setupCommands } from './handlers/commands';

const logger = createChildLogger('telegram-bot');

let bot: Bot | null = null;

/**
 * Create and configure the Telegram bot
 */
export function createBot(): Bot {
  if (bot) {
    return bot;
  }

  bot = new Bot(config.TELEGRAM_BOT_TOKEN);

  // Global error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;

    logger.error(
      {
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        updateId: ctx.update?.update_id,
      },
      'Bot error occurred'
    );

    if (e instanceof GrammyError) {
      logger.error(
        {
          description: e.description,
          method: e.method,
          errorCode: e.error_code,
        },
        'Grammy error'
      );
    } else if (e instanceof HttpError) {
      logger.error({ error: e.error }, 'HTTP error');
    } else {
      logger.error({ error: e }, 'Unknown error');
    }

    // Try to notify user
    ctx.reply('An error occurred. Please try again.').catch(() => {
      // Ignore send errors
    });
  });

  // Auth middleware - check if user is allowed
  bot.use(authMiddleware);

  // Setup commands
  setupCommands(bot);

  // Handle text messages
  bot.on('message:text', handleMessage);

  // Handle other message types with a helpful response
  bot.on('message', async (ctx) => {
    // Skip if we already handled it (text messages)
    if (ctx.message?.text) return;

    if (ctx.message?.voice) {
      await ctx.reply(
        'Voice messages are not supported yet. Please send text messages.'
      );
    } else if (ctx.message?.document) {
      await ctx.reply(
        'Document processing is not supported yet. Please describe what you need.'
      );
    } else if (ctx.message?.photo) {
      await ctx.reply(
        'Image analysis is not supported yet. Please describe what you need.'
      );
    } else {
      await ctx.reply(
        'This message type is not supported. Please send a text message.'
      );
    }
  });

  logger.info('Telegram bot configured');
  return bot;
}

/**
 * Start the bot (long polling)
 */
export async function startBot(): Promise<void> {
  const botInstance = createBot();

  // Get bot info
  const me = await botInstance.api.getMe();
  logger.info({ username: me.username, id: me.id }, 'Bot started');

  // Start polling
  await botInstance.start({
    onStart: (botInfo) => {
      logger.info({ username: botInfo.username }, 'Bot polling started');
    },
  });
}

/**
 * Stop the bot
 */
export async function stopBot(): Promise<void> {
  if (bot) {
    await bot.stop();
    bot = null;
    logger.info('Bot stopped');
  }
}

/**
 * Get the bot instance
 */
export function getBot(): Bot | null {
  return bot;
}
