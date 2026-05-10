# Instructions for AI coding assistants

> Claude / Cursor / Copilot / Codex pick this file up automatically. Read it before proposing code changes in this repo.

## Hard rule

**Before proposing any change that touches eAutomate sync, the `source` column on `vendor_purchase_orders` / `inbound_grns`, or the PO/GRN id allocator, re-read [docs/zap-doctrine.md](../docs/zap-doctrine.md).** The doctrine encodes 9 rules learned from production incidents. Skipping it produces phantom records, broken cross-screen joins, and ambiguous vendor names.

## Doctrine TL;DR

1. **Zap DB is canonical for the UI.** API routes that back pages read only PostgreSQL — never call `fetchEautomate*` from a request handler.
2. **Sync is explicit.** All zap ↔ eAutomate data movement happens via `npm run sync:*` scripts, never inline.
3. **Source separation.** Records carry a `source` column (`'zap'` | `'eautomate'`). Zap-source records are short-circuited from every eAutomate ingest path.
4. **Non-colliding ID namespace.** Zap-created records use a sequence from `10000000001`+. Never `MAX(id)+1` over a mixed-source table.
5. **Visual label parity.** Zap-source ids render as `ZP-{n}` / `ZG-{n}`; eAutomate-source ids render bare. Use [`src/lib/idDisplay.ts`](src/lib/idDisplay.ts).
6. **Header from canonical, snapshot for line-level only.** PO/GRN headers always JOIN the zap canonical table; eAutomate snapshots are auxiliary.
7. **Files in Zap Storage only.** No eAutomate fallback for downloads.
8. **Zap UI never writes to eAutomate** — except outbound consignment creation. One exception, no more.
9. **Optimistic UI updates.** Render local state immediately; persist follows; roll back on failure.

## When you add a new entity that ops can create in zap AND that exists in eAutomate

Follow the 7-step checklist in `docs/zap-doctrine.md` ("How to apply this when adding a new entity") — source column, sequence, ingest skip, sync UPSERT guard, display formatter, search-input stripping, changelog row.

## Conventions a quick scan won't reveal

- The boundary between zap and eAutomate is enforced at **service-level** (not framework-level). Always look in `web/src/server/services/eautomate*` to see what calls upstream.
- "Snapshot" tables (`inbound_po_detail_snapshot`, `inbound_grn_detail_snapshot`, etc.) hold raw eAutomate JSON. They are **supplementary**, never the source of truth for header data.
- Sync scripts live in `web/scripts/sync-eautomate-*.{mjs,ts}`. They are the only files allowed to issue eAutomate writes.
- Zap-created drafts historically used negative ids (e.g. `inbound_grns.grn_id < 0`). Migration 060 introduces the sequence-based replacement; both patterns coexist for now (negative ids will be backfilled).

## Tests

- Unit tests live in `web/tests/unit/*.test.ts` and run with `npm run test:unit`.
- API tests in `web/tests/api/*.test.mjs` need a running server (`npm run dev`) and a test DB (`TEST_DATABASE_URL`).
- Always add a unit test for new pure helpers (formatters, mergers, derivations).

## See also

- [docs/zap-doctrine.md](../docs/zap-doctrine.md) — the canonical doctrine
- [web/docs/architecture/hld.md](docs/architecture/hld.md) — high-level design
- [web/docs/current-system/workflows.md](docs/current-system/workflows.md) — runtime flow diagrams
