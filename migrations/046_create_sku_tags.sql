CREATE TABLE IF NOT EXISTS sku_tags (
  id       SERIAL PRIMARY KEY,
  name     VARCHAR(100) NOT NULL UNIQUE,
  tag_type VARCHAR(20)  NOT NULL CHECK (tag_type IN ('operational', 'material')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sku_tag_assignments (
  id     BIGSERIAL    PRIMARY KEY,
  sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id) ON DELETE CASCADE,
  tag_id INT          NOT NULL REFERENCES sku_tags(id)     ON DELETE CASCADE,
  UNIQUE (sku_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_sta_sku ON sku_tag_assignments(sku_id);
CREATE INDEX IF NOT EXISTS idx_sta_tag ON sku_tag_assignments(tag_id);

INSERT INTO sku_tags (name, tag_type) VALUES
  ('In-stock',          'operational'),
  ('JIT',               'operational'),
  ('Self-manufactured', 'operational'),
  ('Limited stock',     'operational'),
  ('Brass',             'material'),
  ('Metal',             'material'),
  ('Aluminium',         'material'),
  ('Resin',             'material'),
  ('Glass',             'material')
ON CONFLICT (name) DO NOTHING;
