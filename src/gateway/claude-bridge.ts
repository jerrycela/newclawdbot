import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { createInterface } from 'readline';
import type { ClaudeEvent, ClaudeRequestResult, QueuedRequest, TelegramContext } from '../types';
import { config } from '../utils/config';
import { createChildLogger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';
import { eventBus } from './event-bus';

const logger = createChildLogger('claude-bridge');

// Stream event types from Claude CLI (--output-format stream-json --verbose)
interface ClaudeStreamEvent {
  type: 'assistant' | 'tool_use' | 'tool_result' | 'system' | 'result' | 'error';
  subtype?: string;
  // System event fields
  session_id?: string;
  model?: string;
  tools?: string[];
  mcp_servers?: Array<{ name: string; status: string }>;
  // Assistant event fields
  message?: {
    content: Array<{ type: string; text?: string }>;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  // Tool events
  tool_use?: { name: string; input: unknown; id: string };
  tool_result?: { tool_use_id: string; content: string };
  // Result event fields (final summary)
  result?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  // Error fields
  error?: { message: string };
}

export class ClaudeBridge extends EventEmitter {
  private activeProcess: ChildProcess | null = null;
  private activeSessionId: string | null = null;
  private requestQueue: QueuedRequest[] = [];
  private isProcessing = false;

  // Cost tracking
  private todayCostUsd = 0;
  private costResetDate = new Date().toDateString();

  constructor() {
    super();
    logger.info('Claude Bridge initialized');
  }

  /**
   * Get today's total cost
   */
  getTodayCost(): number {
    // Reset if day changed
    const today = new Date().toDateString();
    if (today !== this.costResetDate) {
      this.todayCostUsd = 0;
      this.costResetDate = today;
    }
    return this.todayCostUsd;
  }

  /**
   * Add cost to today's total
   */
  private addCost(costUsd: number) {
    const today = new Date().toDateString();
    if (today !== this.costResetDate) {
      this.todayCostUsd = 0;
      this.costResetDate = today;
    }
    this.todayCostUsd += costUsd;
    logger.debug({ costUsd, todayTotal: this.todayCostUsd }, 'Cost tracked');
  }

  /**
   * Send a message to Claude Code and get a response
   */
  async sendMessage(
    message: string,
    sessionId: string,
    context?: TelegramContext,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        message,
        sessionId,
        context,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Sort queue by priority
      this.requestQueue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      this.processQueue();
    });
  }

  /**
   * Get current status
   */
  getStatus(): {
    status: 'ready' | 'busy' | 'error';
    queueLength: number;
    activeSession?: string;
    todayCostUsd: number;
  } {
    return {
      status: this.isProcessing ? 'busy' : 'ready',
      queueLength: this.requestQueue.length,
      activeSession: this.activeSessionId || undefined,
      todayCostUsd: this.getTodayCost(),
    };
  }

  /**
   * Wait for all pending requests to complete
   */
  async waitForPending(timeoutMs: number): Promise<void> {
    const start = Date.now();

    while (
      (this.isProcessing || this.requestQueue.length > 0) &&
      Date.now() - start < timeoutMs
    ) {
      await new Promise((r) => setTimeout(r, 100));
    }

    // Force terminate if still running
    if (this.activeProcess) {
      logger.warn('Force terminating active Claude process');
      this.activeProcess.kill('SIGTERM');
      this.activeProcess = null;
    }
  }

  /**
   * Process the request queue
   */
  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const request = this.requestQueue.shift()!;

    logger.info(
      { sessionId: request.sessionId, queueLength: this.requestQueue.length },
      'Processing request from queue'
    );

    try {
      const result = await this.executeClaudeRequest(request);
      request.resolve(result);
    } catch (error) {
      logger.error({ error, sessionId: request.sessionId }, 'Claude request failed');
      request.reject(error as Error);
    } finally {
      this.isProcessing = false;
      this.activeSessionId = null;

      // Process next request
      if (this.requestQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
   * Execute a single Claude request
   */
  private executeClaudeRequest(request: QueuedRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      this.activeSessionId = request.sessionId;

      // Spawn Claude Code process
      const args = [
        '--print',
        '--verbose',
        '--output-format', 'stream-json',
        '--resume', request.sessionId,
        '-p', request.message,
      ];

      logger.debug({ args: args.slice(0, -2) }, 'Spawning Claude Code');

      const proc = spawn('claude', args, {
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.activeProcess = proc;

      let finalResult: string | null = null;
      let resultCostUsd = 0;
      let resultDurationMs = 0;
      let errorOutput = '';
      let actualSessionId = request.sessionId;

      // Parse stdout as newline-delimited JSON
      const rl = createInterface({ input: proc.stdout });

      rl.on('line', (line) => {
        if (!line.trim()) return;

        try {
          const event = JSON.parse(line) as ClaudeStreamEvent;

          // Handle system init event - extract actual session ID
          if (event.type === 'system' && event.subtype === 'init') {
            if (event.session_id) {
              actualSessionId = event.session_id;
              logger.debug(
                { sessionId: actualSessionId, model: event.model, tools: event.tools?.length },
                'Claude session initialized'
              );
            }
            // Emit system init event
            this.emit('system_init', {
              sessionId: actualSessionId,
              model: event.model,
              tools: event.tools,
              mcpServers: event.mcp_servers,
            });
          }

          // Handle result event - this contains the final response
          if (event.type === 'result') {
            finalResult = event.result || '';
            resultCostUsd = event.total_cost_usd || 0;
            resultDurationMs = event.duration_ms || 0;

            // Track cost
            if (resultCostUsd > 0) {
              this.addCost(resultCostUsd);
            }

            logger.info(
              {
                sessionId: actualSessionId,
                costUsd: resultCostUsd,
                durationMs: resultDurationMs,
                responseLength: finalResult.length,
              },
              'Claude result received'
            );

            // Emit cost event for dashboard
            eventBus.emitCostEvent(resultCostUsd, actualSessionId);
          }

          // Emit stream event for dashboard and listeners
          this.handleStreamEvent(event, actualSessionId);
        } catch (e) {
          // Non-JSON line - might be progress indicator, ignore
          logger.trace({ line }, 'Non-JSON stdout line');
        }
      });

      // Capture stderr
      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
        logger.debug({ stderr: data.toString() }, 'Claude stderr');
      });

      // Handle process exit
      proc.on('close', (code) => {
        this.activeProcess = null;

        if (code === 0) {
          // Use finalResult from result event, or fallback
          const response = finalResult ?? 'No response generated.';
          logger.info(
            {
              sessionId: actualSessionId,
              responseLength: response.length,
              costUsd: resultCostUsd,
              durationMs: resultDurationMs,
            },
            'Claude request completed'
          );
          resolve(response);
        } else {
          const error = new AppError(
            `Claude Code exited with code ${code}: ${errorOutput}`,
            ErrorCode.CLAUDE_SESSION_ERROR,
            500,
            { exitCode: code, stderr: errorOutput }
          );
          reject(error);
        }
      });

      proc.on('error', (error) => {
        this.activeProcess = null;
        const appError = new AppError(
          `Failed to spawn Claude Code: ${error.message}`,
          ErrorCode.CLAUDE_SPAWN_ERROR,
          500,
          { originalError: error.message }
        );
        reject(appError);
      });

      // Timeout handling
      const timeout = setTimeout(() => {
        if (proc.exitCode === null) {
          logger.warn({ sessionId: request.sessionId }, 'Claude request timeout, killing process');
          proc.kill('SIGTERM');
          reject(
            new AppError(
              'Claude Code request timed out',
              ErrorCode.CLAUDE_TIMEOUT,
              408
            )
          );
        }
      }, config.CLAUDE_TIMEOUT_MS);

      proc.on('close', () => clearTimeout(timeout));
    });
  }

  /**
   * Handle a stream event from Claude Code
   */
  private handleStreamEvent(event: ClaudeStreamEvent, sessionId: string) {
    const claudeEvent: ClaudeEvent = {
      type: event.type,
      timestamp: Date.now(),
      sessionId,
      message: event.message,
      tool_use: event.tool_use
        ? {
            id: event.tool_use.id,
            name: event.tool_use.name,
            input: (event.tool_use.input as Record<string, unknown>) || {},
          }
        : undefined,
      tool_result: event.tool_result,
      error: event.error,
      // Include result fields
      result: event.result,
      costUsd: event.total_cost_usd,
      durationMs: event.duration_ms,
    };

    // Emit to event bus for dashboard
    eventBus.emitClaudeEvent(claudeEvent);

    // Emit locally for any direct listeners
    this.emit('event', claudeEvent);

    if (event.type === 'tool_use' && event.tool_use) {
      this.emit('tool_use', {
        sessionId,
        tool: event.tool_use.name,
        input: event.tool_use.input,
      });
    }

    if (event.type === 'result') {
      this.emit('result', {
        sessionId,
        result: event.result,
        costUsd: event.total_cost_usd,
        durationMs: event.duration_ms,
      });
    }
  }

  /**
   * Dispose the bridge
   */
  dispose() {
    if (this.activeProcess) {
      this.activeProcess.kill('SIGTERM');
      this.activeProcess = null;
    }
    this.requestQueue = [];
    logger.info('Claude Bridge disposed');
  }
}

// Singleton instance
export const claudeBridge = new ClaudeBridge();
