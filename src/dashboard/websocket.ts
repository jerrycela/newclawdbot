import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../utils/config';
import { createChildLogger } from '../utils/logger';
import { eventBus } from '../gateway';
import type { DashboardEvent } from '../types';

const logger = createChildLogger('websocket');

let wss: WebSocketServer | null = null;

interface AuthenticatedWebSocket extends WebSocket {
  isAlive: boolean;
  isAuthenticated: boolean;
}

/**
 * Authenticate a WebSocket connection
 */
function authenticateConnection(url: string): boolean {
  // If no API_SECRET is configured, allow all connections
  if (!config.API_SECRET) {
    return true;
  }

  try {
    const urlObj = new URL(url, 'ws://localhost');
    const token = urlObj.searchParams.get('token');
    return token === config.API_SECRET;
  } catch {
    return false;
  }
}

/**
 * Create and start the WebSocket server for live feed
 */
export function createWebSocketServer(port?: number): WebSocketServer {
  if (wss) {
    return wss;
  }

  const wsPort = port || config.API_PORT + 1;
  wss = new WebSocketServer({ port: wsPort });

  logger.info({ port: wsPort }, 'WebSocket server starting');

  // Heartbeat interval
  const heartbeatInterval = setInterval(() => {
    wss?.clients.forEach((client) => {
      const ws = client as AuthenticatedWebSocket;
      if (!ws.isAlive) {
        logger.debug('Terminating dead connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, config.WS_HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  // Handle new connections
  wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
    const url = req.url || '';

    // Authenticate
    ws.isAuthenticated = authenticateConnection(url);
    if (!ws.isAuthenticated && config.API_SECRET) {
      logger.warn({ url }, 'Unauthorized WebSocket connection attempt');
      ws.close(4001, 'Unauthorized');
      return;
    }

    ws.isAlive = true;
    logger.info('New WebSocket client connected');

    // Send recent events on connect
    const recentEvents = eventBus.getRecentEvents(50);
    ws.send(
      JSON.stringify({
        type: 'history',
        events: recentEvents,
      })
    );

    // Handle pong (heartbeat response)
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (e) {
        // Ignore invalid messages
      }
    });

    // Handle close
    ws.on('close', () => {
      logger.debug('WebSocket client disconnected');
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error({ error }, 'WebSocket error');
    });
  });

  // Subscribe to event bus
  const eventHandler = (event: DashboardEvent) => {
    broadcast({ type: 'event', event });
  };
  eventBus.on('dashboard:event', eventHandler);

  logger.info({ port: wsPort }, 'WebSocket server started');
  return wss;
}

/**
 * Broadcast a message to all connected clients
 */
export function broadcast(message: object): void {
  if (!wss) return;

  const data = JSON.stringify(message);

  wss.clients.forEach((client) => {
    const ws = client as AuthenticatedWebSocket;
    if (ws.readyState === WebSocket.OPEN && ws.isAuthenticated) {
      ws.send(data);
    }
  });
}

/**
 * Get the number of connected clients
 */
export function getClientCount(): number {
  if (!wss) return 0;

  let count = 0;
  wss.clients.forEach((client) => {
    const ws = client as AuthenticatedWebSocket;
    if (ws.readyState === WebSocket.OPEN && ws.isAuthenticated) {
      count++;
    }
  });
  return count;
}

/**
 * Stop the WebSocket server
 */
export async function stopWebSocketServer(): Promise<void> {
  if (wss) {
    // Close all connections
    wss.clients.forEach((client) => {
      client.send(JSON.stringify({ type: 'server_shutdown' }));
      client.close();
    });

    return new Promise((resolve) => {
      wss?.close(() => {
        wss = null;
        logger.info('WebSocket server stopped');
        resolve();
      });
    });
  }
}
