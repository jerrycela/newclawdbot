import type { TelegramContext } from '../types';
import { createChildLogger } from '../utils/logger';
import { claudeBridge } from './claude-bridge';
import { sessionStore } from './session-store';
import { eventBus } from './event-bus';

const logger = createChildLogger('gateway');

export class Gateway {
  private isShuttingDown = false;
  private startTime = Date.now();

  async start() {
    this.setupGracefulShutdown();
    eventBus.emitSystemEvent('startup', 'Gateway started');
    logger.info('Gateway started');
  }

  /**
   * Process a message from any channel (Telegram, etc.)
   */
  async processMessage(
    message: string,
    chatId: number,
    context?: Partial<TelegramContext>
  ): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Gateway is shutting down');
    }

    // Get or create session for this chat
    const sessionId = sessionStore.getOrCreate(chatId);

    // Record the message (might trigger rotation)
    const rotated = sessionStore.recordMessage(chatId);
    const effectiveSessionId = rotated
      ? sessionStore.getOrCreate(chatId)
      : sessionId;

    logger.info(
      {
        chatId,
        sessionId: effectiveSessionId,
        messageLength: message.length,
        rotated,
      },
      'Processing message'
    );

    // Build full context
    const fullContext: TelegramContext = {
      chatId,
      userId: context?.userId || chatId,
      sessionId: effectiveSessionId,
      messageId: context?.messageId || 0,
      username: context?.username,
    };

    // Send to Claude
    const response = await claudeBridge.sendMessage(
      message,
      effectiveSessionId,
      fullContext
    );

    return response;
  }

  /**
   * Clear/rotate session for a chat
   */
  rotateSession(chatId: number): string {
    return sessionStore.rotate(chatId);
  }

  /**
   * Get session info
   */
  getSessionInfo(chatId: number) {
    return sessionStore.getSession(chatId);
  }

  /**
   * Get gateway status
   */
  getStatus() {
    const claudeStatus = claudeBridge.getStatus();
    return {
      uptime: Date.now() - this.startTime,
      isShuttingDown: this.isShuttingDown,
      activeSessions: sessionStore.getActiveCount(),
      claude: claudeStatus,
    };
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');
      eventBus.emitSystemEvent('shutdown', `Signal: ${signal}`);

      // Wait for pending Claude requests (max 30 seconds)
      logger.info('Waiting for pending requests...');
      await claudeBridge.waitForPending(30000);

      // Dispose resources
      claudeBridge.dispose();
      sessionStore.dispose();

      logger.info('Graceful shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Manually trigger shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    eventBus.emitSystemEvent('shutdown', 'Manual shutdown');

    await claudeBridge.waitForPending(30000);
    claudeBridge.dispose();
    sessionStore.dispose();
  }
}

// Singleton instance
export const gateway = new Gateway();

// Re-export components
export { claudeBridge } from './claude-bridge';
export { sessionStore } from './session-store';
export { eventBus } from './event-bus';
