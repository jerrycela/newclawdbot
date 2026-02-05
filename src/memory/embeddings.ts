import OpenAI from 'openai';
import { LRUCache } from 'lru-cache';
import { config } from '../utils/config';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('embeddings');

// OpenAI client singleton
let openaiClient: OpenAI | null = null;

// Embedding cache to avoid redundant API calls
const embeddingCache = new LRUCache<string, number[]>({
  max: 500, // Cache up to 500 embeddings
  ttl: 1000 * 60 * 60, // 1 hour TTL
});

// Model configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Get or create OpenAI client
 */
function getOpenAI(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  if (!config.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  openaiClient = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
  });

  logger.info('OpenAI client initialized');
  return openaiClient;
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!config.OPENAI_API_KEY;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cacheKey = text.trim().toLowerCase();
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    logger.debug({ textLength: text.length }, 'Embedding cache hit');
    return cached;
  }

  const openai = getOpenAI();

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('No embedding returned from OpenAI');
    }

    // Cache the result
    embeddingCache.set(cacheKey, embedding);

    logger.debug(
      {
        textLength: text.length,
        embeddingLength: embedding.length,
        usage: response.usage,
      },
      'Embedding generated'
    );

    return embedding;
  } catch (error) {
    logger.error({ error, textLength: text.length }, 'Failed to generate embedding');
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  // Check cache and separate cached/uncached
  const results: (number[] | null)[] = texts.map((text) => {
    const cacheKey = text.trim().toLowerCase();
    return embeddingCache.get(cacheKey) || null;
  });

  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  results.forEach((result, index) => {
    if (result === null) {
      uncachedIndices.push(index);
      uncachedTexts.push(texts[index]!);
    }
  });

  // If all cached, return immediately
  if (uncachedTexts.length === 0) {
    logger.debug({ count: texts.length }, 'All embeddings from cache');
    return results as number[][];
  }

  const openai = getOpenAI();

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: uncachedTexts,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    // Fill in the results and cache
    response.data.forEach((item, i) => {
      const originalIndex = uncachedIndices[i]!;
      const embedding = item.embedding;
      results[originalIndex] = embedding;

      // Cache the result
      const cacheKey = uncachedTexts[i]!.trim().toLowerCase();
      embeddingCache.set(cacheKey, embedding);
    });

    logger.debug(
      {
        total: texts.length,
        cached: texts.length - uncachedTexts.length,
        generated: uncachedTexts.length,
        usage: response.usage,
      },
      'Batch embeddings generated'
    );

    return results as number[][];
  } catch (error) {
    logger.error({ error, count: uncachedTexts.length }, 'Failed to generate batch embeddings');
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
  logger.info('Embedding cache cleared');
}

/**
 * Get embedding cache stats
 */
export function getEmbeddingCacheStats(): { size: number; maxSize: number } {
  return {
    size: embeddingCache.size,
    maxSize: 500,
  };
}
