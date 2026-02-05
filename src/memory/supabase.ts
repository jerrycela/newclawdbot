import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../utils/config';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('supabase');

// Database types based on schema.sql
export interface DbMemory {
  id: string;
  content: string;
  memory_type: 'fact' | 'goal' | 'todo' | 'conversation' | 'preference' | 'insight';
  importance: number;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string | null;
  expires_at: string | null;
}

export interface DbGoal {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'completed' | 'paused';
  priority: number;
  deadline: string | null;
  created_at: string;
  completed_at: string | null;
}

// 搜尋結果型別 - 注意：SQL 函數不返回 embedding, updated_at, expires_at
export interface MemorySearchResult {
  id: string;
  content: string;
  memory_type: DbMemory['memory_type'];
  importance: number;
  metadata: Record<string, unknown>;
  tags: string[];
  created_at: string;
  similarity: number;
}

// Singleton Supabase client
let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client
 */
export function getSupabase(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase credentials not configured');
  }

  supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  logger.info('Supabase client initialized');
  return supabaseClient;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(config.SUPABASE_URL && config.SUPABASE_SERVICE_KEY);
}

/**
 * Test Supabase connection
 */
export async function testConnection(): Promise<{ connected: boolean; latency: number }> {
  if (!isSupabaseConfigured()) {
    return { connected: false, latency: -1 };
  }

  const start = Date.now();
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('memories').select('id').limit(1);

    if (error && !error.message.includes('does not exist')) {
      throw error;
    }

    const latency = Date.now() - start;
    logger.debug({ latency }, 'Supabase connection test successful');
    return { connected: true, latency };
  } catch (error) {
    logger.error({ error }, 'Supabase connection test failed');
    return { connected: false, latency: -1 };
  }
}

/**
 * Dispose Supabase client
 */
export function disposeSupabase(): void {
  supabaseClient = null;
  logger.info('Supabase client disposed');
}
