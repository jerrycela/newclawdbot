import type { SessionInfo } from '../types';
import { config } from '../utils/config';
import { createChildLogger } from '../utils/logger';
import { eventBus } from './event-bus';

const logger = createChildLogger('session-store');

export class SessionStore {
  private sessions = new Map<string, SessionInfo>();
  private readonly TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired sessions every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    logger.info('Session store initialized');
  }

  /**
   * Get or create a session for a chat
   */
  getOrCreate(chatId: number): string {
    const key = `chat_${chatId}`;
    const existing = this.sessions.get(key);

    if (existing && Date.now() - existing.lastActivity < this.TTL_MS) {
      existing.lastActivity = Date.now();
      return existing.sessionId;
    }

    // Create new session
    const sessionId = `${config.CLAUDE_SESSION_PREFIX}_${chatId}_${Date.now()}`;
    this.sessions.set(key, {
      sessionId,
      chatId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
    });

    logger.info({ chatId, sessionId }, 'New session created');
    return sessionId;
  }

  /**
   * Record a message and check if session should be rotated
   */
  recordMessage(chatId: number): boolean {
    const key = `chat_${chatId}`;
    const session = this.sessions.get(key);

    if (session) {
      session.messageCount++;
      session.lastActivity = Date.now();

      // Rotate if exceeds max turns
      if (session.messageCount >= config.CLAUDE_MAX_TURNS) {
        logger.info(
          { chatId, messageCount: session.messageCount },
          'Session rotation triggered due to max turns'
        );
        this.rotate(chatId);
        return true; // Indicates rotation happened
      }
    }

    return false;
  }

  /**
   * Force rotate a session
   */
  rotate(chatId: number): string {
    const key = `chat_${chatId}`;
    const oldSession = this.sessions.get(key);

    if (oldSession) {
      logger.info(
        { chatId, oldSessionId: oldSession.sessionId },
        'Rotating session'
      );
      eventBus.emitSystemEvent('session_rotate', `Chat ${chatId}`);
    }

    this.sessions.delete(key);
    return this.getOrCreate(chatId);
  }

  /**
   * Get session info for a chat
   */
  getSession(chatId: number): SessionInfo | undefined {
    const key = `chat_${chatId}`;
    return this.sessions.get(key);
  }

  /**
   * Get all active sessions (for dashboard)
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get total active session count
   */
  getActiveCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup expired sessions
   */
  private cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, session] of this.sessions) {
      if (now - session.lastActivity > this.TTL_MS) {
        this.sessions.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned }, 'Cleaned up expired sessions');
    }
  }

  /**
   * Dispose the session store
   */
  dispose() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
    logger.info('Session store disposed');
  }
}

// Singleton instance
export const sessionStore = new SessionStore();
