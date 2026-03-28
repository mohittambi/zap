-- Curated SKU lists (private / public)

CREATE TABLE IF NOT EXISTS focus_lists (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS focus_list_items (
    id BIGSERIAL PRIMARY KEY,
    focus_list_id INT NOT NULL REFERENCES focus_lists(id) ON DELETE CASCADE,
    sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (focus_list_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_focus_list_items_list ON focus_list_items (focus_list_id);
CREATE INDEX IF NOT EXISTS idx_focus_list_items_sku ON focus_list_items (sku_id);
