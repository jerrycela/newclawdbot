import { getSupabase, isSupabaseConfigured, testConnection, disposeSupabase } from './supabase';
import type { DbMemory, DbGoal, MemorySearchResult } from './supabase';
import { generateEmbedding, isOpenAIConfigured, clearEmbeddingCache } from './embeddings';
import { searchMemories, getRelevantContext, type SearchOptions } from './search';
import { createChildLogger } from '../utils/logger';
import type { Memory, MemoryType, Goal, GoalStatus } from '../types';

const logger = createChildLogger('memory-service');

export interface CreateMemoryInput {
  content: string;
  memoryType: MemoryType;
  importance?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  expiresAt?: Date;
}

export interface UpdateMemoryInput {
  content?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  expiresAt?: Date | null;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  priority?: number;
  deadline?: Date;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  status?: GoalStatus;
  priority?: number;
  deadline?: Date | null;
}

/**
 * Memory Service - Main API for memory operations
 */
export class MemoryService {
  private initialized = false;

  /**
   * Initialize the memory service
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    if (!isSupabaseConfigured()) {
      logger.warn('Supabase not configured, memory service disabled');
      return false;
    }

    if (!isOpenAIConfigured()) {
      logger.warn('OpenAI not configured, embedding generation disabled');
    }

    const { connected } = await testConnection();
    if (!connected) {
      logger.error('Failed to connect to Supabase');
      return false;
    }

    this.initialized = true;
    logger.info('Memory service initialized');
    return true;
  }

  /**
   * Check if memory service is available
   */
  isAvailable(): boolean {
    return this.initialized;
  }

  // ===== Memory CRUD =====

  /**
   * Create a new memory
   */
  async createMemory(input: CreateMemoryInput): Promise<Memory> {
    this.ensureInitialized();

    const supabase = getSupabase();

    // Generate embedding if OpenAI is configured
    let embedding: number[] | null = null;
    if (isOpenAIConfigured()) {
      try {
        embedding = await generateEmbedding(input.content);
      } catch (error) {
        logger.warn({ error }, 'Failed to generate embedding, storing without it');
      }
    }

    const { data, error } = await supabase
      .from('memories')
      .insert({
        content: input.content,
        memory_type: input.memoryType,
        importance: input.importance ?? 5,
        embedding,
        metadata: input.metadata ?? {},
        tags: input.tags ?? [],
        expires_at: input.expiresAt?.toISOString() ?? null,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error, input }, 'Failed to create memory');
      throw error;
    }

