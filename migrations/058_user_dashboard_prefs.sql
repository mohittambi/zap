-- Per-user dashboard preferences. v1 stores a JSONB layout with `visible_cards`
-- (an ordered allowlist of card IDs). Future versions may add named layouts,
-- reorder, default company, etc. — schema is intentionally JSONB-flexible.

CREATE TABLE IF NOT EXISTS user_dashboard_prefs (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    layout     JSONB   NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
