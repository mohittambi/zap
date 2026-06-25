# Instructions for AI coding assistants

> Claude / Cursor / Copilot / Codex pick this file up automatically. Read it before proposing code changes in this repo.

## Hard rule

**Before proposing any change that touches eAutomate sync, the `source` column on `vendor_purchase_orders` / `inbound_grns`, the PO/GRN id allocator, GRN pending-queue tables, or inbound quantity rollups, re-read [docs/zap-doctrine.md](../docs/zap-doctrine.md).** The doctrine encodes **13 rules** learned from production incidents. Skipping it produces phantom records, broken cross-screen joins, ambiguous vendor names, GRNs that never reach the right queue page, and PO summary cards stuck at zero.

For inbound PO/GRN calibration specifically, also read [`.cursor/skills/inbound-workflow-calibration/SKILL.md`](.cursor/skills/inbound-workflow-calibration/SKILL.md).

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
10. **Workflow ownership.** Once a record exists in zap, its state transitions and pending-queue membership are owned by zap. Status mutators must INSERT into the next queue + DELETE from the previous one in the same transaction; sync scripts scope queue writes to `source = 'eautomate'`.
11. **Reports/exports use canonical tables.** CSV/Excel/PDF must read `inbound_grns`, `inbound_grn_items`, `vendor_purchase_orders` — not snapshot-only for Zap POs.
12. **GRN header aggregates match line items.** Call `recalculateGrnAndPoHeaderTotals` after line writes; migration `071` backfills.
13. **PO summary totals roll up from GRNs (Zap source).** `recalculatePoHeaderTotals` for `source='zap'` only; migration `072` backfills; sync must not clobber Zap rollups.

## When you add a new entity that ops can create in zap AND that exists in eAutomate

Follow the 7-step checklist in `docs/zap-doctrine.md` ("How to apply this when adding a new entity") — source column, sequence, ingest skip, sync UPSERT guard, display formatter, search-input stripping, changelog row.

## Conventions a quick scan won't reveal

- The boundary between zap and eAutomate is enforced at **service-level** (not framework-level). Always look in `web/src/server/services/eautomate*` to see what calls upstream.
- "Snapshot" tables (`inbound_po_detail_snapshot`, `inbound_grn_detail_snapshot`, etc.) hold raw eAutomate JSON. They are **supplementary**, never the source of truth for header data.
- Sync scripts live in `web/scripts/sync-eautomate-*.{mjs,ts}`. They are the only files allowed to issue eAutomate writes.
- Zap-created drafts historically used negative ids (e.g. `inbound_grns.grn_id < 0`). Migration 060 introduces the sequence-based replacement; both patterns coexist for now (negative ids will be backfilled).

## Security checklist (every code change)

Before merging any change that adds or modifies an API route, file upload, external fetch, or admin action, verify these rules. They reflect the hardening applied in migration `070_security_hardening.sql` and the helpers created alongside it.

1. **Auth on every route.** Every `/api/**` handler must authenticate via `verifyToken()` or `verifyApiKey()` (`src/server/auth.ts`). The global `middleware.ts` rejects unauthenticated requests, but route-level checks remain the primary gate.
2. **RBAC with `assertPermission()`.** After authentication, call `assertPermission(user, resource, action)` (`src/server/rbac.ts`) with the narrowest resource/action pair. Never rely on `user.roles?.includes(...)` directly.
3. **Input validation.** Validate request bodies before use. Prefer allow-lists for dynamic SQL column/table names — never interpolate user input into queries.
4. **File uploads.** Use `assertFileSize()` / `assertBlobSize()` and `assertFileType()` from `src/server/lib/uploadGuards.ts`. Max sizes: 10 MB for single files, 5 MB for bulk CSV imports. Allowed MIME types are defined in the guards.
5. **External fetch timeouts.** Every `fetch()` to an external service (eAutomate, Supabase Storage, Google Sheets) must include `signal: AbortSignal.timeout(30_000)` (15 s for auth/login endpoints).
6. **No secret fallbacks.** `getJwtSecret()` throws if `JWT_SECRET` is unset. Never add `|| "default"` fallbacks for secrets. Scheduler tokens read from env vars, not hardcoded strings.
7. **Rate limiting.** Login and other brute-forceable endpoints must call `checkRateLimit()` from `src/server/lib/rateLimiter.ts`.
8. **Admin audit logging.** User creation, deactivation, password resets, role changes, and API key regeneration must call `logAdminAction()` from `src/server/services/adminAuditService.ts`.
9. **IDOR prevention.** When a route accepts a user ID or email as a path/query param, verify it matches the authenticated user — or that the caller has admin privileges.
10. **No XSS vectors.** Do not use `dangerouslySetInnerHTML`. Mermaid diagrams must use `securityLevel: "strict"`.
11. **Security headers.** `next.config.ts` sets CSP, HSTS, X-Frame-Options, and other headers. Do not weaken them without a documented reason.
12. **Error responses.** Use `handleApiError()` — never return raw stack traces or internal details to the client.

Security tests live in `web/tests/unit/security-*.test.ts`. Add coverage when introducing new guards.

**Inbound calibration tests** (doctrine #12–#13): `grn-header-totals.test.ts`, `po-header-totals.test.ts`, `inbound-po-cancel-guard.test.ts`, `migrations-parity.test.mjs`. See the inbound skill for the full test bar.

## Tests

- Unit tests live in `web/tests/unit/*.test.ts` and run with `npm run test:unit`.
- API tests in `web/tests/api/*.test.mjs` need a running server (`npm run dev`) and a test DB (`TEST_DATABASE_URL`).
- Always add a unit test for new pure helpers (formatters, mergers, derivations).

## See also

- [docs/zap-doctrine.md](../docs/zap-doctrine.md) — the canonical doctrine (13 rules)
- [.cursor/skills/inbound-workflow-calibration/SKILL.md](.cursor/skills/inbound-workflow-calibration/SKILL.md) — inbound PO/GRN calibration, rollups, cancel guard
- [web/docs/architecture/hld.md](docs/architecture/hld.md) — high-level design
- [web/docs/current-system/workflows.md](docs/current-system/workflows.md) — runtime flow diagrams
