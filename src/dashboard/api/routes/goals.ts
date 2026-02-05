import { Hono } from 'hono';
import { memoryService } from '../../../memory';
import type { GoalStatus } from '../../../types';
import { AppError, ErrorCode } from '../../../utils/errors';
import { createChildLogger } from '../../../utils/logger';

const logger = createChildLogger('api-goals');

const goals = new Hono();

// Validate GoalStatus value
function isValidStatus(status: string): status is GoalStatus {
  return ['active', 'completed', 'paused'].includes(status);
}

// Validate and parse date string
function parseDate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new AppError(
      'Invalid date format. Use ISO 8601 format (e.g., 2024-12-31T23:59:59Z)',
      ErrorCode.VALIDATION_ERROR,
      400
    );
  }
  return date;
}

/**
 * GET /api/goals - List all goals
 * Query params:
 *   - status: 'active' | 'completed' | 'paused' (optional)
 */
goals.get('/', async (c) => {
  const status = c.req.query('status');

  if (status && !isValidStatus(status)) {
    throw new AppError(
      'Invalid status value. Must be: active, completed, or paused',
      ErrorCode.VALIDATION_ERROR,
      400
    );
  }

  const list = await memoryService.getGoals(status as GoalStatus | undefined);
  logger.debug({ count: list.length, status }, 'Goals listed');

  return c.json({ success: true, data: list });
});

/**
 * GET /api/goals/:id - Get a single goal by ID
 */
goals.get('/:id', async (c) => {
  const id = c.req.param('id');
  const goal = await memoryService.getGoal(id);

  if (!goal) {
    throw new AppError('Goal not found', ErrorCode.VALIDATION_ERROR, 404);
  }

  return c.json({ success: true, data: goal });
});

/**
 * POST /api/goals - Create a new goal
 * Body: { title: string, description?: string, priority?: number, deadline?: string }
 */
goals.post('/', async (c) => {
  const body = await c.req.json<{
    title?: string;
    description?: string;
    priority?: number;
    deadline?: string;
  }>();

  // Validate required fields
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    throw new AppError('Title is required', ErrorCode.VALIDATION_ERROR, 400);
  }

  // Validate priority range if provided
  if (body.priority !== undefined) {
    if (typeof body.priority !== 'number' || body.priority < 1 || body.priority > 10) {
      throw new AppError('Priority must be a number between 1 and 10', ErrorCode.VALIDATION_ERROR, 400);
    }
  }

  const goal = await memoryService.createGoal({
    title: body.title.trim(),
    description: body.description,
    priority: body.priority,
    deadline: body.deadline ? parseDate(body.deadline) : undefined,
  });

  logger.info({ goalId: goal.id, title: goal.title }, 'Goal created via API');

  return c.json({ success: true, data: goal }, 201);
});

/**
 * PUT /api/goals/:id - Update an existing goal
 * Body: { title?: string, description?: string, status?: GoalStatus, priority?: number, deadline?: string | null }
 */
goals.put('/:id', async (c) => {
  const id = c.req.param('id');

  // Check if goal exists
  const existing = await memoryService.getGoal(id);
  if (!existing) {
    throw new AppError('Goal not found', ErrorCode.VALIDATION_ERROR, 404);
  }

  const body = await c.req.json<{
    title?: string;
    description?: string;
    status?: string;
    priority?: number;
    deadline?: string | null;
  }>();

  // Validate status if provided
  if (body.status && !isValidStatus(body.status)) {
    throw new AppError(
      'Invalid status value. Must be: active, completed, or paused',
      ErrorCode.VALIDATION_ERROR,
      400
    );
  }

  // Validate priority range if provided
  if (body.priority !== undefined) {
    if (typeof body.priority !== 'number' || body.priority < 1 || body.priority > 10) {
      throw new AppError('Priority must be a number between 1 and 10', ErrorCode.VALIDATION_ERROR, 400);
    }
  }

  const goal = await memoryService.updateGoal(id, {
    title: body.title?.trim(),
    description: body.description,
    status: body.status as GoalStatus | undefined,
    priority: body.priority,
    deadline: body.deadline === null ? null : body.deadline ? parseDate(body.deadline) : undefined,
  });

  logger.info({ goalId: id }, 'Goal updated via API');

  return c.json({ success: true, data: goal });
});

/**
 * DELETE /api/goals/:id - Delete a goal
 */
goals.delete('/:id', async (c) => {
  const id = c.req.param('id');

  // Check if goal exists
  const existing = await memoryService.getGoal(id);
  if (!existing) {
    throw new AppError('Goal not found', ErrorCode.VALIDATION_ERROR, 404);
  }

  await memoryService.deleteGoal(id);
  logger.info({ goalId: id }, 'Goal deleted via API');

  return c.json({ success: true });
});

export default goals;
