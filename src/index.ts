import { gateway } from './gateway';
import { startBot, stopBot } from './telegram';
import { startApiServer } from './dashboard/api';
import { createWebSocketServer, stopWebSocketServer } from './dashboard/websocket';
import { config } from './utils/config';
import { createChildLogger } from './utils/logger';

const logger = createChildLogger('main');

async function main() {
  logger.info('Starting Clawdbot...');
  logger.info({ env: config.NODE_ENV }, 'Environment');

  try {
    // Start gateway
    await gateway.start();
    logger.info('Gateway started');

    // Start API server
    startApiServer();
    logger.info({ port: config.API_PORT }, 'API server started');

    // Start WebSocket server for live feed
    createWebSocketServer(config.API_PORT + 1);
    logger.info({ port: config.API_PORT + 1 }, 'WebSocket server started');

    // Start Telegram bot
    if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_BOT_TOKEN !== 'placeholder-token') {
      await startBot();
      logger.info('Telegram bot started');
    } else {
      logger.warn('Telegram bot not started - no valid token configured');
    }

    logger.info('Clawdbot is running!');
    logger.info(`API: http://localhost:${config.API_PORT}`);
    logger.info(`WebSocket: ws://localhost:${config.API_PORT + 1}`);
  } catch (error) {
    logger.error({ error }, 'Failed to start Clawdbot');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  process.exit(1);
});

// Run
main();
