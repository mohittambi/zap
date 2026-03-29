-- Secondary listings: company + labels payloads from eAutomate GET paginated + POST sku_wise_details sync

ALTER TABLE secondary_listings
  ADD COLUMN IF NOT EXISTS company_details JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE secondary_listings
  ADD COLUMN IF NOT EXISTS labels_data JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE secondary_listings
  ADD COLUMN IF NOT EXISTS sku_wise_details_raw JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE secondary_listings
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;
