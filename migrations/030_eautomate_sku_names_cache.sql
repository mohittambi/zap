-- Global cache for GET /public/api/listings/sku/names (eautomate)

CREATE TABLE IF NOT EXISTS eautomate_sku_names_cache (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Long phone + email strings from eautomate vendor detail
ALTER TABLE vendors
    ALTER COLUMN vendor_contact_number TYPE TEXT;
