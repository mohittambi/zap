-- Bin-level stock from eAutomate sku_wise_details POST (listing.bins[]); synced by sync-eautomate-secondary-listings.mjs

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS eautomate_bins JSONB NOT NULL DEFAULT '[]'::jsonb;
