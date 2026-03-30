-- ============================================================================
-- pgvector Extension: Enable semantic similarity search
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create custom types for cognitive system
CREATE TYPE system_type AS ENUM ('system1', 'system2');
CREATE TYPE stimulus_type AS ENUM ('interest', 'message', 'previous_thought', 'profile_bio');
