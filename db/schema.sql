-- Clawdbot Memory System Schema
-- Requires pgvector extension for semantic search

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== Memory Types Enum =====
CREATE TYPE memory_type AS ENUM (
  'fact',
  'goal',
  'todo',
  'conversation',
  'preference',
  'insight'
);

-- ===== Goal Status Enum =====
CREATE TYPE goal_status AS ENUM (
  'active',
  'completed',
  'paused'
);

-- ===== Memories Table =====
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  memory_type memory_type NOT NULL DEFAULT 'fact',
  importance INTEGER NOT NULL DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Index for semantic search (IVFFlat for better performance on large datasets)
CREATE INDEX IF NOT EXISTS memories_embedding_idx
  ON memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for memory type filtering
CREATE INDEX IF NOT EXISTS memories_type_idx ON memories(memory_type);

-- Index for importance-based queries
CREATE INDEX IF NOT EXISTS memories_importance_idx ON memories(importance DESC);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS memories_expires_at_idx ON memories(expires_at)
  WHERE expires_at IS NOT NULL;

-- ===== Goals Table =====
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status goal_status NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for active goals
CREATE INDEX IF NOT EXISTS goals_status_idx ON goals(status);

-- Index for priority sorting
CREATE INDEX IF NOT EXISTS goals_priority_idx ON goals(priority DESC);

-- ===== Functions =====

-- Function to search memories by semantic similarity
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_type memory_type DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  memory_type memory_type,
  importance INTEGER,
  metadata JSONB,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.memory_type,
    m.importance,
    m.metadata,
    m.tags,
    m.created_at,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE
    m.embedding IS NOT NULL
    AND (filter_type IS NULL OR m.memory_type = filter_type)
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND 1 - (m.embedding <=> query_embedding) >= match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to clean up expired memories
CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM memories
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ===== Row Level Security =====

-- Enable RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Policy for service role (full access)
CREATE POLICY "Service role has full access to memories"
  ON memories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to goals"
  ON goals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ===== Triggers =====

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
