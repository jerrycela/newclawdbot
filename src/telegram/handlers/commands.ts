import type { Bot } from 'grammy';
import { gateway, sessionStore } from '../../gateway';
import { createChildLogger } from '../../utils/logger';

const logger = createChildLogger('telegram-commands');

/**
 * Format uptime in human readable format
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Setup bot commands
 */
export function setupCommands(bot: Bot) {
  // Register command menu
  bot.api.setMyCommands([
    { command: 'start', description: 'Start the bot' },
    { command: 'help', description: 'Show help message' },
    { command: 'status', description: 'Show system status' },
    { command: 'clear', description: 'Clear conversation context' },
  ]).catch(err => {
    logger.error({ error: err }, 'Failed to set bot commands');
  });

  // /start command
  bot.command('start', async (ctx) => {
    const username = ctx.from?.first_name || 'there';
    await ctx.reply(
      `Hello ${username}! I'm your AI assistant powered by Claude.\n\n` +
        `I can help you with:\n` +
        `- Answering questions\n` +
        `- Writing and editing code\n` +
        `- Analyzing documents\n` +
        `- And much more!\n\n` +
        `Just send me a message to get started.\n` +
        `Type /help for more information.`
    );
    logger.info({ userId: ctx.from?.id, username: ctx.from?.username }, 'User started bot');
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `*How to use this bot:*\n\n` +
        `Simply send me any message and I'll respond using Claude AI.\n\n` +
        `*Commands:*\n` +
        `/start - Start the bot\n` +
        `/help - Show this help message\n` +
        `/status - Show system status\n` +
        `/clear - Clear conversation context (start fresh)\n\n` +
        `*Tips:*\n` +
        `- Be specific in your requests for better results\n` +
        `- I remember our conversation context\n` +
        `- Use /clear to start a new topic`,
      { parse_mode: 'Markdown' }
    );
  });

  // /status command
  bot.command('status', async (ctx) => {
    const status = gateway.getStatus();
    const sessionInfo = ctx.chat?.id
      ? sessionStore.getSession(ctx.chat.id)
      : undefined;

    let statusText = `*System Status*\n\n`;
    statusText += `Uptime: ${formatUptime(status.uptime)}\n`;
    statusText += `Claude: ${status.claude.status === 'ready' ? 'Ready' : 'Busy'}\n`;
    statusText += `Queue: ${status.claude.queueLength} pending\n`;
    statusText += `Active Sessions: ${status.activeSessions}\n`;

    if (sessionInfo) {
      statusText += `\n*Your Session*\n`;
      statusText += `Messages: ${sessionInfo.messageCount}\n`;
      statusText += `Started: ${new Date(sessionInfo.createdAt).toLocaleString()}`;
    }

    await ctx.reply(statusText, { parse_mode: 'Markdown' });
    logger.debug({ userId: ctx.from?.id }, 'Status requested');
  });

  // /clear command
  bot.command('clear', async (ctx) => {
    if (!ctx.chat?.id) return;

    gateway.rotateSession(ctx.chat.id);
    await ctx.reply(
      'Conversation context cleared! Starting fresh.\n' +
        'Send me a new message to begin.'
    );
    logger.info({ userId: ctx.from?.id, chatId: ctx.chat.id }, 'Session cleared');
  });

  logger.info('Bot commands registered');
}
