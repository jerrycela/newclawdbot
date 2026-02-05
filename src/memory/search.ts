import { getSupabase, type MemorySearchResult, type DbMemory } from './supabase';
import { generateEmbedding } from './embeddings';
import { createChildLogger } from '../utils/logger';
import type { MemoryType } from '../types';

const logger = createChildLogger('memory-search');

export interface SearchOptions {
  threshold?: number; // Minimum similarity threshold (0-1)
  limit?: number; // Maximum number of results
  memoryType?: MemoryType; // Filter by memory type
  includeExpired?: boolean; // Include expired memories
  minImportance?: number; // Minimum importance score
}

// 預設搜尋選項 - memoryType 為 undefined 表示不過濾
const DEFAULT_OPTIONS = {
  threshold: 0.7,
  limit: 10,
  memoryType: undefined as MemoryType | undefined,
  includeExpired: false,
  minImportance: 1,
} as const satisfies SearchOptions;

/**
 * Search memories by semantic similarity using pgvector
 */
export async function searchMemories(
  query: string,
  options: SearchOptions = {}
): Promise<MemorySearchResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  logger.debug({ query, options: opts }, 'Searching memories');

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    const supabase = getSupabase();

    // Use the search_memories function defined in schema.sql
    const { data, error } = await supabase.rpc('search_memories', {
      query_embedding: queryEmbedding,
      match_threshold: opts.threshold,
      match_count: opts.limit,
      filter_type: opts.memoryType || null,
    });

    if (error) {
      logger.error({ error }, 'Memory search RPC failed');
      throw error;
    }

    // Filter by importance if specified
    let results = (data as MemorySearchResult[]) || [];
    if (opts.minImportance > 1) {
      results = results.filter((m) => m.importance >= opts.minImportance);
    }

    logger.info(
      {
        query: query.substring(0, 50),
        resultsCount: results.length,
        topSimilarity: results[0]?.similarity,
      },
      'Memory search completed'
    );

    return results;
  } catch (error) {
    logger.error({ error, query }, 'Memory search failed');
    throw error;
  }
}

/**
 * Find similar memories to a given memory
 */
export async function findSimilarMemories(
  memoryId: string,
  options: Omit<SearchOptions, 'memoryType'> = {}
): Promise<MemorySearchResult[]> {
  const supabase = getSupabase();

  // First, get the source memory's embedding
  const { data: sourceMemory, error: fetchError } = await supabase
    .from('memories')
    .select('content, embedding')
    .eq('id', memoryId)
    .single();

  if (fetchError || !sourceMemory) {
    logger.error({ error: fetchError, memoryId }, 'Failed to fetch source memory');
    throw fetchError || new Error('Memory not found');
  }

  if (!sourceMemory.embedding) {
    // Generate embedding if not present
    const embedding = await generateEmbedding(sourceMemory.content);
    return searchMemoriesByEmbedding(embedding, options);
  }

  return searchMemoriesByEmbedding(sourceMemory.embedding, options);
}

/**
 * Search memories directly with an embedding vector
 */
export async function searchMemoriesByEmbedding(
  embedding: number[],
  options: SearchOptions = {}
): Promise<MemorySearchResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('search_memories', {
    query_embedding: embedding,
    match_threshold: opts.threshold,
    match_count: opts.limit,
    filter_type: opts.memoryType || null,
  });

  if (error) {
    logger.error({ error }, 'Memory search by embedding failed');
    throw error;
  }

  return (data as MemorySearchResult[]) || [];
}

/**
 * Get relevant context for a conversation
 * Combines different memory types with appropriate weighting
 */
export async function getRelevantContext(
  query: string,
  options: {
    maxTokens?: number;
    includeGoals?: boolean;
    includePreferences?: boolean;
    includeFacts?: boolean;
  } = {}
): Promise<string> {
  const {
    maxTokens = 2000,
    includeGoals = true,
    includePreferences = true,
    includeFacts = true,
  } = options;

  const contextParts: string[] = [];

  try {
    // Search for relevant facts
    if (includeFacts) {
      const facts = await searchMemories(query, {
        memoryType: 'fact',
        limit: 5,
        threshold: 0.75,
      });
      if (facts.length > 0) {
        contextParts.push('## Relevant Facts');
        facts.forEach((f) => contextParts.push(`- ${f.content}`));
      }
    }

    // Get user preferences
    if (includePreferences) {
      const preferences = await searchMemories(query, {
        memoryType: 'preference',
        limit: 3,
        threshold: 0.7,
      });
      if (preferences.length > 0) {
        contextParts.push('\n## User Preferences');
        preferences.forEach((p) => contextParts.push(`- ${p.content}`));
      }
    }

    // Get active goals
    if (includeGoals) {
      const supabase = getSupabase();
      const { data: goals } = await supabase
        .from('goals')
        .select('title, description, priority')
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .limit(3);

      if (goals && goals.length > 0) {
        contextParts.push('\n## Active Goals');
        goals.forEach((g) => {
          contextParts.push(`- [P${g.priority}] ${g.title}${g.description ? `: ${g.description}` : ''}`);
        });
      }
    }

    const context = contextParts.join('\n');

    // Rough token estimation (4 chars per token)
    if (context.length > maxTokens * 4) {
      return context.substring(0, maxTokens * 4) + '\n...(truncated)';
    }

    return context;
  } catch (error) {
    logger.error({ error }, 'Failed to get relevant context');
    return '';
  }
}
