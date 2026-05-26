-- Company-specific EAN / item codes per master SKU (from EAN Code Dump File.xlsx)

CREATE TABLE IF NOT EXISTS company_ean_column_config (
    id           BIGSERIAL PRIMARY KEY,
    company_id   BIGINT NOT NULL UNIQUE REFERENCES companies (id) ON DELETE CASCADE,
    column_key   TEXT NOT NULL,
    label        TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_ean_mappings (
    id            BIGSERIAL PRIMARY KEY,
    sku_code      TEXT NOT NULL,
    company_id    BIGINT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    zap_ean       TEXT,
    ean_type      TEXT,
    universal_ean TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sku_code, company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_ean_mappings_sku ON company_ean_mappings (sku_code);
CREATE INDEX IF NOT EXISTS idx_company_ean_mappings_company ON company_ean_mappings (company_id);

CREATE INDEX IF NOT EXISTS idx_company_ean_mappings_zap_ean
    ON company_ean_mappings (zap_ean)
    WHERE zap_ean IS NOT NULL AND TRIM(zap_ean) <> '';
