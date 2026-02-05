import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { config } from '../../utils/config';
import { createChildLogger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';
import { dashboardAuth } from './middleware/auth';
import healthRoutes from './routes/health';

const logger = createChildLogger('api-server');

const app = new Hono();

// Middleware: CORS
app.use(
  '*',
  cors({
    origin: config.CORS_ORIGINS,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
    credentials: true,
  })
);

// Middleware: Request logging
app.use('*', honoLogger());

// Middleware: Error handling
app.onError((err, c) => {
  if (err instanceof AppError) {
    logger.warn(
      {
        code: err.code,
        message: err.message,
        path: c.req.path,
      },
      'Application error'
    );
    return c.json(err.toJSON(), err.statusCode as 400 | 401 | 403 | 404 | 408 | 500);
  }

  logger.error(
    {
      error: err.message,
      stack: err.stack,
      path: c.req.path,
    },
    'Unhandled error'
  );

  return c.json(
    {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    },
    500
  );
});

// Public health check (no auth required)
app.route('/api/health', healthRoutes);

// Protected routes (require auth)
const protectedRoutes = new Hono();
protectedRoutes.use('*', dashboardAuth);

// Stats endpoint
protectedRoutes.get('/stats', async (c) => {
  // TODO: Return actual stats from database
  return c.json({
    memoryCount: 0,
    goalsCount: 0,
    todayMessages: 0,
    todayToolCalls: 0,
    topTools: [],
  });
});

// Mount protected routes
app.route('/api', protectedRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Clawdbot API',
    version: '1.0.0',
    docs: '/api/health',
  });
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.path} not found`,
      },
    },
    404
  );
});

export { app };

/**
 * Start the API server
 */
export function startApiServer(port?: number): void {
  const serverPort = port || config.API_PORT;

  Bun.serve({
    port: serverPort,
    fetch: app.fetch,
  });

  logger.info({ port: serverPort }, 'API server started');
}
