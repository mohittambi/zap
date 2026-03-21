-- eautomate: listing_embeddings table for RAG/vector search
-- Uses DOUBLE PRECISION[] so migrations run without pgvector. For pgvector use: CREATE EXTENSION vector; then ALTER TABLE listing_embeddings ALTER COLUMN embedding TYPE vector(1536) USING embedding::real[]::vector(1536);

CREATE TABLE IF NOT EXISTS listing_embeddings (
    id BIGSERIAL PRIMARY KEY,
    sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id),
    embedding_text TEXT,
    embedding DOUBLE PRECISION[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);
