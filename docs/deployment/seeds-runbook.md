# Seeds and sample data runbook

## Safety

- **Seeds are for local development** unless you explicitly set `ZAP_ALLOW_REMOTE_SEED=1`.
- Do not run destructive seeds against production without a backup and runbook.

## Common npm scripts (from `web/package.json`)

| Command | Purpose |
|---------|---------|
| `npm run seed` | RBAC base (`seeds/001_rbac_seed.sql`) |
| `npm run seed:forms` | Forms seed |
| `npm run seed:zap` | Workbook-derived Zap data (`003`) |
| `npm run seed:ecraft` | eCraft RBAC + defaults |
| `npm run seed:catalogue-demo` | Demo catalogues + listings |
| `npm run seed:outbound-po` | Sample outbound POs |
| `npm run seed:sample` / `seed:sample:replace` | Sample CSV pipeline |

Order matters — see comments in [web/README.md](../../README.md).

## Sample CSV / workbook

- `web/sample_data/` — sample CSV users and related data (see folder README).
- Zap workbook regeneration: `npm run seed:generate` with `scripts/seed-xlsx-mapping.json`.

## See also

- [migrations.md](migrations.md)
