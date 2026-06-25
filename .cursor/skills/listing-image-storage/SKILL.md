---
name: listing-image-storage
description: Listing product images in Zap Storage (listing-images bucket). Use when editing listings img_* columns, zapStorage, migrate-listing-images script, eAutomate listing sync, or listing image upload API. Status BUILT NOT ACTIVATED — do not run --apply-db or change sync without explicit user approval.
---

# Listing Image Storage

**Status: BUILT, NOT ACTIVATED**

Production still serves images from **sync-written CDN URLs**. Do **not** run `npm run migrate:listing-images -- --apply-db` or wire sync mirroring unless the user explicitly requests activation.

Canonical doctrine: [`docs/zap-doctrine.md`](../../../../docs/zap-doctrine.md) rule **#14**.

---

## Target architecture

| Layer | Location |
|-------|----------|
| Image bytes | Supabase Storage bucket `listing-images` (public) |
| Pointers | `listings.img_hd`, `img_white`, `img_wdim`, `img_link1`, `img_link2` |
| Object path | `{sku_id}/{slot}.{ext}` — slots: `hd`, `white`, `wdim`, `alt1`, `alt2` |

**Mirror-before-write:** never persist an upstream/CDN URL unless download → upload → verify succeeded in the same operation. On failure: log, skip column update.

---

## Build artifacts

| File | Role |
|------|------|
| [`src/server/zapStorage.ts`](../../src/server/zapStorage.ts) | `getListingsBucket()`, `buildPublicStorageUrl()` |
| [`scripts/lib/listingImageStorage.mjs`](../../scripts/lib/listingImageStorage.mjs) | Download, upload, mirror helpers |
| [`scripts/migrate-listing-images-to-storage.mjs`](../../scripts/migrate-listing-images-to-storage.mjs) | One-time backfill (dormant) |
| [`tests/unit/listing-image-storage.test.mjs`](../../tests/unit/listing-image-storage.test.mjs) | Pure helper tests |

Env (optional until activation): `ZAP_STORAGE_BUCKET_LISTINGS=listing-images`

---

## Migration script (when activated)

```bash
# Dry-run only — no upload, no DB (safe anytime)
npm run migrate:listing-images -- --dry-run --limit 10 --concurrency 1

# Smoke with upload, NO database change
npm run migrate:listing-images -- --limit 10 --concurrency 1

# Pilot — WRITES DB (activation only)
npm run migrate:listing-images -- --limit 100 --concurrency 5 --apply-db

# Full backfill (~34k distinct URLs, 2–4 hr)
npm run migrate:listing-images -- --concurrency 10 --apply-db --resume
```

**Flags:** `--limit`, `--concurrency` (default 1), `--dry-run`, `--apply-db`, `--resume`, `--field img_hd`, `--run-id`

**Logs:** `web/logs/listing-image-migrate-{runId}.jsonl` + `-summary.json`

**Checkpoint:** `web/logs/listing-image-migrate-checkpoint.jsonl` (for `--resume`)

---

## Activation checklist (operator)

1. Create **public** bucket `listing-images` in Supabase Dashboard
2. Set `ZAP_STORAGE_BUCKET_LISTINGS` if not using default
3. Pilot: `--limit 100 --concurrency 5 --apply-db`
4. Full: `--concurrency 10 --apply-db --resume`
5. Wire sync (phase 2) — see below
6. Verify external CDN URL count → 0:

```sql
SELECT COUNT(*) FROM listings
WHERE COALESCE(img_hd,'') || COALESCE(img_white,'') || ... ILIKE '%ecraftindia%'
   OR img_hd ILIKE '%intellozene%';
-- (check each img_* column for known external hosts)
```

---

## Phase 2 — sync (not built)

Update before activation cutover:

- [`scripts/lib/eautomateVendorUpsert.mjs`](../../scripts/lib/eautomateVendorUpsert.mjs) — `mirrorListingImage` per `L.img_*`; omit column on failure
- [`scripts/sync-eautomate-secondary-listings.mjs`](../../scripts/sync-eautomate-secondary-listings.mjs) — same in `upsertListingFromEautomate`

---

## Phase 3 — upload API (not built)

- `POST /api/listings/sku/[sku_id]/images` — multipart → Storage → update column
- Extend `PATCH /api/listings/sku/[sku_id]` to accept `img_*` (UI already attempts this)

---

## Scale reference (production DB)

~18,890 SKUs; ~36,857 filled image slots; ~34,790 distinct URLs; ~5–17 GB estimated payload (within Pro 100 GB storage quota).

---

## Agent rules

1. **Do not activate** migration or sync mirroring unless the user explicitly asks.
2. **Do not** run `--apply-db` during build/test unless user approves.
3. Prefer `--dry-run --limit N` for local verification.
4. When implementing phase 2, import mirror helpers from `listingImageStorage.mjs` — do not duplicate upload logic.
