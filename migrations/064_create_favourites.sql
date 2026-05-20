-- Per-user favourites across multiple entity types
-- (bin / purchase_order / consignment / sku). entity_id is stored as text so
-- it can hold both numeric (PO id) and alphanumeric (bin id, sku id) keys.

CREATE TABLE IF NOT EXISTS favourites (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    subtitle VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_favourites_user_created
    ON favourites (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_favourites_user_entity_type
    ON favourites (user_id, entity_type, created_at DESC);
