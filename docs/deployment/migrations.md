# Database migrations

## Location

Ordered SQL files: `web/migrations/*.sql` (numbered `001_` … `072_` as of 2026-06-25).

The canonical runner is [`web/scripts/run_migrations.sh`](../../scripts/run_migrations.sh). **Every** new `NNN_*.sql` file must be appended to that script in order.

## Apply

From `web/`:

```bash
npm run migrate
```

This runs `scripts/run_migrations.sh` with env loaded from `.env.local` then `.env` (see `package.json` `migrate` script).

## Registry check (always run)

Before and after applying SQL, `run_migrations.sh` calls [`scripts/verify_migrations.sh`](../../scripts/verify_migrations.sh):

1. **Registry parity** — `migrations/*.sql` on disk must match the list in `run_migrations.sh` (no orphans, no missing files).
2. **Post-migrate DB check** (`--db`) — when `DATABASE_URL` is set, confirms migration `070_security_hardening.sql` objects exist:
   - `users.api_key_prefix`, `users.token_invalidated_at`
   - `admin_audit_log` table
   - `query_builder:read` permission

Run manually without applying migrations:

```bash
npm run verify:migrations
```

Unit test (no database required):

```bash
tsx --test tests/unit/migrations-parity.test.mjs
```

Included in `npm run test:unit`.

### Adding migration `072+`

1. Create `web/migrations/072_your_change.sql`.
2. Append the path to the `for f in …` loop in `run_migrations.sh`.
3. Run `npm run verify:migrations` — it must pass before merge.
4. Run `npm run migrate` against dev/staging.
5. If the migration is security-related, extend `verify_migrations.sh --db` checks and document in [`../security/hardening-plan.md`](../security/hardening-plan.md).

## Security migration `070`

[`070_security_hardening.sql`](../../migrations/070_security_hardening.sql) supports the hardening plan in [`../security/hardening-plan.md`](../security/hardening-plan.md):

| Object | Purpose |
|--------|---------|
| `users.api_key_prefix` | O(1) API key lookup |
| `users.token_invalidated_at` | Invalidate JWTs on deactivation |
| `permissions (query_builder, read)` | Gate custom dashboard queries |
| `admin_audit_log` | Admin action audit trail |

Application code for these features lives under `web/src/server/auth.ts`, `web/src/middleware.ts`, `web/src/server/services/adminAuditService.ts`, etc. Security unit tests: `web/tests/unit/security-*.test.ts`.

## Inbound calibration migrations `071` / `072`

| Migration | Rule | What it backfills |
|-----------|------|-------------------|
| `071_recalculate_grn_header_totals.sql` | Doctrine #12 | `inbound_grns` quantity columns from `inbound_grn_items` |
| `072_recalculate_po_header_totals.sql` | Doctrine #13 | Zap `vendor_purchase_orders` summary totals from `inbound_grns` |

Runtime: `recalculateGrnAndPoHeaderTotals` in `grnHeaderTotalsService.ts`. Documented in [business/workflows/inbound-field-calibration.md](../business/workflows/inbound-field-calibration.md) and the [inbound-workflow-calibration skill](../../.cursor/skills/inbound-workflow-calibration/SKILL.md).

## Rules

1. **Never** edit applied migration files in production — add a **new** file with the next number.
2. Test migrations against a **copy** of production data when possible.
3. On Vercel, run migrations from **CI or your laptop** against the same `DATABASE_URL`, not inside the default serverless build (see [web-setup.md](web-setup.md)).

## Rollback

There is no automatic down-migration. Restore from backup or write a compensating migration.

## See also

- [../architecture/database-schema.md](../architecture/database-schema.md)
- [../security/hardening-plan.md](../security/hardening-plan.md)
