export enum ErrorCode {
  // Claude related
  CLAUDE_TIMEOUT = 'CLAUDE_TIMEOUT',
  CLAUDE_RATE_LIMIT = 'CLAUDE_RATE_LIMIT',
  CLAUDE_SESSION_ERROR = 'CLAUDE_SESSION_ERROR',
  CLAUDE_SPAWN_ERROR = 'CLAUDE_SPAWN_ERROR',

  // Telegram related
  TELEGRAM_UNAUTHORIZED = 'TELEGRAM_UNAUTHORIZED',
  TELEGRAM_SEND_FAILED = 'TELEGRAM_SEND_FAILED',

  // Memory system
  MEMORY_SEARCH_FAILED = 'MEMORY_SEARCH_FAILED',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',

  // Database
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',

  // General
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
}

export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public statusCode: number = 500,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(process.env.NODE_ENV !== 'production' && { context: this.context }),
      },
    };
  }
}

// Retry utility with exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