    logger.info({ id: data.id, type: input.memoryType }, 'Memory created');
    return this.dbToMemory(data as DbMemory);
  }

  /**
   * Get a memory by ID
   */
  async getMemory(id: string): Promise<Memory | null> {
    this.ensureInitialized();

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return this.dbToMemory(data as DbMemory);
  }

  /**
   * Update a memory
   */
  async updateMemory(id: string, input: UpdateMemoryInput): Promise<Memory> {
    this.ensureInitialized();

    const supabase = getSupabase();

    // If content is being updated, regenerate embedding
    let embedding: number[] | undefined;
    if (input.content && isOpenAIConfigured()) {
      try {
        embedding = await generateEmbedding(input.content);
      } catch (error) {
        logger.warn({ error }, 'Failed to regenerate embedding');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (input.content !== undefined) updateData.content = input.content;
    if (input.importance !== undefined) updateData.importance = input.importance;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.expiresAt !== undefined) {
      updateData.expires_at = input.expiresAt?.toISOString() ?? null;
    }
    if (embedding) updateData.embedding = embedding;

    const { data, error } = await supabase
      .from('memories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ error, id }, 'Failed to update memory');
      throw error;
    }

    logger.info({ id }, 'Memory updated');
    return this.dbToMemory(data as DbMemory);
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: string): Promise<boolean> {
    this.ensureInitialized();

    const supabase = getSupabase();
    const { error } = await supabase.from('memories').delete().eq('id', id);

    if (error) {
      logger.error({ error, id }, 'Failed to delete memory');
      throw error;
    }

    logger.info({ id }, 'Memory deleted');
    return true;
  }

  /**
   * Search memories semantically
   */
  async search(query: string, options?: SearchOptions): Promise<Memory[]> {
    this.ensureInitialized();

    const results = await searchMemories(query, options);
    return results.map((r) => this.dbToMemory(r));
  }

  /**
   * Get relevant context for a query
   */
  async getContext(query: string): Promise<string> {
    this.ensureInitialized();
    return getRelevantContext(query);
  }

  /**
   * Clean up expired memories
   */
  async cleanupExpired(): Promise<number> {
    this.ensureInitialized();

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('cleanup_expired_memories');

    if (error) {
      logger.error({ error }, 'Failed to cleanup expired memories');
      throw error;
    }

    const deletedCount = data as number;
    if (deletedCount > 0) {
      logger.info({ deletedCount }, 'Expired memories cleaned up');
    }
    return deletedCount;
  }

  // ===== Goals CRUD =====

  /**
   * Create a new goal
   */
  async createGoal(input: CreateGoalInput): Promise<Goal> {
    this.ensureInitialized();

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('goals')
      .insert({
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? 5,
        deadline: input.deadline?.toISOString() ?? null,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error, input }, 'Failed to create goal');
      throw error;
    }

    logger.info({ id: data.id, title: input.title }, 'Goal created');
    return this.dbToGoal(data as DbGoal);
  }

  /**
   * Get all goals with optional status filter
   */
  async getGoals(status?: GoalStatus): Promise<Goal[]> {
    this.ensureInitialized();

    const supabase = getSupabase();
    let query = supabase.from('goals').select('*').order('priority', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, 'Failed to fetch goals');
      throw error;
    }

    return (data as DbGoal[]).map((g) => this.dbToGoal(g));
  }

  /**
   * Get a goal by ID
   */
  async getGoal(id: string): Promise<Goal | null> {
    this.ensureInitialized();

    const supabase = getSupabase();
    const { data, error } = await supabase.from('goals').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return this.dbToGoal(data as DbGoal);
  }

  /**
   * Update a goal
   */
  async updateGoal(id: string, input: UpdateGoalInput): Promise<Goal> {
    this.ensureInitialized();

    const supabase = getSupabase();

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
    }
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.deadline !== undefined) {
      updateData.deadline = input.deadline?.toISOString() ?? null;
    }

    const { data, error } = await supabase
      .from('goals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ error, id }, 'Failed to update goal');
      throw error;
    }

    logger.info({ id, status: input.status }, 'Goal updated');
    return this.dbToGoal(data as DbGoal);
  }

  /**
   * Delete a goal
   */
  async deleteGoal(id: string): Promise<boolean> {
    this.ensureInitialized();

    const supabase = getSupabase();
    const { error } = await supabase.from('goals').delete().eq('id', id);

    if (error) {
      logger.error({ error, id }, 'Failed to delete goal');
      throw error;
    }

    logger.info({ id }, 'Goal deleted');
    return true;
  }

  // ===== Utilities =====

  /**
   * Dispose the memory service
   */
  dispose(): void {
    disposeSupabase();
    clearEmbeddingCache();
    this.initialized = false;
    logger.info('Memory service disposed');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Memory service not initialized');
    }
  }

  private dbToMemory(db: DbMemory): Memory {
    return {
      id: db.id,
      content: db.content,
      memoryType: db.memory_type,
      importance: db.importance,
      embedding: db.embedding ?? undefined,
      metadata: db.metadata,
      tags: db.tags,
      createdAt: new Date(db.created_at),
      updatedAt: db.updated_at ? new Date(db.updated_at) : undefined,
      expiresAt: db.expires_at ? new Date(db.expires_at) : undefined,
    };
  }

  private dbToGoal(db: DbGoal): Goal {
    return {
      id: db.id,
      title: db.title,
      description: db.description ?? undefined,
      status: db.status,
      priority: db.priority,
      deadline: db.deadline ? new Date(db.deadline) : undefined,
      createdAt: new Date(db.created_at),
      completedAt: db.completed_at ? new Date(db.completed_at) : undefined,
    };
  }
}

// Singleton instance
export const memoryService = new MemoryService();

// Re-export types and functions
export { searchMemories, getRelevantContext, type SearchOptions } from './search';
export { generateEmbedding, cosineSimilarity } from './embeddings';
export { testConnection, isSupabaseConfigured } from './supabase';
