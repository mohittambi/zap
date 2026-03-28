-- Sales companies and mapping to channel secondary SKUs (eCraft: Secondary Company SKU Relation)

CREATE TABLE IF NOT EXISTS companies (
    id BIGINT PRIMARY KEY,
    name VARCHAR(200),
    code_primary VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_code_primary ON companies (code_primary);

CREATE TABLE IF NOT EXISTS company_secondary_sku (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    secondary_sku VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, secondary_sku)
);

CREATE INDEX IF NOT EXISTS idx_company_secondary_sku_secondary ON company_secondary_sku (secondary_sku);
CREATE INDEX IF NOT EXISTS idx_company_secondary_sku_company ON company_secondary_sku (company_id);
